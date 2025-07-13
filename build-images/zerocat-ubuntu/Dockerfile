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
    && rm -rf /var/lib/apt/lists/*

# 创建非root用户
RUN useradd -m -s /bin/bash zerocat \
    && echo "zerocat ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/zerocat \
    && chmod 0440 /etc/sudoers.d/zerocat

# 设置工作目录
WORKDIR /home/zerocat

# 安装 pyenv
USER zerocat
RUN curl https://pyenv.run | bash
ENV PYENV_ROOT="/home/zerocat/.pyenv"
ENV PATH="$PYENV_ROOT/bin:$PATH"
RUN echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc && \
    echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc && \
    echo 'eval "$(pyenv init --path)"' >> ~/.bashrc && \
    echo 'eval "$(pyenv init -)"' >> ~/.bashrc

# 使用 pyenv 安装 Python 版本并安装包
SHELL ["/bin/bash", "-l", "-c"]
RUN pyenv install 3.8.18 && \
    pyenv install 3.11.8 && \
    pyenv global 3.11.8 && \
    eval "$(pyenv init -)" && \
    eval "$(pyenv init --path)" && \
    $PYENV_ROOT/versions/3.11.8/bin/python -m pip install --upgrade pip && \
    $PYENV_ROOT/versions/3.11.8/bin/python -m pip install \
    ipython \
    poetry \
    virtualenv \
    black \
    flake8 \
    mypy \
    pytest \
    requests

# 安装 nvm
ENV NVM_DIR="/home/zerocat/.nvm"
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install 16 \
    && nvm install 18 \
    && nvm alias default 18 \
    && nvm use default \
    && npm install -g yarn pnpm typescript ts-node

# 设置权限
USER root
RUN chown -R zerocat:zerocat /home/zerocat

# 切换到非root用户
USER zerocat

# 设置SHELL环境变量
ENV SHELL=/bin/bash

# 配置终端
RUN echo 'export PS1="\[\e[01;32m\]\u@\h\[\e[0m\]:\[\e[01;34m\]\w\[\e[0m\]\$ "' >> ~/.bashrc

# 添加环境变量到 .bashrc
RUN echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc \
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc \
    && echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> ~/.bashrc

# 设置容器启动命令
CMD ["/bin/bash", "-l"]