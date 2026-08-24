// Phase 7.10：/api/contributions 的 POST 一直是公開端點（proxy.ts 刻意放行，
// 任何人都能投稿），Phase 7.9 補上了「單筆投稿內容合不合理」的長度／段落數量
// 上限，但完全沒有處理「同一個來源短時間內灌大量投稿」的問題——即使每筆投稿
// 都在 Phase 7.9 的上限內，反覆送出仍然可以塞爆審核佇列、佔用磁碟空間。這裡
// 補上簡單的滑動視窗（sliding window）IP 層級限流，見路線圖已知限制。
//
// **刻意選擇記憶體內狀態，不是資料庫表**：這個專案只有單一 Next.js process
// （systemd 長駐服務，非多實例水平擴展，見 配音擂台-infra.md），限流狀態不需要
// 跨行程共享，用 Map 比多一張表、每次投稿多兩次資料庫查詢（讀取＋寫入）簡單
// 且沒有額外資料庫負載。**已知取捨**：伺服器重啟（部署／`systemctl restart`）
// 會讓所有限流狀態歸零，理論上惡意來源可以靠反覆觸發部署繞過限制，但這在
// 目前的威脅模型下不是實際風險（部署不是使用者能觸發的動作）。若之後這個專案
// 改成多實例部署，這裡需要換成資料庫或 Redis 等跨行程共享的儲存，屆時再處理。

const WINDOW_MS = 10 * 60 * 1000; // 10 分鐘
export const MAX_SUBMISSIONS_PER_WINDOW = 5;

const submissionsByIp = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  /** 超過限制時，還要等幾秒視窗內最舊的一筆才會過期，供 Retry-After 標頭使用。 */
  retryAfterSeconds?: number;
}

/**
 * 檢查並記錄一次投稿嘗試。`now` 可選填（預設 `Date.now()`），主要是讓測試能
 * 注入固定時間點驗證視窗邊界，不必真的等待 10 分鐘（見本檔案的獨立測試腳本）。
 */
export function checkSubmissionRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const timestamps = submissionsByIp.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    submissionsByIp.set(ip, recent);
    const oldest = recent[0];
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  submissionsByIp.set(ip, recent);

  // 機率性地順便清掉「視窗內已經沒有任何紀錄」的其他 IP，避免 Map 隨著不同
  // 來源 IP 數量無限成長（公開網站訪客多半只出現一次）。不用額外的
  // setInterval 長駐計時器，避免長駐計時器在測試／重新載入模組時的殘留問題，
  // 機率抓得夠低，不會讓單次請求平均延遲有感增加。
  if (Math.random() < 0.01) {
    pruneStaleEntries(now);
  }

  return { allowed: true };
}

function pruneStaleEntries(now: number): void {
  for (const [ip, timestamps] of submissionsByIp) {
    const recent = timestamps.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) {
      submissionsByIp.delete(ip);
    } else if (recent.length !== timestamps.length) {
      submissionsByIp.set(ip, recent);
    }
  }
}

/** 僅供測試使用：清空所有限流狀態，避免測試之間互相汙染。 */
export function __resetForTest(): void {
  submissionsByIp.clear();
}
