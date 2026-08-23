import Link from "next/link";
import type { ClipSource } from "@/lib/types/line";

// Phase 7.5：AUDIO_PACK 卡片縮圖區分。原本 VIDEO／AUDIO_PACK 兩種類型只靠
// coverColor（建立時各自預設不同顏色，見 app/api/contributions/route.ts）區分，
// 但示範題庫的 coverColor 是各題目自訂的任意顏色（見 data/demo-clips.json），
// 顏色本身不是可靠的類型訊號，玩家看縮圖無法分辨這是要對嘴影片還是純聽音檔跟讀，
// 點進去才知道，見路線圖已知限制。改成在縮圖角落疊加明確的類型徽章（圖示＋文字），
// 不依賴顏色，VIDEO／AUDIO_PACK 一致適用（含示範題庫、UGC 投稿）。

function VideoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="2" y="5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 8.5L18 6v8l-5-2.5V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function AudioPackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M4 11V9a6 6 0 0 1 12 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="2.5" y="11" width="3.5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="11" width="3.5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ContentTypeBadge({ contentType }: { contentType: ClipSource["contentType"] }) {
  const isAudioPack = contentType === "AUDIO_PACK";
  return (
    <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
      {isAudioPack ? <AudioPackIcon /> : <VideoIcon />}
      {isAudioPack ? "純音檔" : "影片"}
    </div>
  );
}

export default function ClipCard({ clip }: { clip: ClipSource }) {
  const firstLine = clip.lines[0];

  return (
    <Link
      href={firstLine ? `/practice/${clip.id}/${firstLine.id}` : "#"}
      className="group flex flex-col overflow-hidden rounded border border-zinc-200 transition hover:border-zinc-400"
    >
      <div
        className="relative flex aspect-video items-center justify-center text-sm text-white/80"
        style={{ backgroundColor: clip.coverColor }}
      >
        <ContentTypeBadge contentType={clip.contentType} />
        {clip.sourceDeclaration === "DEMO" ? "示範素材" : clip.sourceDeclaration}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="text-sm font-medium group-hover:underline">{clip.title}</div>
        <div className="text-xs text-zinc-500">
          {clip.lines.length} 個段落
          {clip.sourceDeclaration !== "DEMO" && ` · 投稿者：${clip.contributorName}`}
        </div>
      </div>
    </Link>
  );
}
