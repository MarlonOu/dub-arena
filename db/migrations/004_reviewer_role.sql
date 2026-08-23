-- Phase 7.8：審核者角色區分（admin／reviewer）。
-- 補上路線圖已知限制「審核者帳號管理介面已於 Phase 7.2 補上，但沒有角色區分，
-- 所有審核者都能互相管理帳號」。
--
-- 這個檔案跟專案裡其他 migration 一樣，每次 pnpm run db:migrate 都會重新執行
-- 一次（scripts/migrate.mjs 沒有「已套用哪些 migration」追蹤表），所以這裡刻意
-- 不能用「ALTER TABLE ... ADD COLUMN ... DEFAULT 'reviewer'」搭配一次性
-- UPDATE 的寫法——DEFAULT 只在加欄位當下套用一次沒錯，但如果 UPDATE 語句本身
-- 沒有 WHERE 條件限制，每次重跑都會把「已經被管理員手動改過角色」的帳號
-- 覆蓋回去，等於角色調整永遠留不住。改成：先加一個沒有 DEFAULT 的可為 NULL
-- 欄位，backfill 只鎖定「role IS NULL」的列（也就是這個欄位剛加進來、還沒有
-- 任何值的既有帳號），backfill 完再補上 DEFAULT／NOT NULL／CHECK 約束。
-- 這樣不管重跑幾次，第二次以後 UPDATE 都會是 0 筆命中，冪等安全。

ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS role TEXT;

-- 只補齊還沒有角色值的既有帳號。這批帳號在 Phase 7.8 之前本來就享有
-- 「所有審核者都能互相管理帳號」的完整權限，backfill 成 admin 是延續既有
-- 能力，不是新增權限；Phase 7.8 之後新建立的帳號不會落在這個 WHERE 條件裡
-- （下面補上的 DEFAULT 會讓新帳號一開始就有 'reviewer'，不會是 NULL）。
UPDATE reviewers SET role = 'admin' WHERE role IS NULL;

ALTER TABLE reviewers ALTER COLUMN role SET DEFAULT 'reviewer';
ALTER TABLE reviewers ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviewers_role_check'
  ) THEN
    ALTER TABLE reviewers ADD CONSTRAINT reviewers_role_check CHECK (role IN ('admin', 'reviewer'));
  END IF;
END $$;
