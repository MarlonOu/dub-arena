export interface Line {
  id: string;
  clipSourceId: string;
  order: number;
  startSec: number;
  endSec: number;
  subtitleText: string;
  referenceAudioUrl: string;
}

export interface ClipSource {
  id: string;
  title: string;
  sourceDeclaration: "ORIGINAL" | "LICENSED" | "DEMO";
  /** Phase 1 尚無真實影片縮圖，先用色塊代表題目卡片，Phase 2 後期／Phase 4 導入真實影片後改為縮圖網址 */
  coverColor: string;
  lines: Line[];
}
