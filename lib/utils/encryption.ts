import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function getKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  return crypto.scryptSync(encryptionKey, "salt", 32);
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

export function decrypt(encryptedData: string): string {
  const key = getKey();
  const data = Buffer.from(encryptedData, "base64");

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = data.subarray(ENCRYPTED_POSITION);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

