import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// 伺服器端專用。密碼雜湊用 Node 內建的 crypto.scrypt，不額外引入 bcrypt 之類的
// 套件——這個專案已經因為 Prisma 需要下載二進位引擎檔而在開發沙盒踩過網路白名單
// 的坑（見 配音擂台-infra.md），能用內建模組解決的就不額外引入有原生編譯／下載
// 需求的套件，降低風險。

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
