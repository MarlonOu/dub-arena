"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 7：具名審核者帳號登入。這個頁面本身不受 proxy.ts 保護（否則沒登入的人
// 進不來登入頁面就死循環了），/admin/review 才受保護。若伺服器沒設定
// SESSION_SECRET 或沒有任何審核者帳號，仍可用 Basic Auth 直接登入
// /admin/review（瀏覽器會跳原生登入框），這個頁面只是額外的登入方式。

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "登入失敗");
        return;
      }
      router.push("/admin/review");
      router.refresh();
    } catch {
      setError("登入失敗，請確認網路連線後再試");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">審核者登入</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-600">帳號</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            autoComplete="username"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-600">密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded bg-zinc-800 px-5 py-2.5 text-sm text-white disabled:opacity-40"
        >
          {submitting ? "登入中……" : "登入"}
        </button>
      </form>
    </main>
  );
}
