import type { NextRequest } from "next/server";
import {
  listReviewedContributions,
  HISTORY_DEFAULT_PAGE_SIZE,
  HISTORY_MAX_PAGE_SIZE,
} from "@/lib/repository/contributionStore";

export const runtime = "nodejs";

// Phase 7.1：審核紀錄，列出已核准／已駁回的投稿與審核者歸屬。
// 受 proxy.ts 的 /api/contributions/:path* 規則保護（這裡沒有 status=APPROVED
// 這個公開豁免的查詢參數，needsAuth() 會判定需要登入，不需要額外調整 matcher）。
// Phase 7.4：補上分頁（?page=1&pageSize=20），取代原本固定回傳最近 50 筆的做法。

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const requestedPageSize = parsePositiveInt(searchParams.get("pageSize"), HISTORY_DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, HISTORY_MAX_PAGE_SIZE);

  const result = await listReviewedContributions(page, pageSize);
  return Response.json(result);
}
