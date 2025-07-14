const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('./config');

const AUTH_CONFIG_DIR = './data/config';
const AUTH_CONFIG_FILE = path.join(AUTH_CONFIG_DIR, 'auth.json');

class AuthService {
  constructor() {
    this.authConfig = null;
  }

  // 配置管理方法
  async ensureConfigDir() {
    try {
      await fs.mkdir(AUTH_CONFIG_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(AUTH_CONFIG_FILE, 'utf8');
      this.authConfig = JSON.parse(data);
      console.log('[AuthService] ✅ Runner配置加载成功');
      return this.authConfig;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[AuthService] ⚠️ Runner配置文件不存在，需要执行注册流程');
        return null;
      }
      throw error;
    }
  }

  async saveConfig(config) {
    await this.ensureConfigDir();
    await fs.writeFile(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2));
    this.authConfig = config;
    console.log('[AuthService] ✅ Runner配置保存成功');
  }

  // Runner注册和配置管理
  async register() {
    if (!config.site.authSite || !config.site.authToken) {
      throw new Error('AUTH_SITE or AUTH_TOKEN not configured');
    }

    console.log('[AuthService] 🔄 开始Runner注册流程...');
    try {
      const response = await axios.post(
        `${config.site.authSite}/coderun/register`,
        {
          auth_token: config.site.authToken,
          device_name: config.site.deviceName || require('os').hostname(),
          request_url: config.site.url
        }
      );

      const registrationData = {
        deviceId: response.data.device_id,
        runnerToken: response.data.runner_token,
        registeredAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await this.saveConfig(registrationData);
      console.log('[AuthService] ✅ Runner注册成功');
      return registrationData;
    } catch (error) {
      console.error('[AuthService] ❌ Runner注册失败:', error.message);
      throw error;
    }
  }

  async getRunnerConfig() {
    if (!this.authConfig) {
      this.authConfig = await this.loadConfig();
    }

    if (!this.authConfig) {
      this.authConfig = await this.register();
    }

    return this.authConfig;
  }

  async getRunnerToken() {
    const config = await this.getRunnerConfig();
    return config.runnerToken;
  }

  async getDeviceId() {
    const config = await this.getRunnerConfig();
    return config.deviceId;
  }

  async updateLastUpdated() {
    if (this.authConfig) {
      this.authConfig.lastUpdated = new Date().toISOString();
      await this.saveConfig(this.authConfig);
    }
  }

  // Token验证中间件
  async validateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      // 对于管理员端点，验证runner token
      if (req.path && req.path.startsWith('/admin/')) {
        const runnerToken = await this.getRunnerToken();
        if (token !== runnerToken) {
          return res.status(401).json({ error: 'Invalid admin token' });
        }
        next();
        return;
      }

      // 对于其他端点和WebSocket连接，验证JWT
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      next();
    } catch (error) {
      console.error('[AuthService] ❌ 无效的令牌:', error);
      return res.status(401).json({ error: '无效的令牌' });
    }
  }
}

module.exports = new AuthService();