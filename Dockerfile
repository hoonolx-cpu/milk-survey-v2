FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

ENV NODE_ENV=production

# Render will provide PORT
EXPOSE 10000

CMD ["node", "server.js"]

