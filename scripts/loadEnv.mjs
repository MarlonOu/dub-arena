// 給獨立執行的腳本（migrate.mjs／create-reviewer.mjs）用的簡易 .env 載入器。
//
// Next.js 本身（next dev／build／start）會自動讀 .env，但單獨用 `node
// scripts/xxx.mjs` 執行不會有這個效果——這是 Next.js 內建的行為，不是 Node.js
// 本身的功能，容易誤以為「.env 都設定好了」但腳本其實讀不到，之前就因為這樣
// 讓 db:migrate 在正式機上失敗過。這裡自己補上簡單解析，不引入 dotenv 之類的
// 套件（延續 Phase 5／7 能用內建方案就不額外加套件的原則）。
//
// 已存在於 process.env 的變數優先（例如指令前面用 FOO=bar node xxx.mjs 明確指定），
// 只補上 .env 裡有、但當前 shell 環境沒有的變數。

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

export function loadEnvFile() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
