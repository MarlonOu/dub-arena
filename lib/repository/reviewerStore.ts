import { randomUUID } from "crypto";
import { getPool } from "@/lib/db/pool";

// 伺服器端專用（登入 API／管理介面／建帳號腳本呼叫），不得被 client component 匯入。
// Phase 7：審核者帳號，取代單一共用密碼的 Basic Auth。
// Phase 7.2：加上 active 旗標（軟停用）與管理介面用的查詢／更新函式。
// Phase 7.8：加上 role 角色區分（admin／reviewer），見 db/migrations/004_reviewer_role.sql。

export type ReviewerRole = "admin" | "reviewer";

interface ReviewerRow {
  id: string;
  username: string;
  password_hash: string;
  active: boolean;
  role: ReviewerRole;
}

interface ReviewerListRow {
  id: string;
  username: string;
  active: boolean;
  role: ReviewerRole;
  created_at: string;
}

export interface ReviewerSummary {
  id: string;
  username: string;
  active: boolean;
  role: ReviewerRole;
  createdAt: string;
}

export async function findReviewerByUsername(
  username: string
): Promise<{
  id: string;
  username: string;
  passwordHash: string;
  active: boolean;
  role: ReviewerRole;
} | null> {
  const pool = getPool();
  const { rows } = await pool.query<ReviewerRow>(
    "SELECT id, username, password_hash, active, role FROM reviewers WHERE username = $1",
    [username]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    active: row.active,
    role: row.role,
  };
}

// 建立新帳號，或帳號已存在時重設密碼並重新啟用（跟 scripts/create-reviewer.mjs
// 的 ON CONFLICT DO UPDATE 邏輯一致：重設密碼隱含「這個帳號現在應該可以用」的意思，
// 所以連同 active 一起設回 true，管理介面「重設密碼」跟腳本操作行為才會一致）。
// 刻意不在 ON CONFLICT 時更新 role：避免「重設密碼」這個操作意外把已經被管理員
// 手動調整過的角色覆蓋回預設值，角色調整只能透過 setReviewerRole() 明確進行。
// role 只在「真的是新帳號」時套用，帳號已存在時沿用既有角色。
export async function createReviewer(
  username: string,
  passwordHash: string,
  role: ReviewerRole = "reviewer"
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO reviewers (id, username, password_hash, created_at, active, role)
     VALUES ($1, $2, $3, $4, true, $5)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true`,
    [randomUUID(), username, passwordHash, new Date().toISOString(), role]
  );
}

export async function listReviewers(): Promise<ReviewerSummary[]> {
  const pool = getPool();
  const { rows } = await pool.query<ReviewerListRow>(
    "SELECT id, username, active, role, created_at FROM reviewers ORDER BY created_at ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    active: r.active,
    role: r.role,
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

// Phase 7.8：切換帳號角色（admin／reviewer）。呼叫端（PATCH /api/admin/reviewers/[username]）
// 負責擋下「把自己降級」的情境，這裡只單純寫入，不含業務邏輯判斷。
export async function setReviewerRole(username: string, role: ReviewerRole): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query("UPDATE reviewers SET role = $1 WHERE username = $2", [
    role,
    username,
  ]);
  return (result.rowCount ?? 0) > 0;
}
