require('dotenv').config();

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
    authSite: process.env.AUTH_SITE || '',
    authToken: process.env.AUTH_TOKEN || '',
    deviceName: process.env.DEVICE_NAME || '',
  },

  docker: {
    containerPoolSize: parseInt(process.env.CONTAINER_POOL_SIZE, 10) || 2,
    customImage: process.env.CUSTOM_IMAGE || 'zerocat-ubuntu:latest',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'dev',
  },

  admin: {
    enabled: process.env.ADMIN_ENABLED !== 'false', // 默认为true
    poolSize: parseInt(process.env.ADMIN_POOL_SIZE, 10) || 2,
    reportInterval: parseInt(process.env.ADMIN_REPORT_INTERVAL, 10) || 60000,
    lastConfigUpdate: new Date(),
    lastReport: new Date()
  }
};

// 验证必需的配置
function validateConfig() {
  const requiredInProduction = [
    'AUTH_SITE',
    'AUTH_TOKEN'
  ];

  if (config.server.env === 'production') {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable in production: ${key}`);
      }
    }
  }
}

// 打印配置信息（隐藏敏感信息）
function logConfig() {
  const sanitizedConfig = JSON.parse(JSON.stringify(config));
  // 隐藏敏感信息
  sanitizedConfig.site.authToken = '***';
  sanitizedConfig.jwt.secret = '***';

  console.log('[Config] 📝 当前配置');
  //console.log(JSON.stringify(sanitizedConfig, null, 2));
}

// 初始化配置
try {
  validateConfig();
  if (config.server.env !== 'test') {
    logConfig();
  }
} catch (error) {
  console.error('[Config] ❌ 配置错误:', error.message);
  process.exit(1);
}

module.exports = config;