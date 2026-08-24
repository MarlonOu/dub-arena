// Phase 7.12：Route Handler 統一錯誤處理外層。
//
// 起因：稽核發現本專案的 Route Handler 幾乎都沒有頂層 try/catch——資料庫查詢
// （`pg` 套件丟出的原始錯誤，可能包含資料表／欄位名稱、失敗的 SQL 片段）、
// 檔案系統操作（`fs` 錯誤訊息常包含完整硬碟路徑，例如
// `ENOENT: open '/root/dub-arena/data/uploads/xxx'`）等，一旦拋出例外，
// 會直接穿透到 Next.js 內建的例外處理機制，而不是這個專案自己控制、乾淨的
// JSON 錯誤格式。這件事在 `next dev`（開發模式）下會把詳細錯誤內容回傳給
// 呼叫端；正式環境（`NODE_ENV=production`）預設行為較保守，但不應該依賴
// 框架預設值而不自己把關——不管環境為何、不管是不是真的走到會外洩細節的
// 那條路徑，都應該明確控制錯誤回應的內容，這裡補上這一層。
//
// 用法：export const GET = withErrorHandling(async (request) => { ... });
// 泛型直接轉發原始參數（`Request`、`{ params }` 等 Next.js 16 的 async params
// 皆可），不假設特定的 Route Handler 簽名，讓無參數／有 request／有動態路由
// params 的各種寫法都能套用同一個外層，呼叫端行為（成功時的回傳值）完全不變。

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<Response>;

export function withErrorHandling<Args extends unknown[]>(
  handler: RouteHandler<Args>
): RouteHandler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      // 真正的錯誤內容（可能含資料庫／檔案系統細節）只寫進伺服器端日誌，
      // 絕不原樣回傳給呼叫端；呼叫端一律收到不含任何內部細節的通用訊息。
      console.error("未預期的伺服器錯誤：", err);
      return Response.json(
        { error: "伺服器發生未預期的錯誤，請稍後再試" },
        { status: 500 }
      );
    }
  };
}
