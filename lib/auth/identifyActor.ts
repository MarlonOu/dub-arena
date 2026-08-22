import { cookies, headers } from "next/headers";
import { verifySession, SESSION_COOKIE_NAME } from "./session";

// 伺服器端專用。給需要記錄「是誰做的」的 Route Handler 用（目前只有核准／駁回
// 投稿），從 session cookie 或 Basic Auth header 反推目前請求代表哪個帳號。
// 這裡不重新做安全驗證——proxy.ts 已經擋過一次，能執行到這支 Route Handler
// 代表請求已經通過驗證，這裡只是「順便問一下是誰」，驗證失敗就回傳 "unknown"，
// 不影響原本操作是否成功。

export async function identifyActor(): Promise<string> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret) {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const username = await verifySession(token, sessionSecret);
      if (username) return username;
    }
  }

  const hdrs = await headers();
  const authHeader = hdrs.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex).trim().toLowerCase();
    if (user) return user;
  }

  return "unknown";
}
