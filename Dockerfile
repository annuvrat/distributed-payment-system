FROM node:20-alpine

WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (if schema exists)
RUN npx prisma generate || true

EXPOSE 3000

CMD ["npx", "tsx", "index.ts"]
