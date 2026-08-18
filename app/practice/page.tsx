"use client";

import { useEffect, useMemo, useState } from "react";
import SpectrogramCanvas from "@/components/audio/SpectrogramCanvas";
import RecorderPanel from "@/components/audio/RecorderPanel";
import ScoreBreakdownPanel from "@/components/result/ScoreBreakdownPanel";
import { listClipSources } from "@/lib/repository/clipRepository";
import {
  loadAudioBuffer,
  blobToAudioBuffer,
  playAudioBuffer,
} from "@/lib/audio/audioEngine";
import { scoreAttempt } from "@/lib/engine/scoring";
import type { ClipSource, Line } from "@/lib/types/line";
import type { ScoreBreakdown } from "@/lib/types/attempt";

type Stage = "idle" | "loadingReference" | "ready" | "scoring" | "done";

export default function PracticePage() {
  const [clips, setClips] = useState<ClipSource[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [referenceBuffer, setReferenceBuffer] = useState<AudioBuffer | null>(null);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [stage, setStage] = useState<Stage>("idle");

  useEffect(() => {
    listClipSources().then((data) => {
      setClips(data);
      if (data[0]?.lines[0]) setSelectedLineId(data[0].lines[0].id);
    });
  }, []);

  const allLines: Line[] = useMemo(
    () => clips.flatMap((c) => c.lines),
    [clips]
  );
  const currentLine = allLines.find((l) => l.id === selectedLineId) ?? null;

  useEffect(() => {
    if (!currentLine) return;
    let cancelled = false;

    async function load() {
      await Promise.resolve(); // 讓狀態更新發生在微任務回呼中，而非 effect 主體同步階段
      if (cancelled) return;
      setStage("loadingReference");
      setReferenceBuffer(null);
      setRecordedBuffer(null);
      setScore(null);
      const buf = await loadAudioBuffer(currentLine!.referenceAudioUrl);
      if (cancelled) return;
      setReferenceBuffer(buf);
      setStage("ready");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentLine]);

  function handlePlayReference() {
    if (referenceBuffer) playAudioBuffer(referenceBuffer);
  }

  function handlePlayRecorded() {
    if (recordedBuffer) playAudioBuffer(recordedBuffer);
  }

  async function handleRecorded(blob: Blob) {
    if (!referenceBuffer) return;
    setStage("scoring");
    const recBuf = await blobToAudioBuffer(blob);
    setRecordedBuffer(recBuf);
    const result = scoreAttempt(referenceBuffer, recBuf);
    setScore(result);
    setStage("done");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">配音練習（Phase 1 示範）</h1>
        <p className="mt-1 text-sm text-zinc-500">
          示範素材為合成語音，非真實影片來源，僅供評分模型驗證使用。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-zinc-600">選擇段落</label>
        <select
          value={selectedLineId}
          onChange={(e) => setSelectedLineId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          {allLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.subtitleText}
            </option>
          ))}
        </select>
      </div>

      {currentLine && (
        <div className="rounded border border-zinc-200 p-4 text-sm text-zinc-700">
          台詞原文：{currentLine.subtitleText}
        </div>
      )}

      <SpectrogramCanvas audioBuffer={referenceBuffer} label="原音聲譜（參考）" />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePlayReference}
          disabled={!referenceBuffer}
          className="rounded border border-zinc-800 px-4 py-2 text-sm disabled:opacity-40"
        >
          播放原音
        </button>
        {recordedBuffer && (
          <button
            type="button"
            onClick={handlePlayRecorded}
            className="rounded border border-zinc-800 px-4 py-2 text-sm"
          >
            播放我的配音
          </button>
        )}
      </div>

      <RecorderPanel disabled={stage === "loadingReference"} onRecorded={handleRecorded} />

      {stage === "scoring" && <div className="text-sm text-zinc-500">評分計算中……</div>}

      {recordedBuffer && (
        <SpectrogramCanvas audioBuffer={recordedBuffer} label="我的配音聲譜" />
      )}

      {score && <ScoreBreakdownPanel score={score} />}
    </main>
  );
}
