// Phase 5 資料庫初始化腳本。不依賴 psql 指令（伺服器不一定有裝 postgresql-client），
// 直接用專案本來就有的 pg 套件連線執行 SQL，讀取 DATABASE_URL 環境變數。
// 用法：node scripts/migrate.mjs（需先在 .env 或當前 shell 設定 DATABASE_URL）

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL 環境變數，請先設定後再執行此腳本。");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "..", "db", "migrations", "001_init.sql");
const sql = readFileSync(sqlPath, "utf-8");

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log("資料庫結構初始化完成（db/migrations/001_init.sql）");
} catch (err) {
  console.error("初始化失敗：", err);
  process.exit(1);
} finally {
  await client.end();
}
