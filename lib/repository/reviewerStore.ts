import { randomUUID } from "crypto";
import { getPool } from "@/lib/db/pool";

// 伺服器端專用（登入 API／管理介面／建帳號腳本呼叫），不得被 client component 匯入。
// Phase 7：審核者帳號，取代單一共用密碼的 Basic Auth。
// Phase 7.2：加上 active 旗標（軟停用）與管理介面用的查詢／更新函式。

interface ReviewerRow {
  id: string;
  username: string;
  password_hash: string;
  active: boolean;
}

interface ReviewerListRow {
  id: string;
  username: string;
  active: boolean;
  created_at: string;
}

export interface ReviewerSummary {
  id: string;
  username: string;
  active: boolean;
  createdAt: string;
}

export async function findReviewerByUsername(
  username: string
): Promise<{ id: string; username: string; passwordHash: string; active: boolean } | null> {
  const pool = getPool();
  const { rows } = await pool.query<ReviewerRow>(
    "SELECT id, username, password_hash, active FROM reviewers WHERE username = $1",
    [username]
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, passwordHash: row.password_hash, active: row.active };
}

// 建立新帳號，或帳號已存在時重設密碼並重新啟用（跟 scripts/create-reviewer.mjs
// 的 ON CONFLICT DO UPDATE 邏輯一致：重設密碼隱含「這個帳號現在應該可以用」的意思，
// 所以連同 active 一起設回 true，管理介面「重設密碼」跟腳本操作行為才會一致）。
export async function createReviewer(username: string, passwordHash: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO reviewers (id, username, password_hash, created_at, active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true`,
    [randomUUID(), username, passwordHash, new Date().toISOString()]
  );
}

export async function listReviewers(): Promise<ReviewerSummary[]> {
  const pool = getPool();
  const { rows } = await pool.query<ReviewerListRow>(
    "SELECT id, username, active, created_at FROM reviewers ORDER BY created_at ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    active: r.active,
    createdAt: r.created_at,
  }));
}

// 回傳是否真的有更新到一筆（帳號不存在時回 false，呼叫端可據此回 404）。
export async function setReviewerActive(username: string, active: boolean): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query("UPDATE reviewers SET active = $1 WHERE username = $2", [
    active,
    username,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateReviewerPassword(username: string, passwordHash: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query("UPDATE reviewers SET password_hash = $1 WHERE username = $2", [
    passwordHash,
    username,
  ]);
  return (result.rowCount ?? 0) > 0;
}
