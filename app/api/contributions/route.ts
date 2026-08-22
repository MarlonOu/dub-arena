import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { addContribution, listContributions } from "@/lib/repository/contributionStore";
import type { ClipSource, ClipStatus, Line } from "@/lib/types/line";

export const runtime = "nodejs";

const VALID_STATUS: ClipStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = VALID_STATUS.includes(statusParam as ClipStatus)
    ? (statusParam as ClipStatus)
    : undefined;
  const clips = await listContributions(status);
  return Response.json(clips);
}

interface LineInput {
  subtitleText: string;
  startSec: number;
  endSec: number;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const title = String(formData.get("title") ?? "").trim();
  const contributorName = String(formData.get("contributorName") ?? "").trim();
  const sourceDeclaration = String(formData.get("sourceDeclaration") ?? "");
  const attested = formData.get("attested") === "true";
  const linesRaw = String(formData.get("lines") ?? "[]");
  const videoFile = formData.get("video");

  if (!title || !contributorName || !(videoFile instanceof File)) {
    return Response.json({ error: "缺少必填欄位（標題／貢獻者名稱／影片檔）" }, { status: 400 });
  }
  if (sourceDeclaration !== "ORIGINAL" && sourceDeclaration !== "LICENSED") {
    return Response.json({ error: "來源聲明必須是「自行創作」或「已取得授權」" }, { status: 400 });
  }
  if (!attested) {
    return Response.json({ error: "必須勾選來源聲明確認才能送出" }, { status: 400 });
  }

  let lineInputs: LineInput[];
  try {
    lineInputs = JSON.parse(linesRaw);
  } catch {
    return Response.json({ error: "段落資料格式錯誤" }, { status: 400 });
  }
  if (!Array.isArray(lineInputs) || lineInputs.length === 0) {
    return Response.json({ error: "至少需要新增一個段落" }, { status: 400 });
  }
  for (const l of lineInputs) {
    if (!l.subtitleText || typeof l.startSec !== "number" || typeof l.endSec !== "number") {
      return Response.json({ error: "段落欄位不完整" }, { status: 400 });
    }
    if (l.endSec <= l.startSec) {
      return Response.json({ error: "段落結束時間必須晚於起始時間" }, { status: 400 });
    }
  }

  const clipId = randomUUID();
  const originalExt = (videoFile.name.split(".").pop() || "mp4").toLowerCase();
  const safeExt = /^[a-z0-9]{1,8}$/.test(originalExt) ? originalExt : "mp4";
  const fileName = `${clipId}.${safeExt}`;
  // 存在 data/uploads/（非 public/），見 app/api/media/[filename]/route.ts 開頭的說明：
  // public/ 的靜態檔案清單在伺服器啟動時就固定了，執行期間新寫入的檔案不會被自動 serve。
  const uploadDir = path.join(process.cwd(), "data", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await videoFile.arrayBuffer());
  await fs.writeFile(path.join(uploadDir, fileName), bytes);
  const videoUrl = `/api/media/${fileName}`;

  const lines: Line[] = lineInputs.map((l, i) => ({
    id: `${clipId}-line-${i + 1}`,
    clipSourceId: clipId,
    order: i + 1,
    startSec: l.startSec,
    endSec: l.endSec,
    subtitleText: l.subtitleText,
    // 尚未實作人聲分離（Demucs 等），評分參考音檔暫時直接沿用影片音軌本身，
    // 會包含背景音樂／雜訊，屬 Phase 4 已知簡化，見路線圖待驗證清單。
    referenceAudioUrl: videoUrl,
    videoUrl,
  }));

  const clip: ClipSource = {
    id: clipId,
    title,
    sourceDeclaration: sourceDeclaration as "ORIGINAL" | "LICENSED",
    coverColor: "#52525b",
    status: "PENDING",
    contributorName,
    createdAt: new Date().toISOString(),
    lines,
  };

  await addContribution(clip);
  return Response.json(clip, { status: 201 });
}
