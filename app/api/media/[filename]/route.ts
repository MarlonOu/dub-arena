import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/lib/http/withErrorHandling";

export const runtime = "nodejs";

// 投稿的影片檔存在 data/uploads/（非 public/），因為 Next.js 的 public/ 靜態檔案清單
// 是伺服器啟動時建立的，執行期間新寫入的檔案不會被自動 serve（實測發現：正式環境用
// systemd 長駐執行，不會因為使用者投稿而重啟，若存在 public/ 會導致投稿影片永遠 404，
// 直到下次部署重啟服務），改用這支 Route Handler 每次請求即時從硬碟讀取，不受此限制。
// 支援 Range 請求，讓 <video> 可以正常拖曳進度。

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const fileSize = stat.size;
  const contentType = contentTypeFor(filename);
  const range = request.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const fileHandle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(chunkSize);
    try {
      await fileHandle.read(buffer, 0, chunkSize, start);
    } finally {
      await fileHandle.close();
    }

    return new Response(buffer as unknown as BodyInit, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const data = await fs.readFile(filePath);
  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    },
  });
}

export const GET = withErrorHandling(getHandler);
