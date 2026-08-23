import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">配音擂台（暫定名稱）</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Phase 2 示範：類 YouTube 縮圖排列選題，模仿參考片段的音高、節奏、能量動態，
          取得分項評分回饋。示範素材為合成語音，非真實影片來源，僅供評分模型驗證。
        </p>
      </div>
      <Link
        href="/browse"
        className="inline-flex w-fit items-center rounded bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white"
      >
        選擇題目開始練習
      </Link>

      {/*
        開發階段用的頁面速覽，正式上線前移除。
        practice 頁面需要 clipId/lineId 參數，不列在這裡，從 /browse 點題目進去即可。
      */}
      <div className="mt-4 rounded border border-dashed border-amber-400 bg-amber-50 p-4">
        <p className="text-xs font-medium text-amber-800">
          開發中頁面速覽（正式上線前移除）
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-900 underline">
          <li>
            <Link href="/browse">/browse — 題目瀏覽</Link>
          </li>
          <li>
            <Link href="/contribute">/contribute — 投稿</Link>
          </li>
          <li>
            <Link href="/admin/review">/admin/review — 審核後台</Link>
          </li>
          <li>
            <Link href="/admin/history">/admin/history — 審核紀錄</Link>
          </li>
          <li>
            <Link href="/admin/login">/admin/login — 審核者登入</Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
