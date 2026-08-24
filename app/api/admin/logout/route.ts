import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/http/withErrorHandling";

export const runtime = "nodejs";

async function logoutHandler() {
  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}

export const POST = withErrorHandling(logoutHandler);
