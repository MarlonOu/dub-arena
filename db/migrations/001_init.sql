-- Phase 5：UGC 投稿的正式資料表，取代 Phase 4 的 data/contributions.json 檔案儲存。
-- 對應 lib/types/line.ts 的 ClipSource / Line 型別，欄位命名沿用 camelCase 對應（DB 用 snake_case）。
-- 示範題庫（data/demo-clips.json）不進資料庫，維持靜態檔案＋前端合併的既有架構不變，
-- 這裡只處理 UGC 投稿部分（原本 contributionStore.ts 負責的範圍）。

CREATE TABLE IF NOT EXISTS clip_sources (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  contributor_name TEXT NOT NULL,
  source_declaration TEXT NOT NULL CHECK (source_declaration IN ('ORIGINAL', 'LICENSED', 'DEMO')),
  content_type TEXT NOT NULL CHECK (content_type IN ('VIDEO', 'AUDIO_PACK')),
  cover_color TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clip_sources_status ON clip_sources (status);

CREATE TABLE IF NOT EXISTS lines (
  id TEXT PRIMARY KEY,
  clip_source_id UUID NOT NULL REFERENCES clip_sources (id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  start_sec DOUBLE PRECISION NOT NULL,
  end_sec DOUBLE PRECISION NOT NULL,
  subtitle_text TEXT NOT NULL,
  reference_audio_url TEXT NOT NULL,
  video_url TEXT -- VIDEO 類型才有值，AUDIO_PACK 為 NULL，見 lib/types/line.ts 的說明
);

CREATE INDEX IF NOT EXISTS idx_lines_clip_source_id ON lines (clip_source_id);
