import { identifyActor } from "./identifyActor";
import { findReviewerByUsername, type ReviewerRole } from "@/lib/repository/reviewerStore";

// Phase 7.8：審核者角色區分（admin／reviewer）。伺服器端專用，給需要判斷
// 「目前這個請求代表的帳號能不能做管理員限定操作」的 Route Handler 用
// （目前只有 /api/admin/reviewers 系列）。
//
// identifyActor() 本身不重新做安全驗證（proxy.ts 已經擋過一次），這裡也一樣，
// 只負責回答「這個已通過驗證的請求，角色是什麼」。

export interface CurrentActor {
  username: string;
  role: ReviewerRole;
  // false 代表這次請求不是用 reviewers 資料表裡的具名帳號登入，而是用
  // ADMIN_USER／ADMIN_PASSWORD 的 Basic Auth 備援帳密（proxy.ts 允許任一
  // 方式通過即放行，見該檔案說明）。Basic Auth 本來就不對應 reviewers
  // 資料表任何一列，查不到視同管理員權限，延續一直以來「Basic Auth 是
  // 備援總開關」的既有設計，不因為導入角色區分而讓這條路徑失去管理能力。
  isNamedReviewer: boolean;
}

export async function getCurrentActor(): Promise<CurrentActor> {
  const username = await identifyActor();
  const reviewer = await findReviewerByUsername(username);
  if (!reviewer) {
    return { username, role: "admin", isNamedReviewer: false };
  }
  return { username: reviewer.username, role: reviewer.role, isNamedReviewer: true };
}

export async function requireAdmin(): Promise<CurrentActor | null> {
  const actor = await getCurrentActor();
  return actor.role === "admin" ? actor : null;
}
