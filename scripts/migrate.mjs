// 資料庫初始化腳本。不依賴 psql 指令（伺服器不一定有裝 postgresql-client），
// 直接用專案本來就有的 pg 套件連線執行 SQL，讀取 DATABASE_URL 環境變數。
// 依檔名排序依序執行 db/migrations/ 底下所有 .sql 檔。每個檔案內都用
// CREATE TABLE IF NOT EXISTS／ADD COLUMN IF NOT EXISTS 寫成冪等操作，
// 重複執行整批檔案是安全的，不需要額外的「已套用哪些 migration」追蹤表。
// 用法：node scripts/migrate.mjs（需先在 .env 或當前 shell 設定 DATABASE_URL）

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL 環境變數，請先設定後再執行此腳本。");
  process.exit(1);
}

const migrationsDir = path.join(__dirname, "..", "db", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error(`${migrationsDir} 底下沒有任何 .sql 檔案。`);
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
    await client.query(sql);
    console.log(`已套用：${file}`);
  }
  console.log("資料庫結構初始化完成。");
} catch (err) {
  console.error("初始化失敗：", err);
  process.exit(1);
} finally {
  await client.end();
}
