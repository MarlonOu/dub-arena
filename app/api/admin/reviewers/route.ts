import { createReviewer, listReviewers } from "@/lib/repository/reviewerStore";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

// Phase 7.2：審核者帳號管理介面的後端。取代 Phase 7 時「只能跑
// scripts/create-reviewer.mjs 建帳號」的已知限制。
// 保護規則見 proxy.ts（跟 /admin 頁面同一組驗證，session 或 Basic Auth 任一通過即可，
// 沒有額外的「管理員／一般審核者」角色區分——目前規模下所有審核者都能互相管理帳號，
// 這是刻意簡化，見路線圖已知限制）。

export async function GET() {
  const reviewers = await listReviewers();
  return Response.json(reviewers);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username) {
    return Response.json({ error: "請輸入帳號" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "密碼長度至少 8 碼" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  // createReviewer 是 upsert：帳號已存在時視同重設密碼＋重新啟用，跟
  // scripts/create-reviewer.mjs 的既有行為一致，見 reviewerStore.ts 的說明。
  await createReviewer(username, passwordHash);
  const reviewers = await listReviewers();
  const created = reviewers.find((r) => r.username === username);
  return Response.json(created, { status: 201 });
}
