import path from "path";

// 伺服器端專用。把 Line.videoUrl（相對網址）換算成硬碟上的實際檔案路徑，
// 供匯出功能讀取原始影片。目前只有兩種來源：
// - /audio/demo/xxx：靜態示範影片，放在 public/audio/demo/
// - /api/media/xxx：UGC 投稿影片，放在 data/uploads/（見 app/api/media/[filename]/route.ts）
// 其他格式（不認得的前綴、外部網址）一律拒絕，避免任意路徑讀取。

const PUBLIC_DEMO_DIR = path.join(process.cwd(), "public", "audio", "demo");
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function isSafeFilename(name: string): boolean {
  return name.length > 0 && !name.includes("..") && !name.includes("/") && !name.includes("\\");
}

export function resolveVideoSourcePath(videoUrl: string): string | null {
  if (videoUrl.startsWith("/audio/demo/")) {
    const name = videoUrl.slice("/audio/demo/".length);
    if (!isSafeFilename(name)) return null;
    return path.join(PUBLIC_DEMO_DIR, name);
  }
  if (videoUrl.startsWith("/api/media/")) {
    const name = videoUrl.slice("/api/media/".length);
    if (!isSafeFilename(name)) return null;
    return path.join(UPLOAD_DIR, name);
  }
  return null;
}
