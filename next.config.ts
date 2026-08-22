import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts（middleware）預設只會緩衝請求 body 的前 10MB，超過就靜默截斷，
    // 導致 multipart FormData 邊界被切斷、後端 formData() 解析時丟未捕捉例外
    // （500，且沒有清楚錯誤訊息）——實測發現：投稿影片檔案一旦超過 10MB 就會
    // 遇到，即使 /api/contributions 這支 route 本身完全沒有走 proxy.ts 的驗證
    // 邏輯（POST 是公開的），請求還是會先經過 proxy 這一層被緩衝限制。
    // 調高到略大於 app/api/contributions/route.ts 的 MAX_VIDEO_BYTES（200MB），
    // 這是目前唯一會收大檔案的 Route Handler。
    proxyClientMaxBodySize: "220mb",
  },
};

export default nextConfig;
