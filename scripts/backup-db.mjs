// 資料庫備份（Phase 7.3）。對應路線圖「資料庫備份策略尚未建立」的已知限制。
// 把 DATABASE_URL 指向的資料庫用 pg_dump 匯出成純文字 SQL，再用 gzip 壓縮，
// 存到 data/backups/（執行期資料，已加入 .gitignore，需自行負責搬到異地備份，
// 這支腳本只處理「產生備份檔」，不處理上傳到其他地方）。
//
// 用法：
//   pnpm run db:backup                          # 備份＋依保留天數清舊檔
//   BACKUP_RETENTION_DAYS=30 pnpm run db:backup  # 自訂保留天數（預設 14 天）
//
// 還原方式（正式環境要用時參考，見 配音擂台-infra.md）：
//   gunzip -c data/backups/<檔名>.sql.gz | psql "$DATABASE_URL"
//
// 建議用 crontab 排程，例如每天凌晨 2 點（比 exports:cleanup 的 3 點早一小時，
// 避免同時大量讀寫磁碟）：
//   0 2 * * * cd /root/dub-arena && pnpm run db:backup >> /var/log/dub-arena-backup.log 2>&1
//
// 密碼刻意不透過 pg_dump 的命令列參數傳遞（避免短暫出現在 `ps aux` 這類行程列表），
// 改用 PGPASSWORD 環境變數，這是 pg_dump／psql 官方支援的標準做法。

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { loadEnvFile } from "./loadEnv.mjs";

const execFileAsync = promisify(execFile);

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "..", "data", "backups");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL 環境變數，請先設定後再執行此腳本。");
  process.exit(1);
}

let dbUrl;
try {
  dbUrl = new URL(connectionString);
} catch {
  console.error("DATABASE_URL 格式不正確，應為 postgresql://user:password@host:port/database。");
  process.exit(1);
}

const host = dbUrl.hostname;
const port = dbUrl.port || "5432";
const user = decodeURIComponent(dbUrl.username);
const password = decodeURIComponent(dbUrl.password);
const database = dbUrl.pathname.replace(/^\//, "");

if (!host || !user || !database) {
  console.error("DATABASE_URL 缺少必要欄位（host／user／database）。");
  process.exit(1);
}

const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? "14");
if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
  console.error("BACKUP_RETENTION_DAYS 必須是正數。");
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

// 檔名用 UTC 時間戳記，避免正式機時區設定不同造成排序或比對上的困惑。
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const sqlPath = path.join(BACKUP_DIR, `${database}-${timestamp}.sql`);
const gzPath = `${sqlPath}.gz`;

try {
  await execFileAsync(
    "pg_dump",
    ["-h", host, "-p", port, "-U", user, "-d", database, "-f", sqlPath, "--no-password"],
    { env: { ...process.env, PGPASSWORD: password } }
  );

  await execFileAsync("gzip", ["-f", sqlPath]);

  if (!existsSync(gzPath)) {
    throw new Error("gzip 完成後找不到預期的輸出檔案，備份可能失敗。");
  }

  const sizeMb = (statSync(gzPath).size / 1024 / 1024).toFixed(2);
  console.log(`備份完成：${gzPath}（約 ${sizeMb}MB）`);
} catch (err) {
  console.error("備份失敗：", err.message ?? err);
  process.exit(1);
}

// 依保留天數清除舊備份，邏輯跟 cleanup-exports.mjs 一致（用 atime／mtime 取較新者，
// 但備份檔通常不會被「讀取」，這裡主要還是靠 mtime）。
let deleted = 0;
const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
for (const file of readdirSync(BACKUP_DIR)) {
  if (!file.endsWith(".sql.gz")) continue;
  const filePath = path.join(BACKUP_DIR, file);
  const stat = statSync(filePath);
  const lastTouched = Math.max(stat.atimeMs, stat.mtimeMs);
  if (lastTouched < cutoffMs) {
    unlinkSync(filePath);
    deleted++;
  }
}
if (deleted > 0) {
  console.log(`清理完成：刪除 ${deleted} 個超過 ${retentionDays} 天的舊備份。`);
}
