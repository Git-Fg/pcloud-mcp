# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (ignore scripts for supply chain security)
RUN npm ci --ignore-scripts

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Use non-root user
USER node

# Default to stdio mode; use "docker run -e MODE=http" for HTTP mode
ENTRYPOINT ["node", "dist/index.js"]

# Default to stdio; expose port for HTTP mode
CMD []