import { updateContributionStatus } from "@/lib/repository/contributionStore";
import { identifyActor } from "@/lib/auth/identifyActor";
import type { ClipStatus } from "@/lib/types/line";
import { withErrorHandling } from "@/lib/http/withErrorHandling";

export const runtime = "nodejs";

async function patchHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as ClipStatus | undefined;

  if (status !== "APPROVED" && status !== "REJECTED") {
    return Response.json({ error: "status 必須是 APPROVED 或 REJECTED" }, { status: 400 });
  }

  const reviewedBy = await identifyActor();
  const updated = await updateContributionStatus(id, status, reviewedBy);
  if (!updated) {
    return Response.json({ error: "找不到該投稿" }, { status: 404 });
  }
  return Response.json(updated);
}

export const PATCH = withErrorHandling(patchHandler);
