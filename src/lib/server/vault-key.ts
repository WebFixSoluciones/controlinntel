export class VaultConfigurationError extends Error {
  code: string;
  constructor(code: string) {
    super("No se pudo habilitar el cifrado de la bóveda. Contacta al administrador para revisar su configuración.");
    this.name = "VaultConfigurationError";
    this.code = code;
  }
}

export function parseVaultKey(value: string): Buffer {
  const text = value.trim();
  const bytes = Buffer.from(text, "base64");
  if (bytes.length !== 32 || bytes.toString("base64").replace(/=+$/, "") !== text.replace(/=+$/, "")) {
    throw new VaultConfigurationError("VAULT_KEY_INVALID");
  }
  return bytes;
}

/** Cache a pinned server-side secret; failed loads can be retried without changing keys. */
export class VaultKeyProvider {
  private key?: Buffer;
  private pending?: Promise<void>;
  private environment: () => string | undefined;
  private load: () => Promise<string>;
  constructor(environment: () => string | undefined, load: () => Promise<string>) {
    this.environment = environment;
    this.load = load;
  }
  get(): Buffer {
    const configured = this.environment();
    if (configured) return parseVaultKey(configured);
    if (this.key) return this.key;
    throw new VaultConfigurationError("VAULT_KEY_NOT_READY");
  }
  async ready(): Promise<void> {
    if (this.environment() || this.key) { this.get(); return; }
    if (!this.pending) {
      this.pending = this.load().then(value => { this.key = parseVaultKey(value); }).catch(error => {
        if (error instanceof VaultConfigurationError) throw error;
        throw new VaultConfigurationError("VAULT_KEY_UNAVAILABLE");
      }).finally(() => { this.pending = undefined; });
    }
    return this.pending;
  }
}
