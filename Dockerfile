FROM node:22-slim

# 设置工作目录
WORKDIR /app

# 安装基本工具
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制package文件
COPY package*.json ./


# 安装依赖
RUN npm install

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]