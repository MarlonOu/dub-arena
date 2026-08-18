import demoClips from "@/data/demo-clips.json";
import type { ClipSource } from "@/lib/types/line";

// 階段一：Repository 直接回傳靜態 JSON。
// 階段五 API 導入後，此檔案改為呼叫內部 API，呼叫端（UI／遊戲邏輯層）介面維持不變。

export async function listClipSources(): Promise<ClipSource[]> {
  return demoClips as ClipSource[];
}

export async function getClipSource(clipId: string): Promise<ClipSource | undefined> {
  return (demoClips as ClipSource[]).find((c) => c.id === clipId);
}

export async function getLine(clipId: string, lineId: string) {
  const clip = await getClipSource(clipId);
  return clip?.lines.find((l) => l.id === lineId);
}
