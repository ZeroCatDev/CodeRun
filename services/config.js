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