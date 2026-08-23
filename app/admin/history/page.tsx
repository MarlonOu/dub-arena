"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClipSource } from "@/lib/types/line";

// Phase 7.1：審核紀錄檢視介面，補上 Phase 7 完成時記下的缺口
// （reviewed_by／reviewed_at 當時只寫入資料庫，沒有對應畫面）。
// Phase 7.4：補上分頁，取代原本固定只顯示最近 50 筆的做法。
// 唯讀，沒有操作按鈕。

const PAGE_SIZE = 20;

interface HistoryPageResult {
  items: ClipSource[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ReviewHistoryPage() {
  const [result, setResult] = useState<HistoryPageResult | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      setError(null);
      try {
        const res = await fetch(`/api/contributions/history?page=${page}&pageSize=${PAGE_SIZE}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(`載入失敗（${res.status}）`);
          return;
        }
        const data = (await res.json()) as HistoryPageResult;
        if (cancelled) return;
        setResult(data);
      } catch {
        if (!cancelled) setError("載入失敗，請確認網路連線");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">審核紀錄</h1>
          <Link href="/admin/review" className="text-sm text-zinc-500 underline">
            回審核後台
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          已核准／已駁回的投稿，唯讀，依審核時間新到舊排序
          {result && result.total > 0 && `，共 ${result.total} 筆`}。
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result === null && !error && <div className="text-sm text-zinc-500">載入中……</div>}

      {result && result.items.length === 0 && (
        <div className="text-sm text-zinc-500">目前沒有任何審核紀錄。</div>
      )}

      <div className="flex flex-col gap-2">
        {result?.items.map((clip) => (
          <div
            key={clip.id}
            className="flex items-center justify-between gap-4 rounded border border-zinc-200 p-3 text-sm"
          >
            <div>
              <div className="font-medium">{clip.title}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                投稿者：{clip.contributorName} ・ 類型：
                {clip.contentType === "AUDIO_PACK" ? "純音檔語音包" : "影片切段"}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div
                className={
                  clip.status === "APPROVED" ? "font-medium text-emerald-700" : "font-medium text-red-600"
                }
              >
                {clip.status === "APPROVED" ? "已核准" : "已駁回"}
              </div>
              <div className="mt-0.5">
                {clip.reviewedBy ?? "未知"}
                {clip.reviewedAt && ` ・ ${new Date(clip.reviewedAt).toLocaleString("zh-TW")}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-40"
          >
            上一頁
          </button>
          <span className="text-xs text-zinc-500">
            第 {result.page} ／ {result.totalPages} 頁
          </span>
          <button
            type="button"
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      )}
    </main>
  );
}
