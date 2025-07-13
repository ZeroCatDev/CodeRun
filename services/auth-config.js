const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');

const AUTH_CONFIG_DIR = './data/config';
const AUTH_CONFIG_FILE = path.join(AUTH_CONFIG_DIR, 'auth.json');

class AuthConfigService {
  constructor() {
    this.authConfig = null;
  }

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
      console.log('[AuthConfigService] ✅ Runner配置加载成功');
      return this.authConfig;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[AuthConfigService] ⚠️ Runner配置文件不存在，需要执行注册流程');
        return null;
      }
      throw error;
    }
  }

  async saveConfig(config) {
    await this.ensureConfigDir();
    await fs.writeFile(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2));
    this.authConfig = config;
    console.log('[AuthConfigService] ✅ Runner配置保存成功');
  }

  async register() {
    if (!config.site.authSite || !config.site.authToken) {
      throw new Error('AUTH_SITE or AUTH_TOKEN not configured');
    }

    console.log('[AuthConfigService] 🔄 开始Runner注册流程...');
    console.log({
        auth_token: config.site.authToken,
        device_name: config.site.deviceName || require('os').hostname(),
      })
    try {
      const response = await axios.post(
        `${config.site.authSite}/coderun/register`,
        {
          auth_token: config.site.authToken,
          device_name: config.site.deviceName || require('os').hostname(),
          request_url: config.site.url
        }
      );
      console.log(response)
      const registrationData = {
        deviceId: response.data.device_id,
        runnerToken: response.data.runner_token,
        registeredAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await this.saveConfig(registrationData);
      console.log('[AuthConfigService] ✅ Runner注册成功');
      return registrationData;
    } catch (error) {
      console.error('[AuthConfigService] ❌ Runner注册失败:', error.message);
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

  async getdeviceId() {
    const config = await this.getRunnerConfig();
    return config.deviceId;
  }

  async updateLastUpdated() {
    if (this.authConfig) {
      this.authConfig.lastUpdated = new Date().toISOString();
      await this.saveConfig(this.authConfig);
    }
  }
}

module.exports = new AuthConfigService();