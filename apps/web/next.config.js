/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // <--- QUAN TRỌNG: Thêm dòng này
  // Giữ nguyên các config khác nếu có
  transpilePackages: ["@freshsync/shared"], // Nếu bạn có dùng shared package
};

module.exports = nextConfig;