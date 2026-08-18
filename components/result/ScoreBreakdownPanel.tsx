import type { ScoreBreakdown } from "@/lib/types/attempt";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 w-full rounded bg-zinc-200">
        <div
          className="h-2 rounded bg-zinc-800"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export default function ScoreBreakdownPanel({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-300 p-4">
      {score.clarityWarning && (
        <div className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {score.clarityReason ?? "錄音品質不足，分數僅供參考"}
        </div>
      )}
      <ScoreBar label="音高相似度" value={score.pitchScore} />
      <ScoreBar label="節奏對齊" value={score.timingScore} />
      <ScoreBar label="能量動態相似度" value={score.energyScore} />
      <div className="mt-1 flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
        <span>綜合分數</span>
        <span className="font-mono">{score.totalScore}</span>
      </div>
    </div>
  );
}
