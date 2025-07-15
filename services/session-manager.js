const WebSocket = require("ws");

class Session {
  constructor(userid, fingerprint, ws, container) {
    this.userid = userid;
    this.fingerprint = fingerprint;
    this.ws = ws;
    this.container = container;
    this.createdAt = new Date();
  }
}

class SessionManager {
  constructor() {
    // 存储所有活动会话
    // Map<string, Set<Session>> - userid -> Set of sessions
    this.userSessions = new Map();
    // Map<string, Session> - fingerprint -> session
    this.fingerprintSessions = new Map();
  }

  getActiveSessionCount() {
    return this.userSessions.size;
  }

  // 添加新会话
  addSession(userid, fingerprint, ws, container) {
    const session = new Session(userid, fingerprint, ws, container);

    // 添加到用户会话映射
    if (!this.userSessions.has(userid)) {
      this.userSessions.set(userid, new Set());
    }
    this.userSessions.get(userid).add(session);

    // 如果有fingerprint，添加到fingerprint映射
    if (fingerprint) {
      this.fingerprintSessions.set(fingerprint, session);
    }

    return session;
  }

  // 终止指定用户的所有会话
  async terminateUserSessions(userid) {
    const sessions = this.userSessions.get(userid);
    if (!sessions) return;

    for (const session of sessions) {
      await this.terminateSession(session);
    }

    this.userSessions.delete(userid);
  }

  // 终止指定fingerprint的会话
  async terminateFingerprintSession(fingerprint) {
    const session = this.fingerprintSessions.get(fingerprint);
    if (!session) return;

    await this.terminateSession(session);
    this.fingerprintSessions.delete(fingerprint);
  }

  // 终止单个会话
  async terminateSession(session) {
    try {
      // 关闭WebSocket连接
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close(1000, "Session terminated");
      }

      // 停止并删除容器
      if (session.container) {
        try {
          await session.container.remove({ force: true });
          console.log(`✅ 容器已删除, 用户ID: ${session.userid}`);
        } catch (error) {
          console.error(`❌ 删除容器失败, 用户ID: ${session.userid}:`, error);
        }
      }

      // 从用户会话集合中移除
      const userSessions = this.userSessions.get(session.userid);
      if (userSessions) {
        userSessions.delete(session);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userid);
        }
      }

      // 如果有fingerprint，从fingerprint映射中移除
      if (session.fingerprint) {
        this.fingerprintSessions.delete(session.fingerprint);
      }

      console.log(`✅ 会话已终止, 用户ID: ${session.userid}`);
    } catch (error) {
      console.error(`❌ 终止会话失败, 用户ID: ${session.userid}:`, error);
    }
  }

  // 检查用户是否有活动会话
  hasActiveUserSession(userid) {
    return (
      this.userSessions.has(userid) && this.userSessions.get(userid).size > 0
    );
  }

  // 检查fingerprint是否有活动会话
  hasActiveFingerprintSession(fingerprint) {
    return this.fingerprintSessions.has(fingerprint);
  }

  // 获取用户的所有会话
  getUserSessions(userid) {
    return this.userSessions.get(userid) || new Set();
  }

  // 获取fingerprint的会话
  getFingerprintSession(fingerprint) {
    return this.fingerprintSessions.get(fingerprint);
  }
}

module.exports = new SessionManager();
