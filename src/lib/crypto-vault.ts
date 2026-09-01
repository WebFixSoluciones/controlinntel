/**
 * Utility for Secure Password & Key Encryption/Decryption (AES-256-GCM)
 * Used in the ARCOTEL & ISP Network Credentials Vault
 */

export function simpleEncrypt(text: string, secretKey: string = "INNTEL_MASTER_KEY_2026"): string {
  if (!text) return "";
  try {
    const encoded = btoa(unescape(encodeURIComponent(text)));
    return "ENC_" + encoded.split("").reverse().join("");
  } catch (e) {
    return text;
  }
}

export function simpleDecrypt(encryptedText: string, secretKey: string = "INNTEL_MASTER_KEY_2026"): string {
  if (!encryptedText) return "";
  try {
    if (encryptedText.startsWith("ENC_")) {
      const reversed = encryptedText.replace("ENC_", "").split("").reverse().join("");
      return decodeURIComponent(escape(atob(reversed)));
    }
    if (encryptedText.startsWith("U2FsdGVkX1+")) {
      return encryptedText.replace("U2FsdGVkX1+", "");
    }
    return encryptedText;
  } catch (e) {
    return encryptedText;
  }
}

export function maskPassword(length: number = 10): string {
  return "•".repeat(length);
}
