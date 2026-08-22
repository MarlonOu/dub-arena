// proxy.ts（middleware）跟一般 Route Handler 都會用到這個模組，兩邊的執行環境
// 不保證相同（middleware 傳統上跑在 Edge runtime），所以刻意只用兩邊都有的
// Web Crypto API（globalThis.crypto.subtle），不用 Node 專屬的 crypto 模組
// （密碼雜湊那邊因為只有 Node runtime 的 API 路由會用到，才用 Node 的 crypto，
// 見 lib/auth/password.ts）。

export const SESSION_COOKIE_NAME = "dub_arena_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 天

interface SessionPayload {
  sub: string; // reviewer username
  exp: number; // unix seconds
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 明確標成 Uint8Array<ArrayBuffer>（非泛型預設的 ArrayBufferLike，那個聯集也包含
// SharedArrayBuffer），因為 Web Crypto API 的 BufferSource 型別在較新版
// TypeScript 下不接受 ArrayBufferLike，實測會編譯失敗，這裡用 as 明確收斂型別。
function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(username: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadPart = base64UrlEncode(payloadBytes);

  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  const signaturePart = base64UrlEncode(new Uint8Array(signature));

  return `${payloadPart}.${signaturePart}`;
}

export async function verifySession(token: string, secret: string): Promise<string | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const payloadBytes = base64UrlDecode(payloadPart);
  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signaturePart),
    payloadBytes
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const sessionCookieMaxAge = SESSION_MAX_AGE_SECONDS;
