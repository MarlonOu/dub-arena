import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { addContribution, listContributions } from "@/lib/repository/contributionStore";
import type { ClipContentType, ClipSource, ClipStatus, Line } from "@/lib/types/line";

export const runtime = "nodejs";

const VALID_STATUS: ClipStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = VALID_STATUS.includes(statusParam as ClipStatus)
    ? (statusParam as ClipStatus)
    : undefined;
  const clips = await listContributions(status);
  return Response.json(clips);
}

interface VideoLineInput {
  subtitleText: string;
  startSec: number;
  endSec: number;
}

interface AudioLineInput {
  subtitleText: string;
}

async function saveUploadedFile(file: File, clipId: string, index: number): Promise<string> {
  const originalExt = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeExt = /^[a-z0-9]{1,8}$/.test(originalExt) ? originalExt : "bin";
  const fileName = `${clipId}-${index}.${safeExt}`;
  // 存在 data/uploads/（非 public/），見 app/api/media/[filename]/route.ts 開頭的說明：
  // public/ 的靜態檔案清單在伺服器啟動時就固定了，執行期間新寫入的檔案不會被自動 serve。
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), bytes);
  return `/api/media/${fileName}`;
}

async function handleVideoSubmission(
  formData: FormData,
  base: Pick<ClipSource, "title" | "contributorName" | "sourceDeclaration">
): Promise<Response> {
  const videoFile = formData.get("video");
  const linesRaw = String(formData.get("lines") ?? "[]");

  if (!(videoFile instanceof File)) {
    return Response.json({ error: "缺少影片檔" }, { status: 400 });
  }

  let lineInputs: VideoLineInput[];
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
  const videoUrl = await saveUploadedFile(videoFile, clipId, 0);

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
    ...base,
    contentType: "VIDEO",
    coverColor: "#52525b",
    status: "PENDING",
    createdAt: new Date().toISOString(),
    lines,
  };

  await addContribution(clip);
  return Response.json(clip, { status: 201 });
}

async function handleAudioPackSubmission(
  formData: FormData,
  base: Pick<ClipSource, "title" | "contributorName" | "sourceDeclaration">
): Promise<Response> {
  const linesRaw = String(formData.get("lines") ?? "[]");

  let lineInputs: AudioLineInput[];
  try {
    lineInputs = JSON.parse(linesRaw);
  } catch {
    return Response.json({ error: "段落資料格式錯誤" }, { status: 400 });
  }
  if (!Array.isArray(lineInputs) || lineInputs.length === 0) {
    return Response.json({ error: "至少需要新增一段語音" }, { status: 400 });
  }

  const audioFiles: File[] = [];
  for (let i = 0; i < lineInputs.length; i++) {
    const f = formData.get(`audio_${i}`);
    if (!(f instanceof File)) {
      return Response.json({ error: `第 ${i + 1} 段缺少音檔` }, { status: 400 });
    }
    if (!lineInputs[i].subtitleText) {
      return Response.json({ error: `第 ${i + 1} 段缺少文字說明` }, { status: 400 });
    }
    audioFiles.push(f);
  }

  const clipId = randomUUID();
  const lines: Line[] = [];
  for (let i = 0; i < lineInputs.length; i++) {
    const audioUrl = await saveUploadedFile(audioFiles[i], clipId, i);
    lines.push({
      id: `${clipId}-line-${i + 1}`,
      clipSourceId: clipId,
      order: i + 1,
      startSec: 0,
      endSec: 0, // AUDIO_PACK 沒有裁切時間軸，整段音檔即為題目，此欄位不使用
      subtitleText: lineInputs[i].subtitleText,
      referenceAudioUrl: audioUrl,
      // 無 videoUrl：AUDIO_PACK 是純音檔語音包，練習頁面據此跳過疊音播放環節
    });
  }

  const clip: ClipSource = {
    id: clipId,
    ...base,
    contentType: "AUDIO_PACK",
    coverColor: "#4c1d95",
    status: "PENDING",
    createdAt: new Date().toISOString(),
    lines,
  };

  await addContribution(clip);
  return Response.json(clip, { status: 201 });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const title = String(formData.get("title") ?? "").trim();
  const contributorName = String(formData.get("contributorName") ?? "").trim();
  const sourceDeclaration = String(formData.get("sourceDeclaration") ?? "");
  const attested = formData.get("attested") === "true";
  const contentType = (String(formData.get("contentType") ?? "VIDEO")) as ClipContentType;

  if (!title || !contributorName) {
    return Response.json({ error: "缺少必填欄位（標題／貢獻者名稱）" }, { status: 400 });
  }
  if (sourceDeclaration !== "ORIGINAL" && sourceDeclaration !== "LICENSED") {
    return Response.json({ error: "來源聲明必須是「自行創作」或「已取得授權」" }, { status: 400 });
  }
  if (!attested) {
    return Response.json({ error: "必須勾選來源聲明確認才能送出" }, { status: 400 });
  }
  if (contentType !== "VIDEO" && contentType !== "AUDIO_PACK") {
    return Response.json({ error: "contentType 必須是 VIDEO 或 AUDIO_PACK" }, { status: 400 });
  }

  const base = {
    title,
    contributorName,
    sourceDeclaration: sourceDeclaration as "ORIGINAL" | "LICENSED",
  };

  return contentType === "AUDIO_PACK"
    ? handleAudioPackSubmission(formData, base)
    : handleVideoSubmission(formData, base);
}
