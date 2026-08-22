import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 保護管理後台頁面與投稿 API 中會洩漏未審核內容／可變更審核狀態的部分。
// Phase 4 尚無帳號系統（見資料模型文件，Account 要到連線功能才會導入），
// 先用 HTTP Basic Auth 擋著，比照既有猜歌遊戲專案 /admin 的保護方式
// （帳密讀取自 .env 的 ADMIN_USER／ADMIN_PASSWORD，同樣忽略大小寫並去除頭尾空白，
// 因應行動裝置輸入自動大寫的已知問題）。
//
// /api/contributions 的保護規則：
// - POST（送出新投稿）：公開，任何人都可以投稿
// - GET ?status=APPROVED：公開，題目瀏覽層要用
// - GET（無 status 或 status=PENDING／REJECTED）：需要登入，會洩漏未審核內容
// - PATCH（核准／駁回）：需要登入

function needsAuth(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/admin")) return true;

  if (pathname.startsWith("/api/contributions")) {
    if (request.method === "POST") return false;
    if (request.method === "GET") {
      return searchParams.get("status") !== "APPROVED";
    }
    return true; // PATCH／DELETE 等其他方法一律需要登入
  }

  return false;
}

export function proxy(request: NextRequest) {
  if (!needsAuth(request)) {
    return NextResponse.next();
  }

  const expectedUser = process.env.ADMIN_USER?.trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new NextResponse("管理後台尚未設定 ADMIN_USER／ADMIN_PASSWORD，拒絕存取", {
      status: 503,
    });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex).trim().toLowerCase();
    const password = decoded.slice(separatorIndex + 1);
    if (user === expectedUser && password === expectedPassword) {
      return NextResponse.next();
    }
  }

  return new NextResponse("需要登入才能存取", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="dub-arena-admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/contributions", "/api/contributions/:path*"],
};
