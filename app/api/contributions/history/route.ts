import { listReviewedContributions } from "@/lib/repository/contributionStore";

export const runtime = "nodejs";

// Phase 7.1：審核紀錄，列出已核准／已駁回的投稿與審核者歸屬。
// 受 proxy.ts 的 /api/contributions/:path* 規則保護（這裡沒有 status=APPROVED
// 這個公開豁免的查詢參數，needsAuth() 會判定需要登入，不需要額外調整 matcher）。

export async function GET() {
  const clips = await listReviewedContributions();
  return Response.json(clips);
}
