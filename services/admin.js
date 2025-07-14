const axios = require('axios');
const docker = new (require('dockerode'))();
const sessionManager = require('./session-manager');
const config = require('./config');
const authService = require('./auth');

class AdminService {
  constructor() {
    this.config = config.admin;
    this.config.site = config.site.url;
    this.config.authSite = config.site.authSite;
    this.config.jwtSecret = config.jwt.secret;

    // Delay initialization to avoid circular dependency
    setTimeout(() => {
      this.terminalService = require('./terminal').terminalService;
      this.initializeAdmin().catch(console.error);
    }, 1000);
  }

  logRequest(method, url, data = null) {
    console.log(`[AdminService] 📤 [${new Date().toISOString()}] ${method.toUpperCase()} ${url}`);
    if (data) {
      //console.log('Request Data:', JSON.stringify(data, null, 2));
    }
  }

  logResponse(method, url, response) {
    //console.log(`[AdminService] 📥 [${new Date().toISOString()}] ${method.toUpperCase()} ${url} - 状态: ${response.status}`);
    //console.log('Response Data:', JSON.stringify(response.data, null, 2));
  }

  logError(method, url, error) {
    console.error(`[AdminService] ❌ [${new Date().toISOString()}] ${method.toUpperCase()} ${url} - 错误:`, error.message);
    if (error.response) {
      console.error('[AdminService] ❌ 错误响应:', JSON.stringify(error.response.data, null, 2));
    }
  }

  async initializeAdmin() {
    try {
      console.log('[AdminService] 🚀 初始化管理服务...');

      // 确保已注册
      await authService.getRunnerConfig();

      // Start reporting interval
      setInterval(() => this.reportDeviceStatus(), this.config.reportInterval);

      // Initial report
      await this.reportDeviceStatus();

      // Initial config fetch
      await this.fetchRemoteConfig();

      console.log('[AdminService] ✅ 管理服务初始化成功');
    } catch (error) {
      console.error('[AdminService] ❌ 初始化管理服务失败:', error.message);
    }
  }

  async getSystemInfo() {
    console.log('[AdminService] 📊 收集系统信息...');
    const [dockerInfo, dockerVersion] = await Promise.all([
      docker.info(),
      docker.version()
    ]);

    const info = {
      docker: {
        version: dockerVersion.Version,
        apiVersion: dockerVersion.ApiVersion,
        os: dockerVersion.Os,
        arch: dockerVersion.Arch,
        containers: {
          total: dockerInfo.Containers,
          running: dockerInfo.ContainersRunning,
          paused: dockerInfo.ContainersPaused,
          stopped: dockerInfo.ContainersStopped
        }
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      coderun: {
        version: require('../package.json').version,
        poolSize: this.config.poolSize,
        activeConnections: sessionManager.getActiveSessionCount(),
        pooledContainers: this.terminalService ? this.terminalService.containerPool.length : 0,
        site: this.config.site,
        lastConfigUpdate: this.config.lastConfigUpdate,
        lastReport: this.config.lastReport,
        deviceId: await authService.getDeviceId()
      }
    };

    console.log('[AdminService] 📊 系统信息收集完成');
    return info;
  }

  async reportDeviceStatus() {
    if (!this.config.authSite) return;

    const url = `${this.config.authSite}/coderun/device`;
    try {
      const systemInfo = await this.getSystemInfo();
      const runnerToken = await authService.getRunnerToken();
      this.logRequest('POST', url, systemInfo);
      const response = await axios.post(
        url,
        systemInfo,
        {
          headers: { 'Authorization': `Bearer ${runnerToken}` }
        }
      );
      this.logResponse('POST', url, response);

      this.config.lastReport = new Date();
      await authService.updateLastUpdated();
      console.log('[AdminService] ✅ 设备状态上报成功'+new Date().toISOString());
    } catch (error) {
      this.logError('POST', url, error);
      console.error('[AdminService] ❌ 设备状态上报失败:', error);
    }
  }

  async fetchRemoteConfig() {
    if (!this.config.authSite) return;

    const url = `${this.config.authSite}/coderun/config`;
    try {
      const runnerToken = await authService.getRunnerToken();
      this.logRequest('GET', url);
      const response = await axios.get(
        url,
        {
          headers: { 'Authorization': `Bearer ${runnerToken}` }
        }
      );
      this.logResponse('GET', url, response);

      const newConfig = response.data;

      console.log('[AdminService] 📝 应用新配置');
      console.log(newConfig);

      if (newConfig.config) {
        // 更新全局 JWT secret
        if (newConfig.config.jwtSecret) {
          config.jwt.secret = newConfig.config.jwtSecret;
        }

        // 更新 admin 配置
        this.config = {
          ...this.config,
          ...newConfig.config,
          lastConfigUpdate: new Date()
        };

        // Apply pool size changes if needed
        if (newConfig.config.poolSize !== undefined && this.terminalService) {
          console.log(`[AdminService] 🔄 更新容器池大小到 ${newConfig.config.poolSize}`);
          this.terminalService.CONTAINER_POOL_SIZE = newConfig.config.poolSize;
          await this.terminalService.maintainContainerPool();
        }
      }

      await authService.updateLastUpdated();
      console.log('[AdminService] ✅ 远程配置更新成功');
      return this.config;
    } catch (error) {
      this.logError('GET', url, error);
      console.error('[AdminService] ❌ 获取远程配置失败:', error.message);

      // Check for 401 status and specific error message
      if (error.response && error.response.status === 401 &&
          error.response.data && error.response.data.error === 'Invalid runner token or device not found') {
        console.error('[AdminService] ❌ Runner令牌无效或设备未找到，程序将退出');
        process.exit(1);
      }

      throw error;
    }
  }

  getConfig() {
    return this.config;
  }

  async validateAuthToken(token) {
    const runnerToken = await authService.getRunnerToken();
    const isValid = token === runnerToken;
    console.log(`[AdminService] 🔒 认证令牌验证: ${isValid ? '成功' : '失败'}`);
    return isValid;
  }
}

module.exports = new AdminService();