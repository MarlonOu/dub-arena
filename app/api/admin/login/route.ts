import { findReviewerByUsername } from "@/lib/repository/reviewerStore";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, sessionCookieMaxAge, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

// Phase 7：具名審核者帳號登入，取代單一共用密碼的 Basic Auth（見 proxy.ts 說明，
// ADMIN_USER／ADMIN_PASSWORD 仍保留作為備援）。成功後發一個簽章過的 session cookie，
// 之後由 proxy.ts 驗證，不需每次請求都查資料庫。

export async function POST(request: Request) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return Response.json(
      { error: "伺服器尚未設定 SESSION_SECRET，此登入方式暫時無法使用，請改用 Basic Auth" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return Response.json({ error: "請輸入帳號與密碼" }, { status: 400 });
  }

  const reviewer = await findReviewerByUsername(username);
  if (!reviewer || !verifyPassword(password, reviewer.passwordHash)) {
    return Response.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

  const token = await signSession(reviewer.username, sessionSecret);

  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const response = Response.json({ username: reviewer.username });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionCookieMaxAge}${secureFlag}`
  );
  return response;
}
