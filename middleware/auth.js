const jwt = require('jsonwebtoken');
const config = require('../config');
const adminService = require('../services/admin');

async function validateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // For admin endpoints, validate against runner token (only for HTTP requests)
    if (req.path && req.path.startsWith('/admin/')) {
      const isValid = await adminService.validateAuthToken(token);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }
      next();
      return;
    }

    // For other endpoints and WebSocket connections, validate JWT
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[Auth] ❌ 无效的令牌:', error);
    return res.status(401).json({ error: '无效的令牌' });
  }
}

module.exports = {
  validateToken
};