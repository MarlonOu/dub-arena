// 建立審核者帳號（Phase 7）。沒有自助註冊頁面，只能由伺服器管理員執行這支腳本。
// 用法（DATABASE_URL 會自動從 .env 讀取，不用重複打；REVIEWER_USERNAME／
// REVIEWER_PASSWORD 是一次性操作，刻意不放進 .env，每次呼叫時明確指定）：
//   REVIEWER_USERNAME=xxx REVIEWER_PASSWORD=yyy pnpm run reviewer:create
// 密碼雜湊用法跟 lib/auth/password.ts 一致（Node 內建 crypto.scrypt），
// 這支腳本刻意不 import lib/auth/password.ts 是因為那個檔案在 Next.js 專案結構下
// 用了 "@/" path alias，獨立腳本沒有走 Next.js 的 module resolver，直接複製一份
// 邏輯比較省事，兩邊要是修改雜湊方式記得一起改。

import { randomBytes, randomUUID, scryptSync } from "crypto";
import pg from "pg";
import { loadEnvFile } from "./loadEnv.mjs";

loadEnvFile();

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

const connectionString = process.env.DATABASE_URL;
const username = process.env.REVIEWER_USERNAME;
const password = process.env.REVIEWER_PASSWORD;

if (!connectionString) {
  console.error("缺少 DATABASE_URL 環境變數。");
  process.exit(1);
}
if (!username || !password) {
  console.error("請設定 REVIEWER_USERNAME 與 REVIEWER_PASSWORD 環境變數。");
  process.exit(1);
}
if (password.length < 8) {
  console.error("密碼長度至少 8 碼。");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const passwordHash = hashPassword(password);
  await client.query(
    `INSERT INTO reviewers (id, username, password_hash, created_at, active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true`,
    [randomUUID(), username, passwordHash, new Date().toISOString()]
  );
  console.log(`審核者帳號已建立／更新密碼：${username}`);
} catch (err) {
  console.error("建立失敗：", err);
  process.exit(1);
} finally {
  await client.end();
}
