// 清理 data/exports/（Phase 6 匯出的 mp4）裡太久沒被存取的檔案。
// 對應路線圖已知限制：匯出功能目前沒有自動清理機制，磁碟用量會持續成長。
//
// 用法：
//   pnpm run exports:cleanup                    # 預設清掉超過 7 天的檔案
//   MAX_AGE_DAYS=14 pnpm run exports:cleanup     # 自訂天數
//
// 用「最後存取時間」（atime）而非建立時間判斷，理由：玩家可能在匯出後很久才
// 回來下載，用 mtime／建立時間清理會誤刪還沒被下載過的檔案；atime 在多數
// Linux 檔案系統的預設掛載選項下會在讀取時更新（relatime），足夠這裡的用途。
// 不依賴額外套件，建議用 crontab 排程呼叫，例如每天凌晨跑一次：
//   0 3 * * * cd /root/dub-arena && DATABASE_URL=... pnpm run exports:cleanup >> /var/log/dub-arena-cleanup.log 2>&1
// （crontab 環境變數不會自動讀 .env，這支腳本本身不需要 DATABASE_URL，上面範例
// 只是提醒：任何要排程的指令都要注意 cron 底下沒有互動式 shell 的 .env 載入行為）

import { readdirSync, statSync, unlinkSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, "..", "data", "exports");

const maxAgeDays = Number(process.env.MAX_AGE_DAYS ?? "7");
if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
  console.error("MAX_AGE_DAYS 必須是正數。");
  process.exit(1);
}
const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

let files;
try {
  files = readdirSync(EXPORT_DIR);
} catch (err) {
  if (err.code === "ENOENT") {
    console.log(`${EXPORT_DIR} 不存在，沒有東西可清理。`);
    process.exit(0);
  }
  throw err;
}

let deleted = 0;
let keptBytes = 0;

for (const file of files) {
  const filePath = path.join(EXPORT_DIR, file);
  const stat = statSync(filePath);
  const lastAccessed = Math.max(stat.atimeMs, stat.mtimeMs);
  if (lastAccessed < cutoffMs) {
    unlinkSync(filePath);
    deleted++;
  } else {
    keptBytes += stat.size;
  }
}

console.log(
  `清理完成：刪除 ${deleted} 個超過 ${maxAgeDays} 天未存取的檔案，保留 ${files.length - deleted} 個（約 ${Math.round(keptBytes / 1024 / 1024)}MB）。`
);
