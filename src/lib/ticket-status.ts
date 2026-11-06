export function isClosedTicketStatus(status: unknown): boolean {
  return status === "resuelto" || status === "cerrado";
}

export function requiresPublicTicketReply(current: unknown, next: unknown, reply?: { body: string; isInternal: boolean }): boolean {
  return current !== next && isClosedTicketStatus(next) && (!reply || reply.isInternal || !reply.body.trim());
}
