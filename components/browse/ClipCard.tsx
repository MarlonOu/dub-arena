import Link from "next/link";
import type { ClipSource } from "@/lib/types/line";

export default function ClipCard({ clip }: { clip: ClipSource }) {
  const firstLine = clip.lines[0];

  return (
    <Link
      href={firstLine ? `/practice/${clip.id}/${firstLine.id}` : "#"}
      className="group flex flex-col overflow-hidden rounded border border-zinc-200 transition hover:border-zinc-400"
    >
      <div
        className="flex aspect-video items-center justify-center text-sm text-white/80"
        style={{ backgroundColor: clip.coverColor }}
      >
        {clip.sourceDeclaration === "DEMO" ? "示範素材" : clip.sourceDeclaration}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="text-sm font-medium group-hover:underline">{clip.title}</div>
        <div className="text-xs text-zinc-500">{clip.lines.length} 個段落</div>
      </div>
    </Link>
  );
}
