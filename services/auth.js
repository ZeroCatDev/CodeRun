const axios = require("axios");
const jwt = require("jsonwebtoken");
const configStore = require("./config-store");

class AuthService {
  constructor() {
    this.runnerConfig = null;
    this.runnerToken = null;
    this.deviceId = null;
    this.lastUpdated = new Date();
  }

  async getRunnerConfig() {
    if (this.runnerConfig) {
      return this.runnerConfig;
    }

    const authSite = configStore.get("site.auth_site");
    const authToken = configStore.get("site.auth_token");
    const deviceName = configStore.get("site.device_name");

    if (!authSite || !authToken) {
      throw new Error("Missing required auth configuration");
    }

    try {
      console.log("[AuthService] 🔑 获取Runner配置...");
      const response = await axios.post(
        `${authSite}/coderun/register`,
        { device_name: deviceName, auth_token: authToken },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      this.runnerConfig = response.data;
      this.runnerToken = response.data.token;
      this.deviceId = response.data.deviceId;
      this.lastUpdated = new Date();

      // Update JWT secret from runner config if available
      if (response.data.jwtSecret) {
        configStore.set("jwt.secret", response.data.jwtSecret);
      }

      console.log("[AuthService] ✅ Runner配置获取成功");
      return this.runnerConfig;
    } catch (error) {
      console.error("[AuthService] ❌ 获取Runner配置失败:", error.message);
      if (error.response) {
        console.error("[AuthService] ❌ 错误响应:", error.response.data);
      }
      throw error;
    }
  }

  async getRunnerToken() {
    if (!this.runnerToken) {
      await this.getRunnerConfig();
    }
    return this.runnerToken;
  }

  async getDeviceId() {
    if (!this.deviceId) {
      await this.getRunnerConfig();
    }
    return this.deviceId;
  }

  async updateLastUpdated() {
    this.lastUpdated = new Date();
  }

  verifyToken(token) {
    try {
      const secret = configStore.get("jwt.secret");
      if (!secret) {
        throw new Error("JWT secret not configured");
      }
      return jwt.verify(token, secret);
    } catch (error) {
      console.error("[AuthService] ❌ Token验证失败:", error.message);
      return null;
    }
  }

  // Token验证中间件
  async validateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    try {
      // 对于管理员端点，验证runner token
      if (req.path && req.path.startsWith("/admin/")) {
        const runnerToken = await this.getRunnerToken();
        if (token !== runnerToken) {
          return res.status(401).json({ error: "Invalid admin token" });
        }
        next();
        return;
      }

      // 对于其他端点和WebSocket连接，验证JWT
      const decoded = this.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: "无效的令牌" });
      }
      req.user = decoded;
      next();
    } catch (error) {
      console.error("[AuthService] ❌ 无效的令牌:", error);
      return res.status(401).json({ error: "无效的令牌" });
    }
  }
}

const authService = new AuthService();
// 确保validateToken方法绑定到实例
authService.validateToken = authService.validateToken.bind(authService);

module.exports = authService;
