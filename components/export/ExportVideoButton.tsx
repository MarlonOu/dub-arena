"use client";

import { useState } from "react";

interface Props {
  videoUrl: string;
  recordedBlob: Blob | null;
}

type ExportState = "idle" | "exporting" | "done" | "error";

// 把玩家錄音跟原始影片畫面在伺服器端用 ffmpeg 混音成一支真正的 mp4 檔案，
// 對應路線圖「Phase 3 已知限制：玩家無法把配音成果下載成一支真正的影片檔」。
// 只有 VIDEO 類型題目（有影片畫面）才會用到這個元件，見呼叫端的條件渲染。
export default function ExportVideoButton({ videoUrl, recordedBlob }: Props) {
  const [state, setState] = useState<ExportState>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!recordedBlob) return;
    setState("exporting");
    setError(null);
    setDownloadUrl(null);
    try {
      const formData = new FormData();
      formData.set("videoUrl", videoUrl);
      formData.set("audio", recordedBlob);
      const res = await fetch("/api/export", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "匯出失敗，請稍後再試");
        setState("error");
        return;
      }
      const data = (await res.json()) as { downloadUrl: string };
      setDownloadUrl(data.downloadUrl);
      setState("done");
    } catch {
      setError("匯出失敗，請確認網路連線後再試");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={!recordedBlob || state === "exporting"}
        className="w-fit rounded border border-zinc-800 px-4 py-2 text-sm disabled:opacity-40"
      >
        {state === "exporting" ? "混音匯出中……" : "匯出成影片檔（含我的配音）"}
      </button>
      <p className="text-xs text-zinc-500">
        對齊策略沿用上方疊音播放的簡化版本：錄音長度與影片長度不同時，以較短的一方為準，非最終方案。
      </p>
      {state === "done" && downloadUrl && (
        <a
          href={downloadUrl}
          className="w-fit rounded bg-zinc-800 px-4 py-2 text-sm text-white"
        >
          下載影片檔
        </a>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
