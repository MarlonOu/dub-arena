import ClipGrid from "@/components/browse/ClipGrid";
import { listClipSources } from "@/lib/repository/clipRepository";

export default async function BrowsePage() {
  const clips = await listClipSources();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">選擇題目</h1>
        <p className="mt-1 text-sm text-zinc-500">
          示範題庫為合成語音，非真實影片來源，僅供評分模型驗證。正式題庫（Phase 4）將改為
          使用者貢獻並審核通過的影片。
        </p>
      </div>
      <ClipGrid clips={clips} />
    </main>
  );
}
