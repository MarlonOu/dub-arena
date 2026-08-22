import { randomUUID } from "crypto";
import { getPool } from "@/lib/db/pool";

// 伺服器端專用（登入 API／建帳號腳本呼叫），不得被 client component 匯入。
// Phase 7：審核者帳號，取代單一共用密碼的 Basic Auth。

interface ReviewerRow {
  id: string;
  username: string;
  password_hash: string;
}

export async function findReviewerByUsername(
  username: string
): Promise<{ id: string; username: string; passwordHash: string } | null> {
  const pool = getPool();
  const { rows } = await pool.query<ReviewerRow>(
    "SELECT id, username, password_hash FROM reviewers WHERE username = $1",
    [username]
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, passwordHash: row.password_hash };
}

export async function createReviewer(username: string, passwordHash: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    "INSERT INTO reviewers (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), username, passwordHash, new Date().toISOString()]
  );
}
