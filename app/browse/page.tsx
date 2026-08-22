"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ClipGrid from "@/components/browse/ClipGrid";
import { listClipSources } from "@/lib/repository/clipRepository";
import type { ClipSource } from "@/lib/types/line";

export default function BrowsePage() {
  const [clips, setClips] = useState<ClipSource[] | null>(null);

  useEffect(() => {
    listClipSources().then(setClips);
  }, []);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">選擇題目</h1>
          <p className="mt-1 text-sm text-zinc-500">
            示範題庫為合成語音，非真實影片來源，僅供評分模型驗證。標記為使用者投稿的題目
            已通過來源聲明審核。
          </p>
        </div>
        <Link
          href="/contribute"
          className="shrink-0 rounded border border-zinc-800 px-4 py-2 text-sm"
        >
          投稿新題目
        </Link>
      </div>
      {clips ? <ClipGrid clips={clips} /> : <div className="text-sm text-zinc-500">載入中……</div>}
    </main>
  );
}
