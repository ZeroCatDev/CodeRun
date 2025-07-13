const express = require('express');
const router = express.Router();
const { validateToken } = require('../middleware/auth');
const sessionManager = require('../services/session-manager');

// 获取当前用户的会话状态
router.get('/status', validateToken, (req, res) => {
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

// 终止指定用户的所有会话
router.post('/terminate', validateToken, async (req, res) => {
  const { userid } = req.user;

  try {
    await sessionManager.terminateUserSessions(userid);
    res.json({ success: true, message: '所有会话已终止' });
  } catch (error) {
    console.error('❌ 终止会话失败:', error);
    res.status(500).json({ error: 'Failed to terminate sessions' });
  }
});

module.exports = router;