import { execFile } from "child_process";
import { promisify } from "util";

// 伺服器端專用（Route Handler 呼叫），不得被 client component 匯入。
// 用 ffmpeg 把「原始影片畫面」與「玩家錄音」混音成一支可下載的 mp4，
// 對應路線圖「Phase 3 已知限制：玩家無法把配音成果下載成一支真正的影片檔」。
//
// 正式機需要另外安裝 ffmpeg（apt-get install -y ffmpeg），見 配音擂台-infra.md，
// 這是本專案第一個需要系統層級套件（而非 npm 套件）的執行期依賴。
//
// 對齊策略沿用 DubbedPlayback 既有的簡化做法（-shortest，取兩者較短的一方），
// 不做拉伸／裁切校正，這是已知限制，非最終方案。

const execFileAsync = promisify(execFile);

export async function muxVideoWithAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
