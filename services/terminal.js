const Docker = require("dockerode");
const WebSocket = require("ws");
const url = require('url');
const path = require('path');

// 配置Docker连接
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  // 如果使用TCP连接（可选）
  // host: process.env.DOCKER_HOST || 'localhost',
  // port: process.env.DOCKER_PORT || 2375,
  // 如果需要TLS认证（可选）
  // ca: process.env.DOCKER_CA_FILE ? fs.readFileSync(process.env.DOCKER_CA_FILE) : null,
  // cert: process.env.DOCKER_CERT_FILE ? fs.readFileSync(process.env.DOCKER_CERT_FILE) : null,
  // key: process.env.DOCKER_KEY_FILE ? fs.readFileSync(process.env.DOCKER_KEY_FILE) : null,
});

const sessionManager = require('./session-manager');
const authService = require('./auth');
const configStore = require('./config-store');

// Get custom image from config
const CUSTOM_IMAGE = configStore.get('docker.custom_image');
let CONTAINER_POOL_SIZE = configStore.get('docker.container_pool_size');
const CONTAINER_PREFIX = "zerocat_term_"; // Container name prefix

class TerminalService {
  constructor() {
    this.docker = docker;
    this.containerPool = [];
    this.CONTAINER_POOL_SIZE = configStore.get('docker.container_pool_size');
    this.initDocker().catch((error) => {
      console.error("[Docker] ❌ Docker服务初始化失败:", error);
      process.exit(1);
    });
  }

  // 清理所有旧的容器
  async cleanupOldContainers() {
    try {
      console.log("[TerminalService] 🧹 开始清理旧容器...");
      const containers = await this.docker.listContainers({ all: true });

      let cleanupCount = 0;
      for (const container of containers) {
        if (container.Names.some(name => name.startsWith('/' + CONTAINER_PREFIX))) {
          const containerObj = this.docker.getContainer(container.Id);
          try {
            await containerObj.remove({ force: true });
            cleanupCount++;
          } catch (error) {
            console.error(`[TerminalService] ❌ 清理容器 ${container.Id} 失败:`, error.message);
          }
        }
      }

      console.log(`[TerminalService] ✅ 清理完成，共删除 ${cleanupCount} 个旧容器`);
    } catch (error) {
      console.error("[TerminalService] ❌ 清理旧容器时出错:", error);
    }
  }

  getStatus() {
    return {
      poolSize: CONTAINER_POOL_SIZE,
      pooledContainers: this.containerPool ? this.containerPool.length : 0
    };
  }

  // Getter and setter for pool size
  get CONTAINER_POOL_SIZE() {
    return CONTAINER_POOL_SIZE;
  }

  set CONTAINER_POOL_SIZE(size) {
    CONTAINER_POOL_SIZE = size;
  }

  // Generate a unique container name
  generateContainerName(userid) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${CONTAINER_PREFIX}${userid}_${timestamp}_${random}`;
  }

  // Generate container labels
  generateContainerLabels(userid, fingerprint, isPooled = false) {
    const now = new Date().toISOString();
    return {
      "com.zerocat.fingerprint": fingerprint || "",
      "com.zerocat.userid": String(userid),
      "com.zerocat.type": "terminal",
      "com.zerocat.created": now,
      "com.zerocat.security": "standard",
      "com.zerocat.pooled": String(isPooled),
      "com.zerocat.environment": process.env.NODE_ENV || "development",
      "com.zerocat.version": "1.0",
      "com.zerocat.name": this.generateContainerName(userid || 'pool'),
      "com.zerocat.last_modified": now
    };
  }

  async initDocker() {
    try {
      // 首先清理旧容器
      await this.cleanupOldContainers();

      const [info, version] = await Promise.all([
        this.docker.info(),
        this.docker.version(),
        this.warmupImage(), // Pre-pull image during init
      ]);

      console.log("[Docker]✅ Docker服务运行正常");
      console.log(`[Docker]🐳 Docker版本: ${version.Version}`);
      console.log(`[Docker]🐧 操作系统: ${version.Os}`);
      console.log(`[Docker]🔄 API版本: ${version.ApiVersion}`);
      console.log(
        `[Docker]📦 容器总数: ${info.Containers}, 运行中: ${info.ContainersRunning}, 暂停: ${info.ContainersPaused}, 停止: ${info.ContainersStopped}`
      );

      // Initialize container pool
      await this.maintainContainerPool();
      // Start pool maintenance interval
      setInterval(() => this.maintainContainerPool(), 30000); // Check every 30 seconds
    } catch (error) {
      throw {
        code: "DOCKER_UNAVAILABLE",
        message: "Docker service is not available",
      };
    }
  }

  async maintainContainerPool() {
    try {
      // Clean up any stopped containers
      this.containerPool = this.containerPool.filter(c => c.status === 'created');

      // Create new containers if needed
      while (this.containerPool.length < CONTAINER_POOL_SIZE) {
        const container = await this.createContainer(null, null, true);
        this.containerPool.push({
          container,
          status: 'created',
          createdAt: new Date()
        });
        console.log("[TerminalService] 🔄 添加新容器到池中");
      }
    } catch (error) {
      console.error("[TerminalService] ❌ 维护容器池时出错:", error);
    }
  }

  async getContainer(userid, fingerprint) {
    // Try to get a container from the pool
    const pooledContainer = this.containerPool.shift();
    if (pooledContainer) {
      try {
        const container = pooledContainer.container;
        const newName = this.generateContainerName(userid);
        const newLabels = this.generateContainerLabels(userid, fingerprint, false);

        // Update container name and labels
        await container.rename({ name: newName });
        await container.update({ Labels: newLabels });

        console.log(`[TerminalService] ✅ 重用容器池中的容器, 重命名: ${newName}`);
        return container;
      } catch (error) {
        console.error("[TerminalService] ❌ 重用池中容器时出错:", error);
        // Fall through to create new container
      }
    }

    // If no pooled container available, create a new one
    return this.createContainer(userid, fingerprint, false);
  }

  async warmupImage() {
    try {
      const images = await this.docker.listImages();
      const found = images.find(
        (img) => img.RepoTags && img.RepoTags.includes(CUSTOM_IMAGE)
      );

      if (!found) {
        console.log("[TerminalService] 🔄 预拉取容器镜像...");
        await new Promise((resolve, reject) => {
          this.docker.pull(CUSTOM_IMAGE, (err, stream) => {
            if (err) return reject(err);
            this.docker.modem.followProgress(stream, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
        console.log("[TerminalService] ✅ 镜像预拉取成功");
      } else {
        console.log("[TerminalService] ✅ 镜像已存在");
      }
    } catch (error) {
      console.error("[TerminalService] ❌ 预拉取镜像失败:", error);
      throw error;
    }
  }

  async findSuitableImage() {
    try {
      const images = await this.docker.listImages();
      const found = images.find(
        (img) => img.RepoTags && img.RepoTags.includes(CUSTOM_IMAGE)
      );

      if (found) {
        return CUSTOM_IMAGE;
      }

      throw {
        code: "NO_IMAGE",
        message:
          "ZeroCat Ubuntu image not found. Please ensure the image is built and available.",
      };
    } catch (error) {
      console.error("[TerminalService] ❌ 查找合适的容器镜像时出错:", error);
      throw {
        code: "NO_IMAGE",
        message: "Failed to find container image: " + error.message,
      };
    }
  }

  async createContainer(userid, fingerprint, isPooled = false) {
    try {
      console.log("[TerminalService] 📦 创建新容器...");
      const imageTag = await this.findSuitableImage();
      console.log(`[TerminalService] ✅ Using image: ${imageTag}`);

      const containerName = this.generateContainerName(userid || 'pool');
      console.log(`[TerminalService] 📝 创建容器, 名称: ${containerName}`);

      const container = await this.docker.createContainer({
        Image: imageTag,
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Cmd: ["/bin/bash"],
        Hostname: "zerocat-terminal",
        name: containerName,
        Env: [
          "TERM=xterm-256color",
          "LANG=C.UTF-8",
          "LC_ALL=C.UTF-8",
          "COLORTERM=truecolor",
          "FORCE_COLOR=true",
          "CLICOLOR=1",
          "LS_COLORS=$(dircolors -b)",
        ],
        WorkingDir: "/home/zerocat",
        HostConfig: {
          AutoRemove: true,
          Memory: 256 * 1024 * 1024,
          MemorySwap: 256 * 1024 * 1024,
          CpuShares: 128,
          CpuQuota: 25000,
          CpuPeriod: 100000,
          PidsLimit: 50,
          SecurityOpt: ["no-new-privileges:false"],
          CapDrop: ["MKNOD", "NET_RAW", "AUDIT_WRITE"],
          CapAdd: [
            "CHOWN",
            "DAC_OVERRIDE",
            "FOWNER",
            "SETGID",
            "SETUID",
            "NET_BIND_SERVICE",
            "SYS_CHROOT",
          ],
          NetworkMode: "none",
          OomKillDisable: false,
          MemorySwappiness: 0,
          Init: true
        },
        Labels: this.generateContainerLabels(userid, fingerprint, isPooled)
      });

      await container.start();

      // Wait for container to be ready
      await this.waitForContainerReady(container);

      console.log(`[TerminalService] ✅ 容器 ${containerName} 启动成功`);
      return container;  // Add this line to return the container

    } catch (error) {
      console.error("[TerminalService] ❌ 创建容器时出错:", error);
      throw {
        code: "CONTAINER_ERROR",
        message: "Failed to create container: " + error.message,
      };
    }
  }

  async waitForContainerReady(container) {
    const maxRetries = 10;
    const retryDelay = 100; // 100ms

    for (let i = 0; i < maxRetries; i++) {
      try {
        const exec = await container.exec({
          AttachStdin: false,
          AttachStdout: true,
          AttachStderr: true,
          Tty: false,
          Cmd: ["ps", "1"]
        });

        const stream = await exec.start();
        const output = await new Promise((resolve, reject) => {
          let data = '';
          stream.on('data', chunk => data += chunk);
          stream.on('end', () => resolve(data));
          stream.on('error', reject);
        });

        if (output.includes("init") || output.includes("bash")) {
          return true;
        }
      } catch (error) {
        // Ignore errors and continue retrying
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error("Container failed to become ready");
  }

  async handleConnection(ws, req) {
    // 验证token
    try {
      const query = url.parse(req.url, true).query;
      const token = query.token;

      if (!token) {
        throw new Error('No token provided');
      }

      await new Promise((resolve, reject) => {
        authService.validateToken(
          { headers: { authorization: `Bearer ${token}` } },
          {
            status: () => ({
              json: (data) => reject(new Error(data.error))
            })
          },
          resolve
        );
      });
    } catch (error) {
      console.error("[TerminalService] ❌ 认证失败:", error);
      ws.close(1008, "Authentication failed");
      return;
    }

    const { userid, fingerprint } = req.user;
    console.log(`[TerminalService] 🔌 用户的新终端连接请求, 用户ID: ${userid}, 指纹: ${fingerprint}`);

    // 检查并终止现有会话
    if (sessionManager.hasActiveUserSession(userid)) {
      console.log(`[TerminalService] 🔄 终止用户的现有会话, 用户ID: ${userid}`);
      await sessionManager.terminateUserSessions(userid);
    }

    if (fingerprint && sessionManager.hasActiveFingerprintSession(fingerprint)) {
      console.log(`[TerminalService] 🔄 正在终止指纹识别的现有会话, 指纹: ${fingerprint}`);
      await sessionManager.terminateFingerprintSession(fingerprint);
    }

    let container = null;
    let stream = null;

    try {
      container = await this.getContainer(userid, fingerprint);

      // Create session before stream to ensure proper cleanup
      const session = sessionManager.addSession(userid, fingerprint, ws, container);

      // Prepare exec and stream in parallel with session creation
      stream = await this.prepareExec(container);

      // Handle WebSocket messages (stdin)
      ws.on("message", (data) => {
        if (stream && stream.writable) {
          try {
            stream.write(data);
          } catch (error) {
            console.error("[TerminalService] ❌ 流写入错误:", error);
            sessionManager.terminateSession(session);
          }
        }
      });

      // Handle container output with improved error handling
      docker.modem.demuxStream(
        stream,
        {
          write: (data) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(data.toString());
              } catch (error) {
                console.error("[TerminalService] ❌ 发送数据失败:", error);
                sessionManager.terminateSession(session);
              }
            }
          },
        },
        {
          write: (data) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(data.toString());
              } catch (error) {
                console.error("[TerminalService] ❌ 发送错误数据失败:", error);
                sessionManager.terminateSession(session);
              }
            }
          },
        }
      );

      // Handle WebSocket events
      ws.on("close", async () => {
        console.log(`[TerminalService] 🔌 连接关闭, 用户ID: ${userid}`);
        await sessionManager.terminateSession(session);
      });

      ws.on("error", async (error) => {
        console.error(`[TerminalService] ❌ WebSocket错误, 用户ID: ${userid}:`, error);
        await sessionManager.terminateSession(session);
      });

      stream.on("end", async () => {
        console.log(`[TerminalService] 📤 流结束, 用户ID: ${userid}`);
        await sessionManager.terminateSession(session);
      });

      stream.on("error", async (error) => {
        console.error(`[TerminalService] ❌ 流错误, 用户ID: ${userid}:`, error);
        await sessionManager.terminateSession(session);
      });

    } catch (error) {
      console.error(`[TerminalService] ❌ 终端连接失败, 用户ID: ${userid}:`, error);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1011);
      }
      if (container) {
        try {
          await container.remove({ force: true });
        } catch (removeError) {
          if (removeError.statusCode !== 409) {
            console.error(`[TerminalService] ❌ 删除容器失败, 用户ID: ${userid}:`, removeError);
          }
        }
      }
    }
  }

  async prepareExec(container) {
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["/bin/bash"],
      Env: [
        "TERM=xterm-256color",
        "PS1=\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ "
      ]
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
    });

    // Send initial commands to setup environment
    const setupCommands = [
      "export TERM=xterm-256color\n",
      "export PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '\n",
      "clear\n"
    ];

    for (const cmd of setupCommands) {
      stream.write(cmd);
    }

    return stream;
  }
}

const terminalService = new TerminalService();
module.exports = { terminalService };
