"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpectrogramCanvas from "@/components/audio/SpectrogramCanvas";
import RecorderPanel from "@/components/audio/RecorderPanel";
import ScoreBreakdownPanel from "@/components/result/ScoreBreakdownPanel";
import DubbedPlayback from "@/components/playback/DubbedPlayback";
import { getClipSource } from "@/lib/repository/clipRepository";
import {
  loadAudioBuffer,
  blobToAudioBuffer,
  playAudioBuffer,
} from "@/lib/audio/audioEngine";
import { scoreAttempt } from "@/lib/engine/scoring";
import type { ClipSource } from "@/lib/types/line";
import type { ScoreBreakdown } from "@/lib/types/attempt";

type Stage = "idle" | "loadingReference" | "ready" | "scoring" | "done";

interface Params {
  clipId: string;
  lineId: string;
}

export default function PracticeLinePage({ params }: { params: Promise<Params> }) {
  const { clipId, lineId } = use(params);
  const router = useRouter();

  const [clip, setClip] = useState<ClipSource | null>(null);
  const [referenceBuffer, setReferenceBuffer] = useState<AudioBuffer | null>(null);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getClipSource(clipId).then((c) => {
      if (!c) {
        setNotFound(true);
        return;
      }
      setClip(c);
    });
  }, [clipId]);

  const currentLine = clip?.lines.find((l) => l.id === lineId) ?? null;

  useEffect(() => {
    if (!currentLine) return;
    let cancelled = false;

    async function load() {
      await Promise.resolve();
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

  function handleLineChange(newLineId: string) {
    router.push(`/practice/${clipId}/${newLineId}`);
  }

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <p className="text-sm text-zinc-600">找不到這個題目。</p>
        <Link href="/browse" className="text-sm underline">
          回題目列表
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/browse" className="text-sm text-zinc-500 underline">
            ← 回題目列表
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{clip?.title ?? "載入中……"}</h1>
        </div>
      </div>

      {clip && clip.lines.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-600">選擇段落</label>
          <select
            value={lineId}
            onChange={(e) => handleLineChange(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            {clip.lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.subtitleText}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {recordedBuffer && currentLine && currentLine.videoUrl && (
        <DubbedPlayback videoUrl={currentLine.videoUrl} recordedBuffer={recordedBuffer} />
      )}

      {recordedBuffer && currentLine && !currentLine.videoUrl && (
        <div className="rounded border border-zinc-200 p-4 text-sm text-zinc-500">
          此題目為純音檔語音包，沒有影片畫面可供疊音播放，請用上方「播放我的配音」比對評分即可。
        </div>
      )}
    </main>
  );
}
