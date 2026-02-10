# apps/api/Dockerfile
FROM node:18-alpine AS builder

RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# 1. Generate Prisma & Build
RUN pnpm --filter @freshsync/api db:generate
RUN pnpm --filter @freshsync/api build

# 2. Deploy node_modules
RUN pnpm --filter @freshsync/api --prod deploy /app/pruned --legacy

# 3. CHIẾN DỊCH "GIẢI CỨU" .PRISMA
# Tìm bất kỳ folder nào tên là ".prisma" nằm trong node_modules
# Copy nội dung của nó ra /app/prisma-save
RUN mkdir -p /app/prisma-save && \
    PRISMA_PATH=$(find /app -type d -name ".prisma" | grep "node_modules/.prisma" | head -n 1) && \
    echo "✅ FOUND PRISMA ARTIFACT AT: $PRISMA_PATH" && \
    cp -r "$PRISMA_PATH"/* /app/prisma-save/

# --- Production Image ---
FROM node:18-alpine AS runner

RUN apk add --no-cache openssl procps
WORKDIR /app
ENV NODE_ENV=production

# 1. Copy node_modules sạch
COPY --from=builder /app/pruned/node_modules ./node_modules
COPY --from=builder /app/pruned/package.json ./package.json

# 2. KHÔI PHỤC .PRISMA TỪ CHỖ AN TOÀN
COPY --from=builder /app/prisma-save ./node_modules/.prisma

# 3. Copy Prisma Schema
COPY --from=builder /app/apps/api/prisma ./prisma

# 4. Copy Source Code (dist/src/main.js)
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 4000

# 5. Chạy
CMD ["node", "dist/src/main.js"]