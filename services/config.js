require('dotenv').config();

// 从base64 token中解析配置
function parseConfigFromToken() {
  const token = process.env.TOKEN;
  if (!token) return null;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const config = JSON.parse(decoded);
    return {
      authSite: config.AUTH_SITE,
      authToken: config.AUTH_TOKEN
    };
  } catch (error) {
    console.error('[Config] ❌ Token解析错误:', error.message);
    return null;
  }
}

// 获取配置值
const tokenConfig = parseConfigFromToken();

const config = {
  server: {
    port: process.env.PORT || 3033,
    env: process.env.NODE_ENV || 'development',
  },

  jwt: {
    secret: '', // 将从云端获取
    expiresIn: '24h',
  },

  site: {
    url: process.env.SITE || 'http://localhost:3033',
    authSite: tokenConfig?.authSite || process.env.AUTH_SITE || '',
    authToken: tokenConfig?.authToken || process.env.AUTH_TOKEN || '',
    deviceName: process.env.DEVICE_NAME || '',
  },

  docker: {
    containerPoolSize: parseInt(process.env.CONTAINER_POOL_SIZE, 10) || 2,
    customImage: process.env.CUSTOM_IMAGE || 'zerocat-coderunner:latest',
  },

  logging: {
    level: 'info',
    format: 'dev',
  },

  admin: {
    poolSize: parseInt(process.env.ADMIN_POOL_SIZE, 10) || 2,
    reportInterval: parseInt(process.env.ADMIN_REPORT_INTERVAL, 10) || 60000,
    lastConfigUpdate: new Date(),
    lastReport: new Date()
  }
};

// 验证必需的配置
function validateConfig() {
  // 检查是否有token配置
  if (process.env.TOKEN) {
    if (!tokenConfig) {
      throw new Error('TOKEN 解析失败');
    }
    if (!tokenConfig.authSite || !tokenConfig.authToken) {
      throw new Error('TOKEN 中缺少必要的配置项 (AUTH_SITE 或 AUTH_TOKEN)');
    }
    return;
  }

  // 如果没有token，检查传统环境变量
  const requiredInProduction = [
    'AUTH_SITE',
    'AUTH_TOKEN'
  ];

  if (config.server.env === 'production') {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        throw new Error(`未找到必须的环境变量: ${key}`);
      }
    }
  }
}

// 初始化配置
try {
  validateConfig();
} catch (error) {
  console.error('[Config] ❌ 配置错误:', error.message);
  process.exit(1);
}

module.exports = config;