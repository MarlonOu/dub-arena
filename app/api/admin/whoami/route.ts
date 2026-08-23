import { getCurrentActor } from "@/lib/auth/authorize";

export const runtime = "nodejs";

// Phase 7.8：回報目前這次請求代表哪個帳號、什麼角色，給 /admin/reviewers
// 頁面判斷要不要顯示管理介面用（一般 reviewer 角色打管理 API 一樣會被
// 個別 API 擋下，這支只是讓前端能提早知道、不用等 403 才顯示訊息）。
// 受 proxy.ts 的 /api/admin/reviewers 系列規則保護（見該檔案 needsAuth()），
// 只要求「有沒有登入」，不要求角色，任何已登入的審核者都能問自己是誰。

export async function GET() {
  const actor = await getCurrentActor();
  return Response.json(actor);
}
