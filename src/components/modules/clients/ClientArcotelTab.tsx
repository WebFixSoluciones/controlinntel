"use client";

import React from "react";
import { Client } from "@/types";
import { ArcotelManager } from "@/components/modules/arcotel/ArcotelManager";

interface ClientArcotelTabProps {
  client: Client;
}

export function ClientArcotelTab({ client }: ClientArcotelTabProps) {
  return <ArcotelManager client={client} isEmbedded={true} />;
}
