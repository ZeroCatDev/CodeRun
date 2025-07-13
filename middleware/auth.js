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
    // For admin endpoints, validate against runner token
    if (req.path.startsWith('/admin/')) {
      const isValid = await adminService.validateAuthToken(token);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }
      next();
      return;
    }

    // For other endpoints, validate JWT
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  validateToken
};