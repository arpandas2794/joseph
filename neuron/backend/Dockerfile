FROM node:22-bullseye-slim

WORKDIR /app

# Install ffmpeg and python3 (required for audio extraction and yt-dlp)
# Also install curl to download the Linux binary
RUN apt-get update && apt-get install -y ffmpeg python3 curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Download the Linux version of yt-dlp and replace the Mac one
RUN mkdir -p bin && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o bin/yt-dlp && \
    chmod a+rx bin/yt-dlp

# Build the TypeScript code
RUN npm run build

# Start the server
CMD ["npm", "start"]
