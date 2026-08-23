"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Phase 7.2：審核者帳號管理介面。取代 Phase 7 時「只能跑
// scripts/create-reviewer.mjs 建帳號」的已知限制，可以新增帳號、停用／啟用、
// 重設密碼。
// Phase 7.8：加上角色區分（admin／reviewer），只有 admin 角色能看到並操作這個
// 頁面，一般 reviewer 角色只能停在審核（核准／駁回），管不到帳號本身。
// 頁面先打 /api/admin/whoami 問自己是誰、什麼角色，不是 admin 就直接顯示提示，
// 不渲染管理表單（就算硬打 API 也會被伺服器端的 requireAdmin() 擋下，這裡只是
// 提早給使用者清楚的訊息，不用等到操作失敗才知道）。

type ReviewerRole = "admin" | "reviewer";

interface Reviewer {
  id: string;
  username: string;
  active: boolean;
  role: ReviewerRole;
  createdAt: string;
}

interface Whoami {
  username: string;
  role: ReviewerRole;
  isNamedReviewer: boolean;
}

const ROLE_LABEL: Record<ReviewerRole, string> = {
  admin: "管理員",
  reviewer: "一般審核者",
};

export default function ReviewersPage() {
  const [whoami, setWhoami] = useState<Whoami | null>(null);
  const [whoamiError, setWhoamiError] = useState<string | null>(null);

  const [reviewers, setReviewers] = useState<Reviewer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUsername, setBusyUsername] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<ReviewerRole>("reviewer");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/reviewers");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `載入失敗（${res.status}）`);
        return;
      }
      const data = (await res.json()) as Reviewer[];
      setReviewers(data);
    } catch {
      setError("載入失敗，請確認網路連線");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/admin/whoami");
        if (cancelled) return;
        if (!res.ok) {
          setWhoamiError(`無法確認身份（${res.status}）`);
          return;
        }
        const data = (await res.json()) as Whoami;
        if (cancelled) return;
        setWhoami(data);
        if (data.role === "admin") {
          await load();
        }
      } catch {
        if (!cancelled) setWhoamiError("無法確認身份，請確認網路連線");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/reviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCreateError(body.error ?? "建立失敗");
        return;
      }
      setNewUsername("");
      setNewPassword("");
      setNewRole("reviewer");
      await load();
    } catch {
      setCreateError("建立失敗，請確認網路連線後再試");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(reviewer: Reviewer) {
    setError(null);
    setBusyUsername(reviewer.username);
    try {
      const res = await fetch(`/api/admin/reviewers/${encodeURIComponent(reviewer.username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !reviewer.active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "操作失敗");
        return;
      }
      await load();
    } catch {
      setError("操作失敗，請稍後再試");
    } finally {
      setBusyUsername(null);
    }
  }

  async function handleToggleRole(reviewer: Reviewer) {
    setError(null);
    setBusyUsername(reviewer.username);
    const nextRole: ReviewerRole = reviewer.role === "admin" ? "reviewer" : "admin";
    try {
      const res = await fetch(`/api/admin/reviewers/${encodeURIComponent(reviewer.username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "操作失敗");
        return;
      }
      await load();
    } catch {
      setError("操作失敗，請稍後再試");
    } finally {
      setBusyUsername(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    setBusyUsername(resetTarget);
    try {
      const res = await fetch(`/api/admin/reviewers/${encodeURIComponent(resetTarget)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResetError(body.error ?? "重設失敗");
        return;
      }
      setResetTarget(null);
      setResetPassword("");
    } catch {
      setResetError("重設失敗，請稍後再試");
    } finally {
      setBusyUsername(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">審核者帳號管理</h1>
        <Link href="/admin/review" className="text-sm text-zinc-500 underline">
          回審核後台
        </Link>
      </div>

      {whoamiError && <div className="text-sm text-red-600">{whoamiError}</div>}
      {whoami === null && !whoamiError && <div className="text-sm text-zinc-500">載入中……</div>}

      {whoami && whoami.role !== "admin" && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          只有管理員能查看與管理審核者帳號。你目前是「{ROLE_LABEL[whoami.role]}」身份
          （{whoami.username}），如需管理帳號請聯絡管理員。
        </div>
      )}

      {whoami && whoami.role === "admin" && (
        <>
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded border border-zinc-200 p-4"
          >
            <p className="text-sm font-medium">新增帳號</p>
            <p className="text-xs text-zinc-500">
              帳號若已存在，這裡會直接視同「重設密碼＋重新啟用」，角色沿用既有值不變。
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600">帳號</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600">密碼（至少 8 碼）</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600">角色</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as ReviewerRole)}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                >
                  <option value="reviewer">一般審核者</option>
                  <option value="admin">管理員</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating || !newUsername.trim() || newPassword.length < 8}
                className="rounded bg-zinc-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {creating ? "處理中……" : "建立／重設"}
              </button>
            </div>
            {createError && <div className="text-sm text-red-600">{createError}</div>}
          </form>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {reviewers === null && !error && <div className="text-sm text-zinc-500">載入中……</div>}
          {reviewers && reviewers.length === 0 && (
            <div className="text-sm text-zinc-500">目前沒有任何審核者帳號。</div>
          )}

          <div className="flex flex-col gap-2">
            {reviewers?.map((reviewer) => (
              <div key={reviewer.id} className="rounded border border-zinc-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {reviewer.username}
                      {reviewer.username === whoami.username && (
                        <span className="ml-2 text-xs text-zinc-400">（就是你）</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      建立於 {new Date(reviewer.createdAt).toLocaleString("zh-TW")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        reviewer.role === "admin"
                          ? "rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
                          : "rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                      }
                    >
                      {ROLE_LABEL[reviewer.role]}
                    </span>
                    <span
                      className={
                        reviewer.active
                          ? "rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          : "rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600"
                      }
                    >
                      {reviewer.active ? "啟用中" : "已停用"}
                    </span>
                    <button
                      type="button"
                      disabled={busyUsername === reviewer.username}
                      onClick={() => handleToggleRole(reviewer)}
                      className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 disabled:opacity-40"
                    >
                      {reviewer.role === "admin" ? "設為一般審核者" : "設為管理員"}
                    </button>
                    <button
                      type="button"
                      disabled={busyUsername === reviewer.username}
                      onClick={() => handleToggleActive(reviewer)}
                      className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 disabled:opacity-40"
                    >
                      {reviewer.active ? "停用" : "啟用"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setResetTarget(resetTarget === reviewer.username ? null : reviewer.username)
                      }
                      className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600"
                    >
                      重設密碼
                    </button>
                  </div>
                </div>

                {resetTarget === reviewer.username && (
                  <form
                    onSubmit={handleResetPassword}
                    className="mt-3 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-3"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-600">新密碼（至少 8 碼）</label>
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                        autoComplete="new-password"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busyUsername === reviewer.username || resetPassword.length < 8}
                      className="rounded bg-zinc-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
                    >
                      確認重設
                    </button>
                  </form>
                )}
                {resetTarget === reviewer.username && resetError && (
                  <div className="mt-2 text-sm text-red-600">{resetError}</div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-400">
            停用帳號只會擋住之後的登入，該帳號已經登入、還沒過期的 session（最長 7 天）不會立即失效。
            不能停用或降級「目前登入中的自己」，需要用其他管理員帳號操作。
          </p>
        </>
      )}
    </main>
  );
}
