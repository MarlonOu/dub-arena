// 音高偵測：ACF2+ 自相關演算法（改良自 Chris Wilson 的經典實作）。
// 逐訊框分析，輸出音高輪廓（pitch contour），供評分引擎的 DTW 比對使用。

export interface PitchFrame {
  tSec: number;
  freqHz: number | null; // null 代表該訊框未偵測到明確音高（靜音／不明確）
  rms: number;
}

export interface PitchContour {
  frames: PitchFrame[];
  frameHopSec: number;
}

/** 對單一訊框執行自相關音高偵測，回傳頻率（Hz），偵測失敗回傳 null。 */
export function autoCorrelate(buf: Float32Array, sampleRate: number): number | null {
  const SIZE = buf.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null; // 音量過低，視為靜音

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;
  if (newSize < 8) return null;

  const c = new Float64Array(newSize);
  for (let i = 0; i < newSize; i++) {
    let sum = 0;
    for (let j = 0; j < newSize - i; j++) {
      sum += trimmed[j] * trimmed[j + i];
    }
    c[i] = sum;
  }

  let d = 0;
  while (d < newSize - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0 || maxPos >= newSize - 1) {
    if (maxPos <= 0) return null;
  }

  let T0 = maxPos;
  if (T0 > 0 && T0 < newSize - 1) {
    const x1 = c[T0 - 1];
    const x2 = c[T0];
    const x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) T0 = T0 - b / (2 * a);
  }

  if (T0 <= 0) return null;
  const freq = sampleRate / T0;
  if (freq < 60 || freq > 1000) return null; // 人聲合理範圍外，視為雜訊
  return freq;
}

/** 對整段 AudioBuffer 執行逐訊框音高偵測，輸出音高輪廓。 */
export function extractPitchContour(
  buffer: AudioBuffer,
  frameSize = 2048,
  hop = 512
): PitchContour {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const frames: PitchFrame[] = [];

  for (let start = 0; start + frameSize <= data.length; start += hop) {
    const frame = data.subarray(start, start + frameSize) as Float32Array;
    let rms = 0;
    for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i];
    rms = Math.sqrt(rms / frame.length);
    const freq = autoCorrelate(frame, sampleRate);
    frames.push({ tSec: start / sampleRate, freqHz: freq, rms });
  }

  return { frames, frameHopSec: hop / sampleRate };
}

/** 將 Hz 轉換為半音（semitone）數值，以指定參考頻率為 0，供跨音色比對使用。 */
export function hzToSemitone(freqHz: number, refHz = 440): number {
  return 12 * Math.log2(freqHz / refHz);
}
