#!/usr/bin/env node

const { app, server } = require('./app');
const config = require('./services/config');
const debug = require('debug')('coderun:server');

// 获取端口
const port = normalizePort(config.server.port);
app.set('port', port);

// 启动服务器
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// 端口标准化
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

// 错误处理
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// 监听回调
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log(`[Server] 🚀 服务器启动成功，监听端口: ${addr.port}`);
}
