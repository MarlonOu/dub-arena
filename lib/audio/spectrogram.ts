import { magnitudeSpectrum, nextPow2 } from "./fft";

export interface SpectrogramData {
  frames: Float64Array[]; // 每個元素為一個時間訊框的頻域振幅（已轉為 dB）
  frameHopSec: number;
  sampleRate: number;
  fftSize: number;
}

/** 計算整段 AudioBuffer 的聲譜圖資料（STFT 振幅，轉為 dB 尺度）。 */
export function computeSpectrogram(
  buffer: AudioBuffer,
  fftSize = 1024,
  hop = 256
): SpectrogramData {
  const size = nextPow2(fftSize);
  const data = buffer.getChannelData(0);
  const frames: Float64Array[] = [];

  for (let start = 0; start + size <= data.length; start += hop) {
    const frame = data.subarray(start, start + size) as Float32Array;
    const mags = magnitudeSpectrum(frame);
    const db = new Float64Array(mags.length);
    for (let i = 0; i < mags.length; i++) {
      db[i] = 20 * Math.log10(mags[i] + 1e-6);
    }
    frames.push(db);
  }

  return { frames, frameHopSec: hop / buffer.sampleRate, sampleRate: buffer.sampleRate, fftSize: size };
}

/** 將聲譜圖資料繪製到 Canvas，橫軸時間、縱軸頻率、顏色深淺代表能量。 */
export function drawSpectrogram(canvas: HTMLCanvasElement, spec: SpectrogramData): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const numFrames = spec.frames.length;
  if (numFrames === 0) {
    ctx.clearRect(0, 0, width, height);
    return;
  }
  const numBins = spec.frames[0].length;

  // 只顯示到人聲相關的頻率範圍（約 5kHz 以下），避免高頻雜訊佔滿畫面
  const maxFreq = 5000;
  const nyquist = spec.sampleRate / 2;
  const binsToShow = Math.min(numBins, Math.ceil((maxFreq / nyquist) * numBins));

  let minDb = Infinity;
  let maxDb = -Infinity;
  for (const frame of spec.frames) {
    for (let i = 0; i < binsToShow; i++) {
      if (frame[i] < minDb) minDb = frame[i];
      if (frame[i] > maxDb) maxDb = frame[i];
    }
  }
  const range = Math.max(1, maxDb - minDb);

  const imageData = ctx.createImageData(numFrames, binsToShow);
  for (let x = 0; x < numFrames; x++) {
    const frame = spec.frames[x];
    for (let y = 0; y < binsToShow; y++) {
      const value = (frame[y] - minDb) / range; // 0..1
      const v = Math.max(0, Math.min(1, value));
      // 藍(低能量) -> 黃 -> 紅(高能量) 色階
      const r = Math.round(255 * Math.min(1, v * 2));
      const g = Math.round(255 * Math.min(1, Math.max(0, 1 - Math.abs(v - 0.5) * 2)));
      const b = Math.round(255 * Math.min(1, Math.max(0, 1 - v * 2)));
      const pixelY = binsToShow - 1 - y; // 低頻在下、高頻在上
      const idx = (pixelY * numFrames + x) * 4;
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }

  // 先畫到離屏 canvas 再縮放到目標尺寸，避免逐點縮放效能問題
  const off = document.createElement("canvas");
  off.width = numFrames;
  off.height = binsToShow;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;
  offCtx.putImageData(imageData, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, numFrames, binsToShow, 0, 0, width, height);
}
