import ClipCard from "@/components/browse/ClipCard";
import type { ClipSource } from "@/lib/types/line";

export default function ClipGrid({ clips }: { clips: ClipSource[] }) {
  if (clips.length === 0) {
    return <div className="text-sm text-zinc-500">目前沒有可練習的題目</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}
