import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

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

  // /admin/login 本身不受保護，否則沒登入的人連登入頁面都進不去，會死循環
  if (pathname === "/admin/login") return false;
  if (pathname.startsWith("/admin")) return true;

  if (pathname.startsWith("/api/contributions")) {
    if (request.method === "POST") return false;
    if (request.method === "GET") {
      return searchParams.get("status") !== "APPROVED";
    }
    return true; // PATCH／DELETE 等其他方法一律需要登入
  }

  // Phase 7.2：審核者帳號管理 API，跟 /admin 頁面同一組驗證規則。
  // 注意這裡刻意跟 /api/admin/login、/api/admin/logout 分開判斷（那兩支不受保護），
  // 不能直接寫成 pathname.startsWith("/api/admin") 否則會連登入本身都被擋住。
  if (pathname.startsWith("/api/admin/reviewers")) return true;

  return false;
}

export async function proxy(request: NextRequest) {
  if (!needsAuth(request)) {
    return NextResponse.next();
  }

  // Phase 7：具名審核者帳號（session cookie）優先於 Basic Auth 檢查，兩種方式
  // 任一通過即放行，ADMIN_USER／ADMIN_PASSWORD 仍保留作為備援登入方式，
  // 不會因為導入審核者帳號系統而失效（見 配音擂台-04-roadmap.md Phase 7）。
  const sessionSecret = process.env.SESSION_SECRET;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionSecret && sessionToken) {
    const username = await verifySession(sessionToken, sessionSecret);
    if (username) {
      return NextResponse.next();
    }
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
  matcher: [
    "/admin/:path*",
    "/api/contributions",
    "/api/contributions/:path*",
    "/api/admin/reviewers",
    "/api/admin/reviewers/:path*",
  ],
};
