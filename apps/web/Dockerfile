# apps/web/Dockerfile
FROM node:18-alpine AS builder

RUN npm install -g pnpm
WORKDIR /app

# Copy toàn bộ source code
COPY . .

# Install Dependencies
RUN pnpm install --frozen-lockfile

# Nhận biến môi trường lúc build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js (Lúc này nó sẽ tạo ra folder .next/standalone)
RUN pnpm --filter @freshsync/web build

# --- Production Image ---
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy file standalone (Đã bao gồm cả node_modules cần thiết rút gọn)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static files để browser tải ảnh/css/js
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy folder public (Logo, favicon...)
COPY --from=builder /app/apps/web/public ./apps/web/public

# Chạy server.js (File khởi động siêu nhẹ do Next.js tạo ra)
CMD ["node", "apps/web/server.js"]