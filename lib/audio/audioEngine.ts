// AudioEngine：封裝 Web Audio API 的錄音、播放與解碼。
// UI 層一律透過此模組操作音訊，不得直接呼叫瀏覽器原生 Audio API（依專案分層原則）。

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

export async function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export async function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export function playAudioBuffer(buffer: AudioBuffer, onEnded?: () => void): { stop: () => void } {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => onEnded?.();
  source.start();
  return { stop: () => source.stop() };
}

export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

/** 啟動麥克風錄音，回傳可停止並取得錄音結果（Blob）的控制器。 */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "audio/mp4";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopTracks = () => {
    stream.getTracks().forEach((t) => t.stop());
  };

  recorder.start();

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stopTracks();
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.stop();
      stopTracks();
    },
  };
}

/** 計算音訊的整體 RMS 音量，供錄音清晰度（clarity）檢核使用。 */
export function computeOverallRms(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

/** 估計削波（clipping）比例，數值越高代表錄音品質可能因音量過大而失真。 */
export function computeClippingRatio(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let clipped = 0;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > 0.98) clipped++;
  }
  return clipped / data.length;
}
