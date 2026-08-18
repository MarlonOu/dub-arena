"use client";

import { useEffect, useRef } from "react";
import { computeSpectrogram, drawSpectrogram } from "@/lib/audio/spectrogram";

interface Props {
  audioBuffer: AudioBuffer | null;
  label: string;
  heightPx?: number;
}

export default function SpectrogramCanvas({ audioBuffer, label, heightPx = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const spec = computeSpectrogram(audioBuffer);
    drawSpectrogram(canvas, spec);
  }, [audioBuffer]);

  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm text-zinc-500">{label}</div>
      <canvas
        ref={canvasRef}
        width={640}
        height={heightPx}
        className="w-full rounded border border-zinc-300 bg-black"
        style={{ height: heightPx }}
      />
      {!audioBuffer && (
        <div className="text-xs text-zinc-400">尚無音訊資料</div>
      )}
    </div>
  );
}
