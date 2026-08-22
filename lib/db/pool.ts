import { Pool } from "pg";

// 伺服器端專用（Route Handlers／contributionStore 呼叫），不得被 client component 匯入。
// Phase 5 原本規劃用 Prisma，但這個開發環境的網路白名單會擋掉 Prisma 需要下載的
// query engine／schema engine 二進位檔（binaries.prisma.sh 回 403），導致 `prisma generate`
// 完全無法執行，也就沒辦法在這裡驗證。改用 node-postgres（`pg`）直接下 SQL，
// 純 JS 套件、沒有額外的原生二進位下載需求，在任何環境都能一致運作，風險更低。
// 讀寫介面（contributionStore.ts 對外的三個函式）維持不變，之後真的要換 ORM 也不影響呼叫端。

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "缺少 DATABASE_URL 環境變數。Phase 5 起投稿資料改存 PostgreSQL，" +
          "需在 .env 設定連線字串，見 配音擂台-infra.md。"
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}
