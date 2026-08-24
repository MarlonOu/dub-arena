import { execFile } from "child_process";
import { promisify } from "util";

// 伺服器端專用（Route Handler 呼叫），不得被 client component 匯入。
// 用 ffmpeg 把「原始影片畫面」與「玩家錄音」混音成一支可下載的 mp4，
// 對應路線圖「Phase 3 已知限制：玩家無法把配音成果下載成一支真正的影片檔」。
//
// 正式機需要另外安裝 ffmpeg（apt-get install -y ffmpeg），見 配音擂台-infra.md，
// 這是本專案第一個需要系統層級套件（而非 npm 套件）的執行期依賴。
//
// Phase 7.11：對齊策略從單純的 `-shortest`（取兩者較短的一方）改為「以影片長度
// 為準」。舊做法的實際問題：玩家錄音通常比原始片段短（不會每次都精準錄到分秒不差），
// `-shortest` 會讓輸出檔案在錄音結束的那一刻直接截斷，玩家分享出去的影片會少一截
// 畫面，而不是「配音比較安靜」——這是比預期更明顯的行為，不只是對齊誤差。改為：
// 用 ffprobe 先讀出影片本身的實際長度，音軌用 `apad` 補靜音到至少跟影片一樣長，
// 輸出再用 `-t <影片長度>` 把整體長度鎖死在影片長度——錄音較短時補靜音、較長時在
// 影片結束處一併截斷（影片本身不會被拉長，因為原始畫面沒有更多影格可以生出來）。
// 仍然**不是**真正的拉伸／裁切校正（不會把配音對齊到影片裡對應句子實際出現的時間點，
// 只保證輸出長度＝原始影片長度），這部分留待下一步；但至少解決「畫面被截斷丟失」
// 這個更嚴重的既有問題。

const execFileAsync = promisify(execFile);

async function getDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`ffprobe 無法讀取媒體檔案長度：${filePath}`);
  }
  return duration;
}

export async function muxVideoWithAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  const videoDurationSeconds = await getDurationSeconds(videoPath);

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
    "-af",
    "apad", // 錄音較短時，補靜音到至少跟輸出長度一樣長
    "-t",
    videoDurationSeconds.toFixed(3), // 整體輸出長度鎖死在影片原始長度，音軌較長時在此截斷
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
