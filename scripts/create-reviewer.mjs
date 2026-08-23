// 建立審核者帳號（Phase 7）。沒有自助註冊頁面，只能由伺服器管理員執行這支腳本。
// 用法（DATABASE_URL 會自動從 .env 讀取，不用重複打；REVIEWER_USERNAME／
// REVIEWER_PASSWORD 是一次性操作，刻意不放進 .env，每次呼叫時明確指定）：
//   REVIEWER_USERNAME=xxx REVIEWER_PASSWORD=yyy pnpm run reviewer:create
// 密碼雜湊用法跟 lib/auth/password.ts 一致（Node 內建 crypto.scrypt），
// 這支腳本刻意不 import lib/auth/password.ts 是因為那個檔案在 Next.js 專案結構下
// 用了 "@/" path alias，獨立腳本沒有走 Next.js 的 module resolver，直接複製一份
// 邏輯比較省事，兩邊要是修改雜湊方式記得一起改。
//
// Phase 7.8：REVIEWER_ROLE（選填，"admin" 或 "reviewer"，預設 "reviewer"）只會
// 在「真的新建帳號」時套用，帳號已存在時沿用既有角色不變（跟 reviewerStore.ts
// 的 createReviewer() 行為一致，避免重設密碼時意外把角色覆蓋掉）。**全新部署、
// reviewers 表裡還沒有任何帳號時，第一次執行這支腳本務必加上
// REVIEWER_ROLE=admin，否則會建出一個誰都不能管理帳號的孤兒環境**（雖然
// ADMIN_USER／ADMIN_PASSWORD 的 Basic Auth 備援帳密永遠視同管理員，不會真的
// 被鎖死，但多一組具名管理員帳號還是比較方便）。既有部署（已跑過 Phase 7.2
// 之前版本）的帳號會在執行 db:migrate 套用 004_reviewer_role.sql 時全數
// 自動 backfill 成 admin，不需要重新用這支腳本設定角色。

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
const role = process.env.REVIEWER_ROLE || "reviewer";

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
if (role !== "admin" && role !== "reviewer") {
  console.error('REVIEWER_ROLE 必須是 "admin" 或 "reviewer"。');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const passwordHash = hashPassword(password);
  // ON CONFLICT 刻意不更新 role：帳號已存在時只當成「重設密碼」，角色沿用既有值，
  // 見上方檔案開頭的說明。role 只在真的新建帳號（VALUES 那一列）時套用。
  await client.query(
    `INSERT INTO reviewers (id, username, password_hash, created_at, active, role)
     VALUES ($1, $2, $3, $4, true, $5)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true`,
    [randomUUID(), username, passwordHash, new Date().toISOString(), role]
  );
  console.log(`審核者帳號已建立／更新密碼：${username}`);
} catch (err) {
  console.error("建立失敗：", err);
  process.exit(1);
} finally {
  await client.end();
}
