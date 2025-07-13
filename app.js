const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const WebSocket = require('ws');
const terminalService = require('./services/terminal');
const adminService = require('./services/admin');
const { validateToken } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const config = require('./config');
const bodyParser = require('body-parser');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const terminalRouter = require('./routes/terminal');
const adminRouter = require('./routes/admin');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// middleware setup
app.use(logger(config.logging.format));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(config.security.cookieSecret));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: false }));
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.text({ limit: "100mb" }));
app.use(bodyParser.raw({ limit: "100mb" }));

// Security headers
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  next();
});

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/terminal', terminalRouter);
app.use('/admin', adminRouter);

// WebSocket server setup
const wss = new WebSocket.Server({ noServer: true });

// WebSocket authentication middleware
async function authenticateWebSocket(request, socket, head) {
  try {
    // 从URL参数中获取token
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 验证token并解码用户信息
    const decoded = jwt.verify(token, config.jwt.secret);
    request.user = {
      userid: decoded.userid,
      fingerprint: decoded.fingerprint
    };

    // 升级连接
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch (error) {
    console.error('WebSocket authentication failed:', error);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
}

// Handle WebSocket connections
wss.on('connection', (ws, request) => {
  try {
    terminalService.handleConnection(ws, request);
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close(1008, 'Authentication failed');
  }
});

// Error handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = { app, authenticateWebSocket };
