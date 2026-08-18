import { extractPitchContour, hzToSemitone } from "@/lib/audio/pitchDetector";
import { computeOverallRms, computeClippingRatio } from "@/lib/audio/audioEngine";
import { dtw } from "@/lib/engine/dtw";
import type { ScoreBreakdown } from "@/lib/types/attempt";

// 評分引擎：純函式，不依賴 UI 或瀏覽器狀態（除接收 AudioBuffer 作為輸入外）。
// 三軸評分對應 Choicer Voicer 的「音高音色／時間節奏／情緒表達」評分因子，
// 「清晰度」在此實作為分數可信度的檢核關卡而非獨立分項，避免錄音品質問題被誤讀為模仿不像。

const RMS_FRAME_SIZE = 2048;
const RMS_HOP = 1024;
const RMS_RESAMPLE_LEN = 40;

function extractRmsEnvelope(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const envelope: number[] = [];
  for (let start = 0; start + RMS_FRAME_SIZE <= data.length; start += RMS_HOP) {
    let sum = 0;
    for (let i = start; i < start + RMS_FRAME_SIZE; i++) sum += data[i] * data[i];
    envelope.push(Math.sqrt(sum / RMS_FRAME_SIZE));
  }
  if (envelope.length === 0) envelope.push(0);
  return envelope;
}

function resampleLinear(series: number[], targetLen: number): number[] {
  if (series.length === targetLen) return series;
  if (series.length === 1) return new Array(targetLen).fill(series[0]);
  const out: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const pos = (i / (targetLen - 1)) * (series.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(series.length - 1, lo + 1);
    const frac = pos - lo;
    out.push(series[lo] * (1 - frac) + series[hi] * frac);
  }
  return out;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 取出音高輪廓中「有聲」訊框的半音數值序列，並以自身中位數置中，
 * 讓比對聚焦在輪廓形狀而非絕對音高，降低玩家與原聲音域先天不同造成的誤判。 */
function voicedSemitoneSeries(buffer: AudioBuffer): number[] {
  const contour = extractPitchContour(buffer);
  const semis = contour.frames
    .filter((f) => f.freqHz !== null)
    .map((f) => hzToSemitone(f.freqHz as number));
  if (semis.length === 0) return [];
  const m = median(semis);
  return semis.map((s) => s - m);
}

function pitchScoreFromSeries(ref: number[], rec: number[]): number {
  if (ref.length === 0 || rec.length === 0) return 0;
  const result = dtw(ref, rec, (x, y) => Math.abs(x - y));
  // 每一步平均半音誤差，容忍值約 3 個半音
  const TOLERANCE_SEMITONES = 3;
  return 100 * Math.exp(-result.normalizedCost / TOLERANCE_SEMITONES);
}

function timingScoreFromSeries(ref: number[], rec: number[]): number {
  if (ref.length === 0 || rec.length === 0) return 0;
  const result = dtw(ref, rec, (x, y) => Math.abs(x - y));
  const n = ref.length;
  const m = rec.length;
  if (result.path.length === 0 || n < 2 || m < 2) return 0;

  let sumDeviation = 0;
  for (const [i, j] of result.path) {
    const expectedJ = (i / (n - 1)) * (m - 1);
    sumDeviation += Math.abs(j - expectedJ);
  }
  const avgDeviation = sumDeviation / result.path.length;
  const normDeviation = avgDeviation / Math.max(n, m);
  const TOLERANCE = 0.25; // 允許 25% 的時間偏移
  return 100 * Math.max(0, 1 - normDeviation / TOLERANCE);
}

/** 整體時長比對：DTW 對齊分數只反映「相對節奏形狀」，
 * 因為 DTW 會依序列長度比例自動伸縮，即使整段錄音明顯偏快或偏慢，
 * 只要內部相對節奏形狀相似，warp 分數仍可能偏高，因此需要獨立的絕對時長比對分數。 */
function durationMatchScore(refBuf: AudioBuffer, recBuf: AudioBuffer): number {
  const refDur = refBuf.length / refBuf.sampleRate;
  const recDur = recBuf.length / recBuf.sampleRate;
  if (refDur <= 0) return 0;
  const ratioDeviation = Math.abs(recDur - refDur) / refDur;
  const TOLERANCE = 0.3; // 允許 30% 的整體時長落差
  return 100 * Math.max(0, 1 - ratioDeviation / TOLERANCE);
}

function energyScoreFromBuffers(refBuf: AudioBuffer, recBuf: AudioBuffer): number {
  const refEnv = resampleLinear(extractRmsEnvelope(refBuf), RMS_RESAMPLE_LEN);
  const recEnv = resampleLinear(extractRmsEnvelope(recBuf), RMS_RESAMPLE_LEN);
  const corr = pearsonCorrelation(refEnv, recEnv);
  return Math.max(0, Math.min(100, ((corr + 1) / 2) * 100));
}

function checkClarity(recBuf: AudioBuffer): { warning: boolean; reason?: string } {
  const rms = computeOverallRms(recBuf);
  const clipRatio = computeClippingRatio(recBuf);
  if (rms < 0.02) {
    return { warning: true, reason: "錄音音量過低，分數可信度不足，建議靠近麥克風重錄" };
  }
  if (clipRatio > 0.01) {
    return { warning: true, reason: "錄音疑似削波失真，建議降低音量或拉遠麥克風後重錄" };
  }
  return { warning: false };
}

export function scoreAttempt(referenceBuffer: AudioBuffer, recordedBuffer: AudioBuffer): ScoreBreakdown {
  const refSemis = voicedSemitoneSeries(referenceBuffer);
  const recSemis = voicedSemitoneSeries(recordedBuffer);

  const pitchScore = pitchScoreFromSeries(refSemis, recSemis);
  const warpShapeScore = timingScoreFromSeries(refSemis, recSemis);
  const durationScore = durationMatchScore(referenceBuffer, recordedBuffer);
  // 節奏分數＝相對節奏形狀（40%）＋整體時長吻合度（60%），
  // 整體偏快偏慢是最直觀可感知的節奏誤差，故權重較高。
  const timingScore = 0.4 * warpShapeScore + 0.6 * durationScore;
  const energyScore = energyScoreFromBuffers(referenceBuffer, recordedBuffer);
  const clarity = checkClarity(recordedBuffer);

  const totalScore = 0.4 * pitchScore + 0.3 * timingScore + 0.3 * energyScore;

  return {
    pitchScore: Math.round(pitchScore),
    timingScore: Math.round(timingScore),
    energyScore: Math.round(energyScore),
    totalScore: Math.round(totalScore),
    clarityWarning: clarity.warning,
    clarityReason: clarity.reason,
  };
}
