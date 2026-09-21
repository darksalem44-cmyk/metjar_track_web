import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // التطبيق صفحة واحدة (SPA): توجيه كل المسارات إلى الصفحة الرئيسية
    // حتى تعمل الروابط المباشرة وتحديث الصفحة على /stores أو /products...
    // (تُفحص الملفات الثابتة في _next وpublic قبل هذه القاعدة)
    return [{ source: "/:path*", destination: "/" }];
  },
};

export default nextConfig;
