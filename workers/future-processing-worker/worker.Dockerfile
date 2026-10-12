FROM node:20-bullseye

# Run as non-root user for security
RUN useradd -m worker
WORKDIR /home/worker/app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    imagemagick \
    libreoffice \
    pandoc \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Switch to worker user
USER worker

# Copy package files (Placeholder)
# COPY package.json pnpm-lock.yaml ./
# RUN pnpm install --frozen-lockfile

# Copy application files (Placeholder)
# COPY . .

CMD ["node", "dist/index.js"]
