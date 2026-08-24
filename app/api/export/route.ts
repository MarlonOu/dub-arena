import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { resolveVideoSourcePath } from "@/lib/media/resolveSourcePath";
import { muxVideoWithAudio } from "@/lib/media/muxExport";
import { withErrorHandling } from "@/lib/http/withErrorHandling";

export const runtime = "nodejs";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");
const TMP_DIR = path.join(process.cwd(), "data", "tmp");
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 玩家單句錄音檔，20MB 綽綽有餘，避免濫用

async function postHandler(request: Request) {
  const formData = await request.formData();
  const videoUrl = String(formData.get("videoUrl") ?? "");
  const audio = formData.get("audio");

  if (!videoUrl) {
    return Response.json({ error: "缺少 videoUrl" }, { status: 400 });
  }
  if (!(audio instanceof File)) {
    return Response.json({ error: "缺少錄音檔" }, { status: 400 });
  }
  if (audio.size === 0) {
    return Response.json({ error: "錄音檔是空的" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "錄音檔過大" }, { status: 400 });
  }

  const videoPath = resolveVideoSourcePath(videoUrl);
  if (!videoPath) {
    return Response.json({ error: "不支援的 videoUrl 來源" }, { status: 400 });
  }
  try {
    await fs.access(videoPath);
  } catch {
    return Response.json({ error: "找不到原始影片檔" }, { status: 404 });
  }

  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(EXPORT_DIR, { recursive: true });

  const jobId = randomUUID();
  const audioExt = audio.type.includes("mp4") ? "mp4" : "webm";
  const tmpAudioPath = path.join(TMP_DIR, `${jobId}.${audioExt}`);
  const outputFilename = `${jobId}.mp4`;
  const outputPath = path.join(EXPORT_DIR, outputFilename);

  try {
    const bytes = Buffer.from(await audio.arrayBuffer());
    await fs.writeFile(tmpAudioPath, bytes);
    await muxVideoWithAudio(videoPath, tmpAudioPath, outputPath);
  } catch (err) {
    console.error("匯出混音失敗：", err);
    return Response.json({ error: "混音失敗，請稍後再試" }, { status: 500 });
  } finally {
    await fs.rm(tmpAudioPath, { force: true });
  }

  return Response.json({ downloadUrl: `/api/export/${outputFilename}` }, { status: 201 });
}

export const POST = withErrorHandling(postHandler);
