import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">配音擂台（暫定名稱）</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Phase 1 單機示範：模仿參考片段的音高、節奏、能量動態，取得分項評分回饋。
          示範素材為合成語音，非真實影片來源，僅供評分模型驗證。
        </p>
      </div>
      <Link
        href="/practice"
        className="inline-flex w-fit items-center rounded bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white"
      >
        進入配音練習
      </Link>
    </main>
  );
}
