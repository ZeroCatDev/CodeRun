const axios = require("axios");
const jwt = require("jsonwebtoken");
const configStore = require("./config-store");
const fs = require("fs");
const path = require("path");

class AuthService {
  constructor() {
    this.runnerConfig = null;
    this.runnerToken = null;
    this.deviceId = null;
    this.lastUpdated = new Date();
    // 修改存储路径到 data 文件夹
    this.dataDir = path.join(__dirname, "../data");
    this.authFile = path.join(this.dataDir, "auth.json");
    this.ensureDataDirectory();
    this.loadAuthData();
  }

  // 确保数据目录和文件存在
  ensureDataDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        console.log("[AuthService] ✅ 成功创建数据目录");
      }

      if (!fs.existsSync(this.authFile)) {
        fs.writeFileSync(this.authFile, JSON.stringify({}, null, 2));
        console.log("[AuthService] ✅ 成功创建认证数据文件");
      }
    } catch (error) {
      console.error("[AuthService] ❌ 创建数据目录或文件失败:", error.message);
    }
  }

  loadAuthData() {
    try {
      if (fs.existsSync(this.authFile)) {
        const data = JSON.parse(fs.readFileSync(this.authFile, 'utf8'));
        this.runnerConfig = data.runnerConfig;
        this.runnerToken = data.runnerToken;
        this.deviceId = data.deviceId;
        this.lastUpdated = new Date(data.lastUpdated);

        // Update JWT secret from loaded config if available
        if (this.runnerConfig && this.runnerConfig.jwtSecret) {
          configStore.set("jwt.secret", this.runnerConfig.jwtSecret);
        }

        console.log("[AuthService] ✅ 成功从文件加载认证数据");
      }
    } catch (error) {
      console.error("[AuthService] ❌ 加载认证数据失败:", error.message);
    }
  }

  saveAuthData() {
    try {
      const data = {
        runnerConfig: this.runnerConfig,
        runnerToken: this.runnerToken,
        deviceId: this.deviceId,
        lastUpdated: this.lastUpdated.toISOString()
      };
      fs.writeFileSync(this.authFile, JSON.stringify(data, null, 2));
      console.log("[AuthService] ✅ 成功保存认证数据到文件");
    } catch (error) {
      console.error("[AuthService] ❌ 保存认证数据失败:", error.message);
    }
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

      // Save the new auth data to file
      this.saveAuthData();

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
    this.saveAuthData(); // Save when last updated changes
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
