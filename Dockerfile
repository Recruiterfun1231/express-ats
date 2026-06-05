FROM node:20-alpine

WORKDIR /app

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy pre-built frontend
COPY client/dist ./client/dist

# Copy server source code
COPY server ./server

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
