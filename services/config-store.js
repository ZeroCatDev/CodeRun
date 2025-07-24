const dotenv = require("dotenv");
dotenv.config();

class ConfigStore {
  constructor() {
    this.store = new Map();
    this.initializeStore();
  }

  parseConfigFromToken() {
    const token = process.env.TOKEN;
    if (!token) return null;

    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const config = JSON.parse(decoded);
      return {
        authSite: config.AUTH_SITE,
        authToken: config.AUTH_TOKEN,
      };
    } catch (error) {
      console.error("[ConfigStore] ❌ Token解析错误:", error.message);
      return null;
    }
  }

  initializeStore() {
    // 首先解析token配置
    const tokenConfig = this.parseConfigFromToken();

    // 如果有token配置，优先使用token中的配置
    if (tokenConfig) {
      this.setMany({
        "site.auth_site": tokenConfig.authSite,
        "site.auth_token": tokenConfig.authToken,
      });
    }

    // 然后初始化其他配置，但不覆盖已有的token配置
    const existingAuthSite = this.get("site.auth_site");
    const existingAuthToken = this.get("site.auth_token");

    this.setMany({
      "server.port": process.env.PORT || 3033,
      "server.env": process.env.NODE_ENV || "development",

      "jwt.secret": "", // Will be fetched from remote

      "site.url": process.env.SITE || "",
      "site.auth_site": existingAuthSite || process.env.AUTH_SITE || "",
      "site.auth_token": existingAuthToken || process.env.AUTH_TOKEN || "",
      "site.device_name": process.env.DEVICE_NAME || "",

      "docker.container_pool_size":
        parseInt(process.env.CONTAINER_POOL_SIZE, 10) || 2,
      "docker.custom_image": "sunwuyuan/coderunner:latest",

      "logging.level": "info",
      "logging.format": "dev",

      "admin.pool_size": parseInt(process.env.ADMIN_POOL_SIZE, 10) || 2,
      "admin.report_interval":
        parseInt(process.env.ADMIN_REPORT_INTERVAL, 10) || 60000,
      "admin.last_config_update": new Date().toISOString(),
      "admin.last_report": new Date().toISOString(),
    });
  }

  validateConfig() {
    // 检查是否有token配置
    if (process.env.TOKEN) {
      const authSite = this.get("site.auth_site");
      const authToken = this.get("site.auth_token");

      if (!authSite || !authToken) {
        throw new Error("TOKEN 中缺少必要的配置项 (AUTH_SITE 或 AUTH_TOKEN)");
      }
      return;
    }

    // 如果没有token，检查传统环境变量
    const requiredInProduction = ["AUTH_SITE", "AUTH_TOKEN"];

    if (this.get("server.env") === "production") {
      for (const key of requiredInProduction) {
        if (!process.env[key]) {
          throw new Error(`未找到必须的环境变量: ${key}`);
        }
      }
    }
  }

  // Get a single config value
  get(key) {
    return this.store.get(key);
  }

  // Set a single config value
  set(key, value) {
    this.store.set(key, value);
    return value;
  }

  // Set multiple config values at once
  setMany(configObject) {
    for (const [key, value] of Object.entries(configObject)) {
      this.set(key, value);
    }
  }

  // Get multiple config values by prefix
  getByPrefix(prefix) {
    const result = {};
    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        result[key] = value;
      }
    }
    return result;
  }

  // Update config from remote source
  updateFromRemote(remoteConfig) {
    if (!remoteConfig) return;

    // Map remote config to our key-value structure
    const mappedConfig = {};

    if (remoteConfig.jwtSecret) {
      mappedConfig["jwt.secret"] = remoteConfig.jwtSecret;
    }

    if (remoteConfig.poolSize !== undefined) {
      mappedConfig["admin.pool_size"] = remoteConfig.poolSize;
      mappedConfig["docker.container_pool_size"] = remoteConfig.poolSize;
    }
    console.log(remoteConfig.cloudconfig)
    // Handle cloudconfig object if present
    if (remoteConfig.cloudconfig) {
      for (const [key, value] of Object.entries(remoteConfig.cloudconfig)) {
        mappedConfig[key] = value;
      }
    }

    // Set the mapped values
    this.setMany(mappedConfig);

    // Update last config update timestamp
    this.set("admin.last_config_update", new Date().toISOString());
  }
}

// Create and validate a single instance
const configStore = new ConfigStore();
try {
  configStore.validateConfig();
} catch (error) {
  console.error("[ConfigStore] ❌ 配置错误:", error.message);
  process.exit(1);
}

module.exports = configStore;
