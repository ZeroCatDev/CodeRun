const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authService = require('../services/auth');
const adminService = require('../services/admin');
const sessionManager = require('../services/session-manager');

/* 主页路由 */
router.get('/', function(req, res, next) {
  const fingerprint = req.cookies.fingerprint || crypto.randomBytes(16).toString('hex');

  if (!req.cookies.fingerprint) {
    res.cookie('fingerprint', fingerprint, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  }

  res.render('index', {
    title: 'Terminal',
    fingerprint: fingerprint
  });
});

/* 终端相关路由 */
router.get('/terminal/status', authService.validateToken, (req, res) => {
  const { userid, fingerprint } = req.user;
  const sessions = sessionManager.getUserSessions(userid);

  res.json({
    hasActiveSession: sessions.size > 0,
    sessions: Array.from(sessions).map(session => ({
      createdAt: session.createdAt,
      fingerprint: session.fingerprint
    }))
  });
});

router.post('/terminal/terminate', authService.validateToken, async (req, res) => {
  const { userid } = req.user;

  try {
    await sessionManager.terminateUserSessions(userid);
    res.json({ success: true, message: '所有会话已终止' });
  } catch (error) {
    console.error('❌ 终止会话失败:', error);
    res.status(200).json({ error: 'Failed to terminate sessions' });
  }
});

/* 管理员路由 */
router.get('/admin/config', authService.validateToken, async (req, res) => {
  console.log(`[Admin] 📥 [${new Date().toISOString()}] GET /admin/config - 请求接收`);

  try {
    const config = await adminService.getConfig();
    console.log('[Admin] 📤 发送配置响应:', JSON.stringify(config, null, 2));
    res.json(config);
  } catch (error) {
    console.error('[Admin] ❌ 获取配置失败:', error);
    res.status(500).json({ error: '内部服务器错误' });
  }
});

router.get('/admin/info', authService.validateToken, async (req, res) => {
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
