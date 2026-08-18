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
  lines: Line[];
}
