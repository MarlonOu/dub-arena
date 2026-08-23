import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { addContribution, listContributions } from "@/lib/repository/contributionStore";
import type { ClipContentType, ClipSource, ClipStatus, Line } from "@/lib/types/line";
import {
  FileContentMismatchError,
  isRecognizedMediaExt,
  matchesDeclaredExtension,
} from "@/lib/media/detectFileType";

export const runtime = "nodejs";

const VALID_STATUS: ClipStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// 已知限制清單裡的「data/uploads/ 沒有大小限制」，先補上基本上限。
// 沒有轉檔壓縮，這裡只是防濫用的粗略上限，不是精確的容量規劃。
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB，單句對話影片綽綽有餘
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB，單句語音綽綽有餘

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
  const bytes = Buffer.from(await file.arrayBuffer());

  // Phase 7.6：檔案內容驗證，見 lib/media/detectFileType.ts 開頭的說明。只檢查
  // 副檔名跟內容簽章是否一致，在寫入磁碟之前擋下，避免任意二進位內容假冒成
  // 媒體檔被存進 data/uploads/、之後又被 /api/media/[filename] 原樣 serve 出去。
  if (isRecognizedMediaExt(safeExt) && !matchesDeclaredExtension(bytes, safeExt)) {
    throw new FileContentMismatchError(safeExt);
  }

  // 存在 data/uploads/（非 public/），見 app/api/media/[filename]/route.ts 開頭的說明：
  // public/ 的靜態檔案清單在伺服器啟動時就固定了，執行期間新寫入的檔案不會被自動 serve。
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
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
  if (videoFile.size > MAX_VIDEO_BYTES) {
    return Response.json(
      { error: `影片檔過大（上限 ${Math.floor(MAX_VIDEO_BYTES / 1024 / 1024)}MB）` },
      { status: 400 }
    );
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
  let videoUrl: string;
  try {
    videoUrl = await saveUploadedFile(videoFile, clipId, 0);
  } catch (err) {
    if (err instanceof FileContentMismatchError) {
      return Response.json(
        { error: "影片檔內容與副檔名不符，請確認上傳的是真正的影片檔案" },
        { status: 400 }
      );
    }
    throw err;
  }

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
    if (f.size > MAX_AUDIO_BYTES) {
      return Response.json(
        { error: `第 ${i + 1} 段音檔過大（上限 ${Math.floor(MAX_AUDIO_BYTES / 1024 / 1024)}MB）` },
        { status: 400 }
      );
    }
    audioFiles.push(f);
  }

  const clipId = randomUUID();
  const lines: Line[] = [];
  const savedFileNames: string[] = [];
  // 逐段存檔，任一段失敗（內容跟副檔名不符、或其他寫入錯誤）就整批放棄，
  // 並清掉這個 clipId 底下已經寫入的檔案，避免留下沒有任何投稿紀錄指向、
  // 永遠不會被清理的孤兒檔案（Phase 7.6 補上，先前沒有這層清理）。
  try {
    for (let i = 0; i < lineInputs.length; i++) {
      const audioUrl = await saveUploadedFile(audioFiles[i], clipId, i);
      savedFileNames.push(audioUrl.replace("/api/media/", ""));
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
  } catch (err) {
    await Promise.all(
      savedFileNames.map((name) => fs.unlink(path.join(UPLOAD_DIR, name)).catch(() => {}))
    );
    if (err instanceof FileContentMismatchError) {
      return Response.json(
        { error: "有音檔內容與副檔名不符，請確認上傳的是真正的音訊檔案" },
        { status: 400 }
      );
    }
    throw err;
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
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // 通常是請求主體被截斷（例如超過 next.config.ts 的 proxyClientMaxBodySize，
    // 或用戶端本身送出畸形的 multipart 內容）導致 boundary 解析失敗，
    // 明確回一個乾淨的錯誤，不要讓例外變成沒有訊息的 500。
    return Response.json({ error: "檔案讀取失敗，可能是檔案過大或格式不正確" }, { status: 400 });
  }

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
