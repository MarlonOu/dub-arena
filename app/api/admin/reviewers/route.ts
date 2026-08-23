import { createReviewer, listReviewers, type ReviewerRole } from "@/lib/repository/reviewerStore";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/authorize";

export const runtime = "nodejs";

// Phase 7.2：審核者帳號管理介面的後端。取代 Phase 7 時「只能跑
// scripts/create-reviewer.mjs 建帳號」的已知限制。
// 保護規則見 proxy.ts（跟 /admin 頁面同一組驗證，session 或 Basic Auth 任一通過即可）。
// Phase 7.8：加上角色區分，proxy.ts 只驗證「有沒有登入」，這裡額外驗證
// 「登入的這個帳號是不是管理員」——只有 admin 角色（或 Basic Auth 備援帳密，
// 見 lib/auth/authorize.ts 的說明）能查看／新增／管理帳號，一般 reviewer
// 角色會被擋在這支 API 外面，只能做審核（核准／駁回），不能動帳號本身。

const VALID_ROLES: ReviewerRole[] = ["admin", "reviewer"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "只有管理員可以查看審核者帳號清單" }, { status: 403 });
  }
  const reviewers = await listReviewers();
  return Response.json(reviewers);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "只有管理員可以新增審核者帳號" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const roleInput = typeof body?.role === "string" ? body.role : "reviewer";

  if (!username) {
    return Response.json({ error: "請輸入帳號" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "密碼長度至少 8 碼" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(roleInput as ReviewerRole)) {
    return Response.json({ error: "role 必須是 admin 或 reviewer" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  // createReviewer 是 upsert：帳號已存在時視同重設密碼＋重新啟用，role 只在
  // 真的新建帳號時套用，既有帳號的角色不會被這個操作覆蓋，見 reviewerStore.ts 的說明。
  await createReviewer(username, passwordHash, roleInput as ReviewerRole);
  const reviewers = await listReviewers();
  const created = reviewers.find((r) => r.username === username);
  return Response.json(created, { status: 201 });
}
