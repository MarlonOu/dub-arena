-- Phase 7.2：審核者帳號停用功能。Phase 7 完成時只能用 scripts/create-reviewer.mjs
-- 新增帳號／改密碼，沒有停用機制——帳號外洩或審核者離職時，只能直接從資料庫
-- 刪除該筆紀錄，但 clip_sources.reviewed_by 只是純文字快照（非外鍵），刪除帳號
-- 不會影響既有審核紀錄的可讀性，也就沒有非刪不可的理由。改用 active 旗標軟停用，
-- 帳號本身與歷史審核紀錄都保留。

ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
