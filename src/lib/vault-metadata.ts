const secretFields = ["password", "secret", "encryptedPassword", "passwordHash", "totpSecret", "pppoePassword"] as const;

/** Only metadata belongs in application state and its local recovery snapshots. */
export function vaultMetadata<T extends object>(record: T): Omit<T, typeof secretFields[number]> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !(secretFields as readonly string[]).includes(key))) as Omit<T, typeof secretFields[number]>;
}
