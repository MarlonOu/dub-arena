// Phase 7.10：從請求標頭反推來源 IP，給 submissionRateLimiter 用。
//
// 正式環境走 Cloudflare Tunnel（見 配音擂台-infra.md），cloudflared 會在轉發給
// 本機 Next.js 之前設定 `CF-Connecting-IP`（Cloudflare 邊緣節點依實際 TCP 連線
// 來源填入，一般使用者端無法偽造覆蓋，因為進來的請求本來就是先到 Cloudflare
// 邊緣才轉發進來，cloudflared 會覆寫這個標頭，不是原樣轉發使用者自己送的值），
// 優先信任這個標頭。退而求其次看 `X-Forwarded-For`（第一個值），這個標頭理論上
// 使用者端可以自行偽造，但在沒有 CF-Connecting-IP 的情況下（例如本機開發測試、
// 直接對本機連接埠測試，沒有經過 Cloudflare）已經是能拿到的最佳資訊，這個
// 專案規模也不需要更嚴謹的信任鏈驗證。兩者都沒有時回傳 "unknown"，所有這類
// 請求會共用同一個限流桶——比起完全不做任何限制，這仍然是比較安全的方向。

export function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) {
    return cfConnectingIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}
