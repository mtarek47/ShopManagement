FROM node:20-bookworm-slim

# Install system dependencies required by Prisma and pg_dump
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY database/package*.json ./database/
COPY backend/package*.json ./backend/

# Install database packages & backend packages
WORKDIR /app/database
RUN npm install

WORKDIR /app/backend
RUN npm install

# Copy source trees
WORKDIR /app
COPY database ./database
COPY backend ./backend
COPY scripts ./scripts

# Generate Prisma Client and sync with backend
WORKDIR /app/database
RUN npx prisma generate --schema=schema.prisma && \
    mkdir -p /app/backend/node_modules/.prisma && \
    cp -r /app/database/node_modules/.prisma /app/backend/node_modules/ && \
    cp -r /app/database/node_modules/@prisma /app/backend/node_modules/

# Set up entrypoint script
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /app/backend

EXPOSE 5000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
