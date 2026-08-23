import {
  setReviewerActive,
  setReviewerRole,
  updateReviewerPassword,
  type ReviewerRole,
} from "@/lib/repository/reviewerStore";
import { hashPassword } from "@/lib/auth/password";
import { getCurrentActor } from "@/lib/auth/authorize";

export const runtime = "nodejs";

// Phase 7.2：停用／啟用單一審核者帳號，或重設其密碼。
// Phase 7.8：加上角色切換，並把整支 API 改成僅限管理員（admin 角色，或 Basic Auth
// 備援帳密）呼叫，見 lib/auth/authorize.ts 的說明。
//
// body 帶 { active: boolean } 表示切換啟用狀態，{ password: string } 表示重設密碼，
// { role: "admin" | "reviewer" } 表示變更角色，三者只會出現其中一種（前端管理介面
// 分成三個獨立操作，不會同時送出）。
//
// 已知限制：停用帳號只會擋住「之後的登入」，不會讓已經簽發出去、還沒過期的
// session cookie 立即失效（session 驗證只查簽章跟到期時間，不查資料庫，見
// lib/auth/session.ts 的設計說明），需要立即全面撤銷的話目前只能重設
// SESSION_SECRET（但那會讓所有審核者的 session 一起失效，不是只有被停用的那個）。

const VALID_ROLES: ReviewerRole[] = ["admin", "reviewer"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const actor = await getCurrentActor();
  if (actor.role !== "admin") {
    return Response.json({ error: "只有管理員可以管理審核者帳號" }, { status: 403 });
  }

  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);
  const body = await request.json().catch(() => null);

  if (typeof body?.active === "boolean") {
    if (!body.active && actor.username === username) {
      return Response.json(
        { error: "不能停用目前登入中的帳號，請用其他管理員帳號操作" },
        { status: 400 }
      );
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

  if (typeof body?.role === "string") {
    if (!VALID_ROLES.includes(body.role as ReviewerRole)) {
      return Response.json({ error: "role 必須是 admin 或 reviewer" }, { status: 400 });
    }
    // 只擋「把自己從 admin 降級」，不擋「把自己從 reviewer 升級成 admin」
    // （後者不會造成任何鎖死風險）。Basic Auth 備援帳密（actor.isNamedReviewer
    // 為 false）不對應任何 reviewers 資料列，這條防呆天生不會誤觸中它。
    if (actor.isNamedReviewer && actor.username === username && body.role !== "admin") {
      return Response.json(
        { error: "不能把自己降級，請用其他管理員帳號操作" },
        { status: 400 }
      );
    }
    const updated = await setReviewerRole(username, body.role as ReviewerRole);
    if (!updated) {
      return Response.json({ error: "找不到這個帳號" }, { status: 404 });
    }
    return Response.json({ username, role: body.role });
  }

  return Response.json({ error: "請提供 active、password 或 role 欄位" }, { status: 400 });
}
