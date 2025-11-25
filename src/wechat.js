const axios = require('axios');

/**
 * 微信授权登录工具类
 */
class WechatAuth {
  constructor(config) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.redirectUri = config.redirectUri;
  }

  /**
   * 生成微信授权登录 URL
   * @param {string} state - 防止 CSRF 攻击的随机字符串
   * @param {string} scope - 授权范围: snsapi_base(静默授权) 或 snsapi_userinfo(获取用户信息)
   * @returns {string} 微信授权登录 URL
   */
  getAuthUrl(state = '', scope = 'snsapi_userinfo') {
    const baseUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize';
    const params = new URLSearchParams({
      appid: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scope,
      state: state
    });
    return `${baseUrl}?${params.toString()}#wechat_redirect`;
  }

  /**
   * 通过 code 获取 access_token
   * @param {string} code - 微信回调返回的授权码
   * @returns {Promise<Object>} 包含 access_token, openid 等信息
   */
  async getAccessToken(code) {
    const url = 'https://api.weixin.qq.com/sns/oauth2/access_token';
    const params = {
      appid: this.appId,
      secret: this.appSecret,
      code: code,
      grant_type: 'authorization_code'
    };

    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.errcode) {
        throw new Error(`微信授权失败: ${data.errmsg} (错误码: ${data.errcode})`);
      }

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token,
        openid: data.openid,
        scope: data.scope
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`请求微信接口失败: ${error.response.status}`);
      }
      throw error;
    }
  }

  /**
   * 刷新 access_token
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 新的 access_token 信息
   */
  async refreshAccessToken(refreshToken) {
    const url = 'https://api.weixin.qq.com/sns/oauth2/refresh_token';
    const params = {
      appid: this.appId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    };

    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.errcode) {
        throw new Error(`刷新 token 失败: ${data.errmsg} (错误码: ${data.errcode})`);
      }

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token,
        openid: data.openid,
        scope: data.scope
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`请求微信接口失败: ${error.response.status}`);
      }
      throw error;
    }
  }

  /**
   * 获取用户信息
   * @param {string} accessToken - 访问令牌
   * @param {string} openid - 用户唯一标识
   * @returns {Promise<Object>} 用户信息
   */
  async getUserInfo(accessToken, openid) {
    const url = 'https://api.weixin.qq.com/sns/userinfo';
    const params = {
      access_token: accessToken,
      openid: openid,
      lang: 'zh_CN'
    };

    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.errcode) {
        throw new Error(`获取用户信息失败: ${data.errmsg} (错误码: ${data.errcode})`);
      }

      return {
        openid: data.openid,
        nickname: data.nickname,
        sex: data.sex,
        province: data.province,
        city: data.city,
        country: data.country,
        headimgurl: data.headimgurl,
        privilege: data.privilege,
        unionid: data.unionid
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`请求微信接口失败: ${error.response.status}`);
      }
      throw error;
    }
  }

  /**
   * 检验 access_token 是否有效
   * @param {string} accessToken - 访问令牌
   * @param {string} openid - 用户唯一标识
   * @returns {Promise<boolean>} 是否有效
   */
  async checkAccessToken(accessToken, openid) {
    const url = 'https://api.weixin.qq.com/sns/auth';
    const params = {
      access_token: accessToken,
      openid: openid
    };

    try {
      const response = await axios.get(url, { params });
      return response.data.errcode === 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = WechatAuth;
