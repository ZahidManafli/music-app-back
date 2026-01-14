# Use Node.js LTS with Alpine for smaller image
FROM node:20-alpine

# Install yt-dlp, ffmpeg, python, and curl for health checks
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (Render will use PORT env variable)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Health check using curl (more reliable on Render)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
