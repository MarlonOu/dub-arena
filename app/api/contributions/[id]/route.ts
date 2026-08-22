import { updateContributionStatus } from "@/lib/repository/contributionStore";
import type { ClipStatus } from "@/lib/types/line";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as ClipStatus | undefined;

  if (status !== "APPROVED" && status !== "REJECTED") {
    return Response.json({ error: "status 必須是 APPROVED 或 REJECTED" }, { status: 400 });
  }

  const updated = await updateContributionStatus(id, status);
  if (!updated) {
    return Response.json({ error: "找不到該投稿" }, { status: 404 });
  }
  return Response.json(updated);
}
