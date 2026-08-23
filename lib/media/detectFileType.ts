// Phase 7.6：上傳檔案內容驗證。對應路線圖已知限制「data/uploads/ 已有基本大小
// 上限，但仍沒有病毒掃描、沒有轉檔壓縮」——完整的病毒掃描（例如串接 ClamAV）
// 需要額外的系統層級掃毒引擎，屬於較大規模的基礎設施投入，不在這次範圍內；
// 這裡先處理範圍較小、但同樣重要的問題：目前 /api/contributions 只檢查副檔名
// （甚至只驗證是不是合法的檔名字元），完全沒檢查檔案「內容」是否真的是聲稱的
// 媒體格式。也就是說，任意二進位內容只要檔名副檔名長得像 .mp4，就會被接受、
// 存進 data/uploads/、之後用 video/mp4 的 Content-Type 被 /api/media/[filename]
// 原樣 serve 出去。用檔案簽章（magic bytes）驗證內容跟聲稱的副檔名是否一致，
// 是本專案能用內建 Buffer 操作、不引入額外套件（延續 Prisma 那次學到的原則）
// 做到的合理防禦層級。

/** 這次驗證涵蓋的副檔名，跟 app/api/media/[filename]/route.ts 的 contentTypeFor()
 * 認得的副檔名一致。不在這個清單裡的副檔名維持既有行為（不驗證內容，直接接受），
 * 這是刻意縮小的範圍，不是要做到通用檔案類型偵測。 */
const RECOGNIZED_EXTS = new Set(["mp4", "webm", "mov", "mp3", "wav", "m4a", "ogg"]);

export function isRecognizedMediaExt(ext: string): boolean {
  return RECOGNIZED_EXTS.has(ext);
}

function hasAsciiAt(buf: Buffer, offset: number, ascii: string): boolean {
  if (buf.length < offset + ascii.length) return false;
  return buf.toString("ascii", offset, offset + ascii.length) === ascii;
}

function isIsoBmff(buf: Buffer): boolean {
  // mp4／m4a，以及較新版本的 QuickTime .mov：ftyp box 固定在偏移量 4 開始。
  return hasAsciiAt(buf, 4, "ftyp");
}

function isLegacyQuickTimeMov(buf: Buffer): boolean {
  // 舊版 QuickTime .mov 檔沒有 ftyp box，常見第一個 atom 型別如下，
  // 這裡不追求窮舉所有可能，只涵蓋最常見的幾種。
  const legacyAtoms = ["moov", "mdat", "free", "skip", "wide", "pnot"];
  return legacyAtoms.some((atom) => hasAsciiAt(buf, 4, atom));
}

/** 檢查檔案內容（前幾個 byte 的簽章）是否符合聲稱的副檔名。
 * 副檔名不在 RECOGNIZED_EXTS 裡的一律回傳 true（維持既有寬鬆行為，不驗證）。 */
export function matchesDeclaredExtension(buffer: Buffer, ext: string): boolean {
  switch (ext) {
    case "mp4":
    case "m4a":
      return isIsoBmff(buffer);
    case "mov":
      return isIsoBmff(buffer) || isLegacyQuickTimeMov(buffer);
    case "webm":
      // WebM／Matroska 的 EBML 檔頭固定是這四個 byte。
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
      );
    case "mp3":
      // 可能帶 ID3 標籤開頭，或直接是 MPEG frame sync（0xFF 加上次一個 byte
      // 高 3 bits 全為 1）。
      if (hasAsciiAt(buffer, 0, "ID3")) return true;
      return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    case "wav":
      return hasAsciiAt(buffer, 0, "RIFF") && hasAsciiAt(buffer, 8, "WAVE");
    case "ogg":
      return hasAsciiAt(buffer, 0, "OggS");
    default:
      return true;
  }
}

export class FileContentMismatchError extends Error {
  constructor(public readonly ext: string) {
    super(`檔案內容與副檔名（.${ext}）不符`);
    this.name = "FileContentMismatchError";
  }
}
