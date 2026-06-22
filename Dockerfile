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

COPY prod-start.sh ./
RUN chmod +x ./prod-start.sh

CMD ["./prod-start.sh"]


