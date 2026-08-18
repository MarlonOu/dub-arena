"use client";

import { useRef, useState } from "react";
import { startRecording, type Recorder } from "@/lib/audio/audioEngine";

interface Props {
  disabled?: boolean;
  onRecorded: (blob: Blob) => void;
}

export default function RecorderPanel({ disabled, onRecorded }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);

  async function handleStart() {
    setError(null);
    try {
      recorderRef.current = await startRecording();
      setIsRecording(true);
    } catch {
      setError("無法取得麥克風權限，請確認瀏覽器權限設定");
    }
  }

  async function handleStop() {
    if (!recorderRef.current) return;
    const blob = await recorderRef.current.stop();
    recorderRef.current = null;
    setIsRecording(false);
    onRecorded(blob);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || isRecording}
          onClick={handleStart}
          className="rounded bg-zinc-800 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          開始錄音
        </button>
        <button
          type="button"
          disabled={!isRecording}
          onClick={handleStop}
          className="rounded border border-zinc-800 px-4 py-2 text-sm disabled:opacity-40"
        >
          停止並評分
        </button>
      </div>
      {isRecording && <div className="text-sm text-red-600">錄音中……</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
