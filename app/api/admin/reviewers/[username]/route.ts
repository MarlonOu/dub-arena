import { setReviewerActive, updateReviewerPassword } from "@/lib/repository/reviewerStore";
import { hashPassword } from "@/lib/auth/password";
import { identifyActor } from "@/lib/auth/identifyActor";

export const runtime = "nodejs";

// Phase 7.2：停用／啟用單一審核者帳號，或重設其密碼。
// body 帶 { active: boolean } 表示切換啟用狀態，帶 { password: string } 表示重設密碼，
// 兩者只會出現其中一種（前端管理介面分成兩個獨立操作，不會同時送出）。
//
// 已知限制：停用帳號只會擋住「之後的登入」，不會讓已經簽發出去、還沒過期的
// session cookie 立即失效（session 驗證只查簽章跟到期時間，不查資料庫，見
// lib/auth/session.ts 的設計說明），需要立即全面撤銷的話目前只能重設
// SESSION_SECRET（但那會讓所有審核者的 session 一起失效，不是只有被停用的那個）。

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);
  const body = await request.json().catch(() => null);

  if (typeof body?.active === "boolean") {
    if (!body.active) {
      const actor = await identifyActor();
      if (actor === username) {
        return Response.json(
          { error: "不能停用目前登入中的帳號，請用其他審核者帳號操作" },
          { status: 400 }
        );
      }
    }
    const updated = await setReviewerActive(username, body.active);
    if (!updated) {
      return Response.json({ error: "找不到這個帳號" }, { status: 404 });
    }
    return Response.json({ username, active: body.active });
  }

  if (typeof body?.password === "string") {
    if (body.password.length < 8) {
      return Response.json({ error: "密碼長度至少 8 碼" }, { status: 400 });
    }
    const passwordHash = hashPassword(body.password);
    const updated = await updateReviewerPassword(username, passwordHash);
    if (!updated) {
      return Response.json({ error: "找不到這個帳號" }, { status: 404 });
    }
    return Response.json({ username, passwordReset: true });
  }

  return Response.json({ error: "請提供 active 或 password 欄位" }, { status: 400 });
}
