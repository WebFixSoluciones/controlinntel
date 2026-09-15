import { z } from "zod";
import { validateIdentification } from "../validation-engine";
const text = z.string().trim().min(1).max(500);
const money = z.number().finite().nonnegative().max(100000000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)));
const client = z.object({
  businessName: text, identificationType: z.enum(["RUC", "CEDULA", "PASAPORTE"]),
  identificationNumber: text, email: z.string().email(), phone: text, address: text,
  status: z.enum(["activo", "suspendido", "retirado"]),
}).passthrough().superRefine((v,c) => {
  const result = validateIdentification(v.identificationType, v.identificationNumber);
  if (!result.isValid) c.addIssue({code:"custom",message:result.error || "Identificación inválida"});
});
export const schemas: Record<string, z.ZodTypeAny> = {
  clients: client,
  clientServices: z.object({clientId:text, planId:text, customPrice:money, status:z.enum(["activo","suspendido","retirado","en_instalacion"])}).passthrough(),
  plans: z.object({name:text, downloadMbps:money, uploadMbps:money, defaultPrice:money, billingType:z.enum(["prepago","pospago"]),description:z.string().max(2000)}).passthrough(),
  nodes: z.object({name:text,address:text,totalCapacityMbps:z.number().positive(),usedCapacityMbps:money,status:z.enum(["online","offline","warning"])}).passthrough(),
  ipPools: z.object({name:text,subnetCidr:text,gateway:text,nodeId:text,type:z.enum(["cgnat","publica_fija","ipv6_pool"]),totalIpsCount:z.number().int().positive(),usableIpsCount:z.number().int().nonnegative(),assignedIpsCount:z.number().int().nonnegative()}).passthrough(),
  policies: z.object({policyNumber:text,insuranceCompany:text,startDate:date,expirationDate:date,insuredAmount:money}).passthrough().refine(v=>v.expirationDate>=v.startDate,"Fechas inválidas"),
  tickets: z.object({clientId:text,title:text,description:text,priority:z.enum(["baja","media","alta","critica"]),status:z.enum(["abierto","en_progreso","resuelto","cerrado"])}).passthrough(),
  expenses: z.object({supplierName:text,amount:money,expenseDate:date,description:text}).passthrough(),
  clientProjects: z.object({clientId:text,title:text,column:z.enum(["factibilidad","tendido_fibra","fusion_splitters","instalacion_ont","pruebas_homologacion","completado"]),dueDate:date,checklist:z.array(z.object({id:text,text:text,done:z.boolean()})).max(100)}).passthrough(),
  clientContracts: z.object({clientId:text,contractNumber:text,signedDate:date,expirationDate:date,monthlyPrice:money}).passthrough().refine(v=>v.expirationDate>=v.signedDate,"Fechas inválidas"),
  clientQuotes: z.object({clientId:text,title:text,items:z.array(z.object({id:text,description:text,quantity:z.number().positive().max(1000000),unitPrice:money,total:money})).min(1).max(100),status:z.enum(["borrador","enviada","aprobada","orden_pedido","facturada"])}).passthrough(),
  vault: z.object({serviceName:text,username:text,allowedRoles:z.array(text).min(1)}).passthrough(),
  clientVaultItems: z.object({clientId:text,serviceName:text,username:text,category:text}).passthrough(),
};

