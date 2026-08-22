"use client";

import { useEffect, useState } from "react";
import type { ClipSource } from "@/lib/types/line";

export default function ReviewPage() {
  const [pending, setPending] = useState<ClipSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadOnce(cancelledRef: { current: boolean }) {
    try {
      const res = await fetch("/api/contributions?status=PENDING");
      if (cancelledRef.current) return;
      if (!res.ok) {
        setError(`載入失敗（${res.status}）`);
        return;
      }
      const data = (await res.json()) as ClipSource[];
      if (cancelledRef.current) return;
      setPending(data);
    } catch {
      if (!cancelledRef.current) setError("載入失敗，請確認網路連線");
    }
  }

  useEffect(() => {
    const cancelledRef = { current: false };

    async function run() {
      await Promise.resolve(); // 讓狀態更新發生在微任務回呼中，而非 effect 主體同步階段
      if (cancelledRef.current) return;
      await loadOnce(cancelledRef);
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function handleDecision(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/contributions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError(`操作失敗（${res.status}）`);
        return;
      }
      setPending((prev) => prev?.filter((c) => c.id !== id) ?? null);
    } catch {
      setError("操作失敗，請稍後再試");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">審核後台</h1>
        <p className="mt-1 text-sm text-zinc-500">待審核的投稿清單，核准後才會出現在題目瀏覽層。</p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {pending === null && !error && <div className="text-sm text-zinc-500">載入中……</div>}

      {pending && pending.length === 0 && (
        <div className="text-sm text-zinc-500">目前沒有待審核的投稿。</div>
      )}

      <div className="flex flex-col gap-4">
        {pending?.map((clip) => (
          <div key={clip.id} className="flex flex-col gap-3 rounded border border-zinc-300 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{clip.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  投稿者：{clip.contributorName} ・ 來源聲明：
                  {clip.sourceDeclaration === "ORIGINAL" ? "自行創作" : "已取得授權"} ・
                  {new Date(clip.createdAt).toLocaleString("zh-TW")}
                </div>
              </div>
            </div>

            {clip.contentType === "AUDIO_PACK" ? (
              <div className="flex flex-col gap-2">
                {clip.lines.map((line) => (
                  <div key={line.id} className="flex flex-col gap-1">
                    <div className="text-sm text-zinc-700">{line.subtitleText}</div>
                    <audio src={line.referenceAudioUrl} controls className="w-full max-w-md" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <video
                  src={clip.lines[0]?.videoUrl}
                  controls
                  className="w-full max-w-md rounded border border-zinc-200 bg-black"
                />

                <div className="flex flex-col gap-1 text-sm text-zinc-700">
                  {clip.lines.map((line) => (
                    <div key={line.id}>
                      [{line.startSec.toFixed(1)}s–{line.endSec.toFixed(1)}s] {line.subtitleText}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === clip.id}
                onClick={() => handleDecision(clip.id, "APPROVED")}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                核准
              </button>
              <button
                type="button"
                disabled={busyId === clip.id}
                onClick={() => handleDecision(clip.id, "REJECTED")}
                className="rounded border border-red-600 px-4 py-2 text-sm text-red-600 disabled:opacity-40"
              >
                駁回
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
