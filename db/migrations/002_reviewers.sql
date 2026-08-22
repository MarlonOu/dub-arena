-- Phase 7：審核者帳號系統。取代單一共用密碼的 HTTP Basic Auth（ADMIN_USER／
-- ADMIN_PASSWORD 環境變數），改成資料庫存放的多個具名帳號，並在核准／駁回時
-- 記錄是誰做的，供未來審核紀錄／稽核使用。
-- 舊的 ADMIN_USER／ADMIN_PASSWORD Basic Auth 仍保留作為備援登入方式，不會因為
-- 導入這張表而失效，見 proxy.ts 的說明。

CREATE TABLE IF NOT EXISTS reviewers (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE clip_sources ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE clip_sources ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
