export interface Line {
  id: string;
  clipSourceId: string;
  order: number;
  startSec: number;
  endSec: number;
  subtitleText: string;
  referenceAudioUrl: string;
  /** Phase 3 示範用合成影片（色塊背景+字幕燒錄+原音音軌），非真實影片來源。
   * Phase 4 導入真實授權影片後，此欄位改為實際影片網址，介面不需變動。 */
  videoUrl: string;
}

export interface ClipSource {
  id: string;
  title: string;
  sourceDeclaration: "ORIGINAL" | "LICENSED" | "DEMO";
  /** Phase 1 尚無真實影片縮圖，先用色塊代表題目卡片，Phase 2 後期／Phase 4 導入真實影片後改為縮圖網址 */
  coverColor: string;
  lines: Line[];
}
