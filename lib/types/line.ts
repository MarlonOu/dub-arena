export interface Line {
  id: string;
  clipSourceId: string;
  order: number;
  startSec: number;
  endSec: number;
  subtitleText: string;
  referenceAudioUrl: string;
  /** Phase 3 示範用合成影片（色塊背景+字幕燒錄+原音音軌），非真實影片來源。
   * VIDEO 類型題目才有此欄位；AUDIO_PACK 類型（純音檔語音包，仿 Choicer Voicer 的
   * voice pack 玩法）沒有影片畫面，此欄位不存在，練習頁面需相應跳過疊音播放環節。 */
  videoUrl?: string;
}

export type ClipStatus = "PENDING" | "APPROVED" | "REJECTED";

/** VIDEO：Phase 2-3 既有的影片切段模式。
 * AUDIO_PACK：純音檔語音包，每個 Line 是獨立音檔（無影片、無時間軸裁切），
 * 玩法對齊 Choicer Voicer 的 voice pack——不含任何第三方素材，僅本專案自建投稿內容。 */
export type ClipContentType = "VIDEO" | "AUDIO_PACK";

export interface ClipSource {
  id: string;
  title: string;
  sourceDeclaration: "ORIGINAL" | "LICENSED" | "DEMO";
  contentType: ClipContentType;
  /** Phase 1 尚無真實影片縮圖，先用色塊代表題目卡片，Phase 2 後期／Phase 4 導入真實影片後改為縮圖網址 */
  coverColor: string;
  lines: Line[];
  /** 示範題庫固定為 APPROVED；UGC 投稿依審核狀態機流轉，見 配音擂台-03-data-model.md */
  status: ClipStatus;
  contributorName: string;
  createdAt: string;
}
