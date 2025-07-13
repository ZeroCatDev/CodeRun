const express = require('express');
const router = express.Router();
const adminService = require('../services/admin');

// Admin auth middleware
const validateAdminToken = (req, res, next) => {
  console.log(`[Admin] 🔑 [${new Date().toISOString()}] 验证管理员令牌 ${req.method} ${req.originalUrl}`);

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('[Admin] ❌ 没有提供授权头');
    return res.status(401).json({ error: '没有提供授权头' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || !adminService.validateAuthToken(token)) {
    console.log('[Admin] ❌ 无效的授权令牌');
    return res.status(401).json({ error: '无效的授权令牌' });
  }

  console.log('[Admin] ✅ 管理员令牌验证成功');
  next();
};

// Get current configuration
router.get('/config', validateAdminToken, async (req, res) => {
  console.log(`[Admin] 📥 [${new Date().toISOString()}] GET /coderun/config - 请求接收`);

  try {
    console.log('[Admin] 📤 发送配置响应:', JSON.stringify(config, null, 2));
    res.json(config);
  } catch (error) {
    console.error('[Admin] ❌ 获取配置失败:', error);
    res.status(500).json({ error: '内部服务器错误' });
  }
});

// Get system information
router.get('/info', validateAdminToken, async (req, res) => {
  console.log(`[Admin] 📥 [${new Date().toISOString()}] GET /admin/info - 请求接收`);

  try {
    const info = await adminService.getSystemInfo();
    console.log('[Admin] 📤 发送系统信息响应:', JSON.stringify(info, null, 2));
    res.json(info);
  } catch (error) {
    console.error('[Admin] ❌ 获取系统信息失败:', error);
    res.status(500).json({ error: '内部服务器错误' });
  }
});

module.exports = router;