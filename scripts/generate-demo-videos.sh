#!/usr/bin/env bash
# 產生 Phase 3 示範用合成影片：純色背景 + 字幕燒錄 + 對應的示範語音音軌。
# 非真實影片來源，純粹用於驗證「配音疊回影片播放」的前端對齊邏輯，不涉及版權問題。
# 需要系統已安裝 ffmpeg 與支援中文的字型（此處使用 Noto Sans CJK）。

set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../public/audio/demo" && pwd)"
FONT="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

gen() {
  local audio="$1" text="$2" color="$3" out="$4"
  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DEMO_DIR/$audio")
  ffmpeg -y \
    -f lavfi -i "color=c=${color}:s=640x360:d=${dur}" \
    -i "$DEMO_DIR/$audio" \
    -vf "drawtext=fontfile=${FONT}:text='${text}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
    "$DEMO_DIR/$out"
}

gen line1.wav "今天的天氣真的非常好" 0x3f3f46 line1.mp4
gen line2.wav "我們一起去公園散步吧" 0x3f3f46 line2.mp4
gen line3.wav "你昨天晚上有沒有看那場比賽" 0x7c2d12 line3.mp4
gen line4.wav "太精彩了我完全捨不得轉台" 0x7c2d12 line4.mp4
gen line5.wav "這杯咖啡的香氣讓我瞬間清醒" 0x1e3a8a line5.mp4
gen line6.wav "麻煩幫我把音量再調大一點" 0x1e3a8a line6.mp4

echo "done"
