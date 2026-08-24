"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClipContentType } from "@/lib/types/line";
import {
  MAX_CONTRIBUTOR_NAME_LENGTH,
  MAX_LINES_PER_CLIP,
  MAX_SUBTITLE_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/lib/validation/contributionLimits";

interface VideoLineDraft {
  subtitleText: string;
  startSec: string;
  endSec: string;
}

interface AudioLineDraft {
  subtitleText: string;
  file: File | null;
}

function emptyVideoLine(): VideoLineDraft {
  return { subtitleText: "", startSec: "", endSec: "" };
}

function emptyAudioLine(): AudioLineDraft {
  return { subtitleText: "", file: null };
}

export default function ContributePage() {
  const router = useRouter();

  const [contentType, setContentType] = useState<ClipContentType>("VIDEO");
  const [title, setTitle] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [sourceDeclaration, setSourceDeclaration] = useState<"" | "ORIGINAL" | "LICENSED">("");
  const [attested, setAttested] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLines, setVideoLines] = useState<VideoLineDraft[]>([emptyVideoLine()]);

  const [audioLines, setAudioLines] = useState<AudioLineDraft[]>([emptyAudioLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateVideoLine(index: number, patch: Partial<VideoLineDraft>) {
    setVideoLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addVideoLine() {
    setVideoLines((prev) => (prev.length >= MAX_LINES_PER_CLIP ? prev : [...prev, emptyVideoLine()]));
  }
  function removeVideoLine(index: number) {
    setVideoLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function updateAudioLine(index: number, patch: Partial<AudioLineDraft>) {
    setAudioLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addAudioLine() {
    setAudioLines((prev) => (prev.length >= MAX_LINES_PER_CLIP ? prev : [...prev, emptyAudioLine()]));
  }
  function removeAudioLine(index: number) {
    setAudioLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !contributorName.trim()) {
      setError("請填寫標題與投稿者名稱");
      return;
    }
    if (!sourceDeclaration) {
      setError("請選擇來源聲明");
      return;
    }
    if (!attested) {
      setError("必須勾選來源聲明確認才能送出");
      return;
    }

    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("contributorName", contributorName.trim());
    formData.set("sourceDeclaration", sourceDeclaration);
    formData.set("attested", "true");
    formData.set("contentType", contentType);

    if (contentType === "VIDEO") {
      if (!videoFile) {
        setError("請選擇要上傳的影片檔");
        return;
      }
      const parsedLines = [];
      for (const l of videoLines) {
        const startSec = Number(l.startSec);
        const endSec = Number(l.endSec);
        if (!l.subtitleText.trim() || Number.isNaN(startSec) || Number.isNaN(endSec)) {
          setError("段落欄位需完整填寫（字幕、起始秒數、結束秒數）");
          return;
        }
        if (endSec <= startSec) {
          setError("段落結束時間必須晚於起始時間");
          return;
        }
        parsedLines.push({ subtitleText: l.subtitleText.trim(), startSec, endSec });
      }
      formData.set("lines", JSON.stringify(parsedLines));
      formData.set("video", videoFile);
    } else {
      const parsedLines = [];
      for (let i = 0; i < audioLines.length; i++) {
        const l = audioLines[i];
        if (!l.subtitleText.trim() || !l.file) {
          setError(`第 ${i + 1} 段語音需要文字說明與音檔`);
          return;
        }
        parsedLines.push({ subtitleText: l.subtitleText.trim() });
        formData.set(`audio_${i}`, l.file);
      }
      formData.set("lines", JSON.stringify(parsedLines));
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contributions", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "送出失敗，請稍後再試");
        return;
      }
      setDone(true);
    } catch {
      setError("送出失敗，請確認網路連線後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">投稿已送出</h1>
        <p className="text-sm text-zinc-600">
          已進入待審核狀態，審核通過後才會出現在題目列表中。
        </p>
        <button
          type="button"
          onClick={() => router.push("/browse")}
          className="w-fit rounded bg-zinc-800 px-4 py-2 text-sm text-white"
        >
          回題目列表
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">投稿新題目</h1>
        <p className="mt-1 text-sm text-zinc-500">
          尚未接自動字幕辨識與人聲分離（Phase 4 已知限制），請手動輸入文字說明。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          只能上傳你自行創作、或已取得改作與再散布授權的內容。不接受任意下載他人影片或音檔後
          上傳，這是本專案的版權護欄，見可行性評估報告與專案總覽文件。
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-600">題目類型</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={contentType === "VIDEO"}
              onChange={() => setContentType("VIDEO")}
            />
            影片切段（上傳一支影片，切出多個對話段落）
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={contentType === "AUDIO_PACK"}
              onChange={() => setContentType("AUDIO_PACK")}
            />
            純音檔語音包（每句話各自獨立上傳一個音檔，不含影片畫面）
          </label>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-600">標題</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-600">投稿者名稱</label>
          <input
            value={contributorName}
            onChange={(e) => setContributorName(e.target.value)}
            maxLength={MAX_CONTRIBUTOR_NAME_LENGTH}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-600">來源聲明</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceDeclaration"
              checked={sourceDeclaration === "ORIGINAL"}
              onChange={() => setSourceDeclaration("ORIGINAL")}
            />
            這份內容是我自行創作
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceDeclaration"
              checked={sourceDeclaration === "LICENSED"}
              onChange={() => setSourceDeclaration("LICENSED")}
            />
            這份內容我已取得改作與再散布授權
          </label>
        </fieldset>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5"
          />
          我確認以上聲明屬實，若不實由我自行承擔法律責任
        </label>

        {contentType === "VIDEO" ? (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-600">影片檔</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="text-sm text-zinc-600">
                段落（字幕與時間軸，手動輸入）
                <span className="ml-1 text-xs text-zinc-400">
                  （{videoLines.length} / {MAX_LINES_PER_CLIP}）
                </span>
              </div>
              {videoLines.map((line, i) => (
                <div key={i} className="flex flex-col gap-2 rounded border border-zinc-200 p-3">
                  <input
                    placeholder="字幕文字"
                    value={line.subtitleText}
                    onChange={(e) => updateVideoLine(i, { subtitleText: e.target.value })}
                    maxLength={MAX_SUBTITLE_TEXT_LENGTH}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder="起始秒數"
                      type="number"
                      step="0.01"
                      value={line.startSec}
                      onChange={(e) => updateVideoLine(i, { startSec: e.target.value })}
                      className="w-1/2 rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="結束秒數"
                      type="number"
                      step="0.01"
                      value={line.endSec}
                      onChange={(e) => updateVideoLine(i, { endSec: e.target.value })}
                      className="w-1/2 rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  {videoLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVideoLine(i)}
                      className="w-fit text-xs text-red-600 underline"
                    >
                      移除此段落
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addVideoLine}
                disabled={videoLines.length >= MAX_LINES_PER_CLIP}
                className="w-fit rounded border border-zinc-800 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                新增段落
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-zinc-600">
              語音（每句一個獨立音檔）
              <span className="ml-1 text-xs text-zinc-400">
                （{audioLines.length} / {MAX_LINES_PER_CLIP}）
              </span>
            </div>
            {audioLines.map((line, i) => (
              <div key={i} className="flex flex-col gap-2 rounded border border-zinc-200 p-3">
                <input
                  placeholder="文字說明"
                  value={line.subtitleText}
                  onChange={(e) => updateAudioLine(i, { subtitleText: e.target.value })}
                  maxLength={MAX_SUBTITLE_TEXT_LENGTH}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => updateAudioLine(i, { file: e.target.files?.[0] ?? null })}
                  className="text-sm"
                />
                {audioLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAudioLine(i)}
                    className="w-fit text-xs text-red-600 underline"
                  >
                    移除此段語音
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addAudioLine}
              disabled={audioLines.length >= MAX_LINES_PER_CLIP}
              className="w-fit rounded border border-zinc-800 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              新增語音
            </button>
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded bg-zinc-800 px-5 py-2.5 text-sm text-white disabled:opacity-40"
        >
          {submitting ? "送出中……" : "送出審核"}
        </button>
      </form>
    </main>
  );
}
