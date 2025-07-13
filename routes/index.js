var express = require('express');
var router = express.Router();
const crypto = require('crypto');

/* GET home page. */
router.get('/', function(req, res, next) {
  // Generate a random fingerprint if not exists
  const fingerprint = req.cookies.fingerprint || crypto.randomBytes(16).toString('hex');

  // Set cookie if not exists
  if (!req.cookies.fingerprint) {
    res.cookie('fingerprint', fingerprint, {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  }

  res.render('index', {
    title: 'Terminal',
    fingerprint: fingerprint
  });
});

module.exports = router;
