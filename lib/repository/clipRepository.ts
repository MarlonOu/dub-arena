import demoClips from "@/data/demo-clips.json";
import type { ClipSource } from "@/lib/types/line";

// Phase 4：加入已核准的 UGC 投稿，與靜態示範題庫合併呈現。
// 此檔案只能被 client component 呼叫（內部用 fetch 呼叫 API），不可在 server component
// 或伺服器端程式碼中直接呼叫（相對路徑 fetch 需要瀏覽器的當前來源才能解析）。
// Phase 5 導入完整 API／PostgreSQL 後，此檔案的對外介面維持不變，只替換內部實作。

async function fetchApprovedContributions(): Promise<ClipSource[]> {
  try {
    const res = await fetch("/api/contributions?status=APPROVED");
    if (!res.ok) return [];
    return (await res.json()) as ClipSource[];
  } catch {
    // API 尚未就緒或請求失敗時，瀏覽層仍可用靜態示範題庫運作，不因此整頁掛掉
    return [];
  }
}

export async function listClipSources(): Promise<ClipSource[]> {
  const approved = await fetchApprovedContributions();
  return [...(demoClips as ClipSource[]), ...approved];
}

export async function getClipSource(clipId: string): Promise<ClipSource | undefined> {
  const demo = (demoClips as ClipSource[]).find((c) => c.id === clipId);
  if (demo) return demo;
  const approved = await fetchApprovedContributions();
  return approved.find((c) => c.id === clipId);
}

export async function getLine(clipId: string, lineId: string) {
  const clip = await getClipSource(clipId);
  return clip?.lines.find((l) => l.id === lineId);
}
