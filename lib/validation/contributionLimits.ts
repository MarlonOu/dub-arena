// Phase 7.9：投稿欄位長度／段落數量上限。
//
// /api/contributions 的 POST 一直是公開端點（任何人都能投稿，proxy.ts 特意放行，
// 見該檔案 needsAuth() 說明），先前只驗證「有沒有填」，完全沒驗證「填多長」
// 「填幾段」——理論上可以送出標題長達數萬字元的投稿，或是 AUDIO_PACK 帶幾千段
// 音檔的投稿（AUDIO_PACK 每一段都對應一個獨立檔案上傳，段數沒有上限等於磁碟
// I/O、檔案數量、審核佇列可讀性都沒有上限），這裡補上合理但寬鬆的上限，不影響
// 正常投稿情境（示範題庫最長的題目也只有個位數段落）。
//
// 這個檔案純數字常數，不含任何伺服器專用邏輯（不像 lib/repository/reviewerStore.ts
// 那樣不能被 client component 匯入），前端 app/contribute/page.tsx 與後端
// app/api/contributions/route.ts 共用同一份定義，避免兩邊各自硬編碼、之後改一邊
// 忘記改另一邊。前端的用途是及早擋下、給清楚提示（避免使用者填了一大段文字或
// 選了一堆檔案後才在送出當下被後端拒絕），後端的檢查才是真正的安全邊界——前端
// 檢查繞得過去（直接打 API），後端不會。

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTRIBUTOR_NAME_LENGTH = 100;
export const MAX_SUBTITLE_TEXT_LENGTH = 500;
export const MAX_LINES_PER_CLIP = 100;
