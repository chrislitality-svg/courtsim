import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const SALT = "courtsim-v1";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "请设置环境变量 ENCRYPTION_KEY（至少 16 字符，建议 32 字节随机串）",
    );
  }
  return scryptSync(secret, SALT, 32);
}

/** 加密 API Key 等敏感字段；未配置 ENCRYPTION_KEY 时退化为明文存储（仅开发） */
export function encryptSecret(plain: string): string {
  try {
    const key = getKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  } catch {
    if (process.env.NODE_ENV === "production") throw new Error("缺少 ENCRYPTION_KEY");
    return `plain:${plain}`;
  }
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith("plain:")) return stored.slice(6);
  try {
    const key = getKey();
    const buf = Buffer.from(stored, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + 16);
    const data = buf.subarray(IV_LEN + 16);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return stored;
  }
}
