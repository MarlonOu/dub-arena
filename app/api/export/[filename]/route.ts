import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";

// 供玩家下載匯出好的配音影片檔（見 app/api/export/route.ts 產生流程）。
// 跟 app/api/media/[filename]/route.ts 同樣的理由：不能放 public/，
// 執行期才產生的檔案必須用 Route Handler 即時讀檔案 serve，支援 Range 請求。

export const runtime = "nodejs";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const filePath = path.join(EXPORT_DIR, filename);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const fileSize = stat.size;
  const range = request.headers.get("range");
  const downloadHeaders = {
    "Content-Type": "video/mp4",
    "Content-Disposition": `attachment; filename="dub-arena-${filename}"`,
  };

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
        ...downloadHeaders,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
      },
    });
  }

  const data = await fs.readFile(filePath);
  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: {
      ...downloadHeaders,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
    },
  });
}
