import { promises as fs } from "fs";
import path from "path";
import type { ClipSource, ClipStatus } from "@/lib/types/line";

// 伺服器端專用（Route Handlers 呼叫），不得被 client component 匯入。
// 以本機檔案系統儲存投稿清單，這是 Phase 5 導入 PostgreSQL／Prisma 前的輕量過渡實作，
// 讀寫介面（listContributions／addContribution／updateContributionStatus）維持穩定，
// 之後置換底層儲存時呼叫端不需修改。

const DATA_FILE = path.join(process.cwd(), "data", "contributions.json");

async function readAll(): Promise<ClipSource[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ClipSource[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(clips: ClipSource[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(clips, null, 2), "utf-8");
}

export async function listContributions(status?: ClipStatus): Promise<ClipSource[]> {
  const all = await readAll();
  return status ? all.filter((c) => c.status === status) : all;
}

export async function addContribution(clip: ClipSource): Promise<void> {
  const all = await readAll();
  all.push(clip);
  await writeAll(all);
}

export async function updateContributionStatus(
  id: string,
  status: ClipStatus
): Promise<ClipSource | null> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], status };
  await writeAll(all);
  return all[idx];
}
