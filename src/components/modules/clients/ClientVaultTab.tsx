"use client";
import type {Client} from "@/types";
import {SecureVault} from "../vault/SecureVault";
export function ClientVaultTab({client}:{client:Client}){return <SecureVault clientId={client.id}/>;}

