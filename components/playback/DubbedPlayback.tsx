"use client";

import { useRef, useState } from "react";
import { playAudioBuffer } from "@/lib/audio/audioEngine";

interface Props {
  videoUrl: string;
  recordedBuffer: AudioBuffer;
}

// Phase 3 MVP：前端同步播放，不做伺服器端混音輸出檔案。
// 影片畫面靜音播放，改為同步播放玩家錄音，取代原始人聲。
// 已知限制（見路線圖待驗證清單）：若錄音長度與影片長度差距明顯，
// 較短的一方結束後，另一方會繼續播完，此為簡化版對齊策略，非最終方案。
export default function DubbedPlayback({ videoUrl, recordedBuffer }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = true; // 影片原始音軌永遠靜音，播放的是玩家錄音
    setIsPlaying(true);
    video.play();
    playAudioBuffer(recordedBuffer, () => setIsPlaying(false));
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full rounded border border-zinc-300 bg-black"
        playsInline
      />
      <button
        type="button"
        onClick={handlePlay}
        disabled={isPlaying}
        className="w-fit rounded bg-zinc-800 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {isPlaying ? "播放中……" : "配上影片欣賞我的配音"}
      </button>
    </div>
  );
}
