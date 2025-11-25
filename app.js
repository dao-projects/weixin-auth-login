require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const WechatAuth = require('./src/wechat');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化微信授权
const wechatAuth = new WechatAuth({
  appId: process.env.WECHAT_APP_ID,
  appSecret: process.env.WECHAT_APP_SECRET,
  redirectUri: process.env.WECHAT_REDIRECT_URI
});

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session 配置
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 发起微信授权登录
app.get('/auth/wechat', (req, res) => {
  // 生成随机 state 防止 CSRF 攻击
  const state = crypto.randomBytes(16).toString('hex');
  req.session.wechatState = state;
  
  const scope = req.query.scope || 'snsapi_userinfo';
  const authUrl = wechatAuth.getAuthUrl(state, scope);
  
  res.redirect(authUrl);
});

// 微信授权回调
app.get('/auth/wechat/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // 验证 state 防止 CSRF 攻击
  if (state !== req.session.wechatState) {
    return res.status(403).json({
      success: false,
      message: '授权验证失败，请重新登录'
    });
  }
  
  // 清除 state
  delete req.session.wechatState;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      message: '授权失败，未获取到授权码'
    });
  }
  
  try {
    // 通过 code 获取 access_token
    const tokenInfo = await wechatAuth.getAccessToken(code);
    
    // 获取用户信息
    const userInfo = await wechatAuth.getUserInfo(
      tokenInfo.accessToken,
      tokenInfo.openid
    );
    
    // 保存用户信息到 session
    req.session.user = {
      openid: userInfo.openid,
      nickname: userInfo.nickname,
      headimgurl: userInfo.headimgurl,
      sex: userInfo.sex,
      province: userInfo.province,
      city: userInfo.city,
      country: userInfo.country,
      unionid: userInfo.unionid
    };
    
    req.session.tokenInfo = {
      accessToken: tokenInfo.accessToken,
      refreshToken: tokenInfo.refreshToken,
      expiresIn: tokenInfo.expiresIn,
      expiresAt: Date.now() + tokenInfo.expiresIn * 1000
    };
    
    // 重定向到用户信息页面
    res.redirect('/user');
  } catch (error) {
    console.error('微信授权失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取当前登录用户信息
app.get('/api/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: '未登录'
    });
  }
  
  res.json({
    success: true,
    data: req.session.user
  });
});

// 用户信息页面
app.get('/user', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// 退出登录
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('退出登录失败:', err);
    }
    res.redirect('/');
  });
});

// 刷新 access_token
app.post('/api/refresh-token', async (req, res) => {
  if (!req.session.tokenInfo) {
    return res.status(401).json({
      success: false,
      message: '未登录'
    });
  }
  
  try {
    const newTokenInfo = await wechatAuth.refreshAccessToken(
      req.session.tokenInfo.refreshToken
    );
    
    req.session.tokenInfo = {
      accessToken: newTokenInfo.accessToken,
      refreshToken: newTokenInfo.refreshToken,
      expiresIn: newTokenInfo.expiresIn,
      expiresAt: Date.now() + newTokenInfo.expiresIn * 1000
    };
    
    res.json({
      success: true,
      message: 'Token 刷新成功'
    });
  } catch (error) {
    console.error('刷新 Token 失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  console.log('微信授权登录配置:');
  console.log(`  - AppID: ${process.env.WECHAT_APP_ID || '未配置'}`);
  console.log(`  - 回调地址: ${process.env.WECHAT_REDIRECT_URI || '未配置'}`);
});
