FROM ubuntu:22.04

# 避免交互式提示
ENV DEBIAN_FRONTEND=noninteractive

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装基础工具和依赖
RUN apt-get update && apt-get install -y \
    sudo \
    curl \
    wget \
    git \
    vim \
    bash \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    zsh \
    tmux \
    htop \
    tree \
    jq \
    unzip \
    openssh-client \
    postgresql-client \
    redis-tools \
    make \
    gcc \
    g++ \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libncursesw5-dev \
    xz-utils \
    tk-dev \
    libxml2-dev \
    libxmlsec1-dev \
    libffi-dev \
    liblzma-dev \
    # Ruby 依赖
    libyaml-dev \
    libgmp-dev \
    && rm -rf /var/lib/apt/lists/*

# 创建非root用户
RUN useradd -m -s /bin/bash zerocat \
    && echo "zerocat ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/zerocat \
    && chmod 0440 /etc/sudoers.d/zerocat

# 设置工作目录
WORKDIR /home/zerocat

# 安装 asdf 版本管理器
USER zerocat
RUN git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.13.1

# 配置 asdf
RUN echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc && \
    echo '. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc

# 使用 asdf 安装编程语言
SHELL ["/bin/bash", "-l", "-c"]

# 添加 asdf 插件
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf plugin add python && \
    asdf plugin add nodejs && \
    asdf plugin add ruby && \
    asdf plugin add golang && \
    asdf plugin add rust && \
    asdf plugin add java

# 安装 Python
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf install python latest:2.7 && \
    asdf install python latest:3.11 && \
    asdf install python latest:3.12 && \
    asdf install python latest:3.13 && \
    asdf global python latest:3.11

# 安装 Node.js
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf install nodejs latest:18 && \
    asdf install nodejs latest:20 && \
    asdf install nodejs latest:22 && \
    asdf install nodejs latest:24 && \
    asdf global nodejs latest:24

# 安装 TypeScript 和 ts-node
RUN . "$HOME/.asdf/asdf.sh" && \
    npm install -g typescript ts-node

# 安装 Ruby
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf install ruby latest:3.4 && \
    asdf global ruby latest:3.4

# 安装 Golang
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf install golang latest:1.24 && \
    asdf global golang latest:1.24

# 安装 Rust
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf install rust latest:1.88 && \
    asdf global rust latest:1.88

# 安装 Java
RUN . "$HOME/.asdf/asdf.sh" && \
    asdf install java openjdk-17 && \
    asdf install java openjdk-21 && \
    asdf install java openjdk-24 && \
    asdf global java openjdk-24

# 安装 Python 包
RUN . "$HOME/.asdf/asdf.sh" && \
    pip install --upgrade pip && \
    pip install ipython poetry virtualenv black flake8 mypy pytest requests

# 设置权限
USER root
RUN chown -R zerocat:zerocat /home/zerocat

# 切换到非root用户
USER zerocat

# 设置SHELL环境变量
ENV SHELL=/bin/bash

# 配置终端
RUN echo 'export PS1="\[\e[01;32m\]\u@\h\[\e[0m\]:\[\e[01;34m\]\w\[\e[0m\]\$ "' >> ~/.bashrc

# 设置容器启动命令
CMD ["/bin/bash", "-l"]