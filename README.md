# 配音擂台（暫定名稱）— Phase 1 示範

結合 Choicer Voicer 的模仿配音評分玩法與 UGC 影片題庫構想的姊妹遊戲專案。
完整設計文件（遊戲設計、架構、資料模型、路線圖）存放於 Claude 專案「開發遊戲」中，
檔名前綴為「配音擂台-」。

## 本次交付範圍（Phase 1：單機核心配音與評分 MVP）

- `lib/audio/`：Web Audio API 封裝（錄音／播放／解碼）、FFT、聲譜圖、自相關音高偵測
- `lib/engine/`：DTW 動態時間規整、評分演算法（音高／節奏／能量三軸）
- `lib/repository/`：題庫存取（目前為靜態 JSON，Phase 5 改接 API）
- `app/practice/`：練習頁面，串接錄音、聲譜顯示、評分結果
- `data/demo-clips.json` + `public/audio/demo/`：示範素材，以 espeak-ng 合成語音產生，非真實影片來源，避免版權疑慮

## 尚未包含（見路線圖 Phase 2 以後）

題目瀏覽層（YouTube 風格縮圖排列）、配音疊回影片播放、UGC 上傳與審核管線、API／資料庫整合。

## 開發

```bash
npm install
npm run dev
```

瀏覽 http://localhost:3000/practice 即可測試錄音評分流程（需允許麥克風權限）。

## 已知限制

- 評分模型（`lib/engine/scoring.ts`）的權重（音高 40%／節奏 40%相對形狀+60%絕對時長／能量）為初版設定，
  尚未經真人測試調校，屬於路線圖中明列的待驗證項目。
- 音高偵測（自相關法）在雜訊環境或非人聲頻率範圍外表現會下降。
- 尚未處理多聲道、環境噪音抑制。
