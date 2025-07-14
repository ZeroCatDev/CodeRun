const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const WebSocket = require('ws');
const http = require('http');

const indexRouter = require('./routes/index');
const authService = require('./services/auth');
const { terminalService } = require('./services/terminal');

const app = express();

// 视图引擎设置
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 中间件
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 认证中间件
app.use(authService.validateToken.bind(authService));

// 路由
app.use('/', indexRouter);

// 错误处理
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

// WebSocket服务器设置
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws, req) => {
  try {
    // 解析token
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    // 验证token
    req.headers.authorization = `Bearer ${token}`;
    await new Promise((resolve, reject) => {
      authService.validateToken(
        req,
        { status: () => ({ json: (data) => reject(new Error(data.error)) }) },
        resolve
      );
    });

    // 处理终端连接
    await terminalService.handleConnection(ws, req);
  } catch (error) {
    console.error('WebSocket连接错误:', error);
    ws.close(1008, 'Authentication failed');
  }
});

module.exports = { app, server };
