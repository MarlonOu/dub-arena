import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/pool";
import type { ClipSource, ClipStatus, Line } from "@/lib/types/line";

// 伺服器端專用（Route Handlers 呼叫），不得被 client component 匯入。
// Phase 5：改用 PostgreSQL（見 lib/db/pool.ts 說明為何用 pg 而非 Prisma）取代
// Phase 4 的 data/contributions.json 檔案儲存。對外介面
// （listContributions／addContribution／updateContributionStatus）維持不變，
// 呼叫端（app/api/contributions/**）完全不需修改。

interface ClipSourceRow {
  id: string;
  title: string;
  contributor_name: string;
  source_declaration: string;
  content_type: string;
  cover_color: string;
  status: string;
  created_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
}

interface LineRow {
  id: string;
  clip_source_id: string;
  order: number;
  start_sec: number;
  end_sec: number;
  subtitle_text: string;
  reference_audio_url: string;
  video_url: string | null;
}

function rowToLine(row: LineRow): Line {
  return {
    id: row.id,
    clipSourceId: row.clip_source_id,
    order: row.order,
    startSec: row.start_sec,
    endSec: row.end_sec,
    subtitleText: row.subtitle_text,
    referenceAudioUrl: row.reference_audio_url,
    ...(row.video_url ? { videoUrl: row.video_url } : {}),
  };
}

function rowToClipSource(row: ClipSourceRow, lines: Line[]): ClipSource {
  return {
    id: row.id,
    title: row.title,
    contributorName: row.contributor_name,
    sourceDeclaration: row.source_declaration as ClipSource["sourceDeclaration"],
    contentType: row.content_type as ClipSource["contentType"],
    coverColor: row.cover_color,
    status: row.status as ClipStatus,
    createdAt: row.created_at.toISOString(),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at.toISOString() } : {}),
    lines,
  };
}

async function attachLines(client: PoolClient, clipRows: ClipSourceRow[]): Promise<ClipSource[]> {
  if (clipRows.length === 0) return [];
  const ids = clipRows.map((r) => r.id);
  const { rows: lineRows } = await client.query<LineRow>(
    `SELECT id, clip_source_id, "order", start_sec, end_sec, subtitle_text, reference_audio_url, video_url
     FROM lines WHERE clip_source_id = ANY($1::uuid[]) ORDER BY "order" ASC`,
    [ids]
  );
  const linesByClip = new Map<string, Line[]>();
  for (const row of lineRows) {
    const list = linesByClip.get(row.clip_source_id) ?? [];
    list.push(rowToLine(row));
    linesByClip.set(row.clip_source_id, list);
  }
  return clipRows.map((row) => rowToClipSource(row, linesByClip.get(row.id) ?? []));
}

export async function listContributions(status?: ClipStatus): Promise<ClipSource[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = status
      ? await client.query<ClipSourceRow>(
          `SELECT id, title, contributor_name, source_declaration, content_type, cover_color, status, created_at, reviewed_by, reviewed_at
           FROM clip_sources WHERE status = $1 ORDER BY created_at DESC`,
          [status]
        )
      : await client.query<ClipSourceRow>(
          `SELECT id, title, contributor_name, source_declaration, content_type, cover_color, status, created_at, reviewed_by, reviewed_at
           FROM clip_sources ORDER BY created_at DESC`
        );
    return await attachLines(client, rows);
  } finally {
    client.release();
  }
}

const HISTORY_LIMIT = 50;

/** Phase 7.1：審核紀錄檢視介面用，列出已審核（非 PENDING）的投稿，依審核時間新到舊，
 * 最多回傳 HISTORY_LIMIT 筆——沒有分頁機制，這是刻意畫的範圍，數量變多後需要補分頁。 */
export async function listReviewedContributions(): Promise<ClipSource[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ClipSourceRow>(
      `SELECT id, title, contributor_name, source_declaration, content_type, cover_color, status, created_at, reviewed_by, reviewed_at
       FROM clip_sources WHERE status != 'PENDING' ORDER BY reviewed_at DESC NULLS LAST LIMIT $1`,
      [HISTORY_LIMIT]
    );
    return await attachLines(client, rows);
  } finally {
    client.release();
  }
}

export async function addContribution(clip: ClipSource): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO clip_sources (id, title, contributor_name, source_declaration, content_type, cover_color, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clip.id,
        clip.title,
        clip.contributorName,
        clip.sourceDeclaration,
        clip.contentType,
        clip.coverColor,
        clip.status,
        clip.createdAt,
      ]
    );
    for (const line of clip.lines) {
      await client.query(
        `INSERT INTO lines (id, clip_source_id, "order", start_sec, end_sec, subtitle_text, reference_audio_url, video_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          line.id,
          line.clipSourceId,
          line.order,
          line.startSec,
          line.endSec,
          line.subtitleText,
          line.referenceAudioUrl,
          line.videoUrl ?? null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateContributionStatus(
  id: string,
  status: ClipStatus,
  reviewedBy?: string
): Promise<ClipSource | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ClipSourceRow>(
      `UPDATE clip_sources SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4
       RETURNING id, title, contributor_name, source_declaration, content_type, cover_color, status, created_at, reviewed_by, reviewed_at`,
      [status, reviewedBy ?? null, reviewedBy ? new Date().toISOString() : null, id]
    );
    if (rows.length === 0) return null;
    const [clip] = await attachLines(client, rows);
    return clip;
  } finally {
    client.release();
  }
}
