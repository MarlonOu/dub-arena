export interface ScoreBreakdown {
  pitchScore: number; // 0-100
  timingScore: number; // 0-100
  energyScore: number; // 0-100
  totalScore: number; // 0-100，加權平均，僅供排序，UI 仍需顯示分項
  clarityWarning: boolean; // 錄音品質過低時為 true，分數僅供參考
  clarityReason?: string;
}

export interface Attempt {
  id: string;
  lineId: string;
  recordedAudioBlobUrl: string;
  score: ScoreBreakdown;
  createdAt: string;
}
