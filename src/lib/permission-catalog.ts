import type { UserModulePermissions } from "@/types";
import { editableModulePermissions } from "./permissions.ts";

export type PermissionItem = {path:string;label:string;reserved?:boolean};
export type PermissionSection = {key:string;label:string;items:PermissionItem[]};
const labels:Record<string,string> = {
 canCreateTicket:"Crear tickets",canEditTicket:"Editar y asignar tickets",canReplyTicket:"Responder tickets y guardar notas",canDeleteTicket:"Eliminar tickets",canManageSubjects:"Administrar asuntos de soporte",canResolveTickets:"Resolver y cerrar tickets",canCreateProject:"Crear proyectos",canEditProject:"Editar proyectos y su gestión",canDeleteProject:"Eliminar proyectos",canManageClientTasks:"Crear, editar y eliminar tareas de clientes",canManageRegulatoryData:"Editar parámetros y registros regulatorios",canManageRegulatoryFiles:"Subir y reemplazar archivos regulatorios",canEditGeneralSettings:"Guardar configuración general",canEditSriSettings:"Guardar SRI, firma y correo",
 canViewServicePrices:"Ver tarifas de servicios",canViewProductPrices:"Ver precios de productos",canViewFinancialAmounts:"Ver importes comerciales y financieros",
 canCreateClient:"Crear clientes",canEditClient:"Editar clientes y asignar servicios",canEditServicePrices:"Cambiar tarifas de servicios del cliente",canUploadContracts:"Subir contratos y archivos",canDeleteContracts:"Eliminar archivos del cliente",canDeleteClient:"Retirar clientes",
 canCreateProduct:"Crear productos",canCreateService:"Crear servicios",canEditProduct:"Editar catálogo y categorías",canChangePrices:"Cambiar precios del catálogo",canViewCosts:"Ver costos y valoración de inventario",canAdjustStock:"Ajustar existencias",canTransferWarehouses:"Transferir entre bodegas",canDeleteItems:"Retirar artículos del catálogo",
 canCreateInvoice:"Crear documentos y emitir períodos",canEditPrices:"Editar documentos y precios",canApplyDiscounts:"Aplicar descuentos",canAuthorizeSri:"Enviar y reintentar autorizaciones SRI",canCancelInvoices:"Anular o retirar documentos permitidos",canCreateQuotes:"Crear y editar cotizaciones",canApproveQuotes:"Convertir cotizaciones en ventas",canViewSalesReports:"Consultar informes de ventas",
 canCreateSupplier:"Crear y editar proveedores",canRegisterPurchase:"Registrar compras y ajustes de proveedor",canApprovePayments:"Autorizar pagos a proveedores",canEmitWithholding:"Emitir retenciones",canViewSupplierBank:"Ver datos bancarios de proveedores",
 canManageExpenseCategories:"Administrar categorías de gastos",canManageBankAccounts:"Crear, editar y ajustar cuentas bancarias",canTransferFunds:"Transferir fondos entre cuentas",canViewBankBalances:"Ver saldos bancarios",canRegisterReceipts:"Registrar cobros y anticipos",canRegisterExpenses:"Registrar y corregir gastos",canCancelPayments:"Anular cobros y revertir aplicaciones",canExportReports:"Exportar informes financieros",
 canManageNodes:"Crear, editar y retirar nodos",canAssignIps:"Administrar direcciones IP",canEditRouterCredentials:"Ver y modificar credenciales de sistemas",
 canManageCredentials:"Crear y editar credenciales",canViewClientVault:"Acceder a credenciales de clientes",canViewInternalVault:"Acceder a la bóveda interna",canRevealPasswords:"Revelar contraseñas",canDeleteCredentials:"Eliminar credenciales",canManageDepartments:"Administrar departamentos de soporte",canManageTemplates:"Crear, editar y retirar plantillas"
};
const subLabels:Record<string,string>={fiscal:"Identificación",red:"Nodos del cliente",boveda:"Bóveda del cliente",contratos:"Servicios del cliente",archivos:"Archivos del cliente",cotizaciones:"Cotizaciones",facturacion:"Facturación del cliente",finanzas:"Cobros del cliente",tickets:"Tickets del cliente",proyectos:"Tareas del cliente",tramites:"Trámites",arcotel:"ARCOTEL del cliente",dossier:"Informes del cliente",proveedores:"Proveedores",usuarios_equipo:"Usuarios (reservado al superadministrador)",roles_permisos:"Roles y permisos (reservado al superadministrador)",notas_venta:"Notas de venta",nueva_venta:"Nueva venta",recurrentes:"Ventas recurrentes",facturas:"Facturas electrónicas",notas_credito:"Notas de crédito",notas_debito:"Notas de débito",retenciones:"Retenciones",guias_remision:"Guías de remisión",productos:"Productos",servicios:"Servicios",categorias:"Categorías",kardex:"Kardex",transferencias:"Transferencias",bodegas:"Bodegas",ajustes:"Ajustes",cobranzas:"Cobranzas",anticipos:"Anticipos",gastos:"Gastos",movimientos:"Movimientos",bancos:"Bancos y cajas",cuentas_por_cobrar:"Cuentas por cobrar",cuentas_por_pagar:"Cuentas por pagar",reportes:"Reportes",nodos:"Nodos",pools_ip:"Reservas de IP",general:"Configuración general",sri:"SRI, firma y correo de facturación"};
const moduleLabels:Record<string,string>={dashboard:"Dashboard",abonados:"Clientes y ficha 360°",personas:"Personas",ventas:"Ventas",compras:"Compras",facturacion:"Facturación SRI",inventarios:"Inventarios",finanzas:"Finanzas",red:"Red y nodos",proyectos:"Proyectos",tickets:"Soporte",arcotel:"ARCOTEL",boveda:"Bóveda",plantillas:"Plantillas",configuracion:"Configuración"};
const complete = editableModulePermissions({uid:"catalog",email:"",displayName:"",role:"superadmin",status:"activo",permissions:["all"]});
complete.personas!.submodules.roles_permisos=true;
complete.finanzas!.submodules.anticipos=true;
complete.tickets!.actions={...complete.tickets!.actions,canCreateTicket:true,canEditTicket:true,canReplyTicket:true,canDeleteTicket:true,canManageSubjects:true,canResolveTickets:true};
complete.proyectos!.actions={canCreateProject:true,canEditProject:true,canDeleteProject:true,canManageClientTasks:true};
complete.arcotel!.actions={canManageRegulatoryData:true,canManageRegulatoryFiles:true};
complete.configuracion!.actions={canEditGeneralSettings:true,canEditSriSettings:true};
const catalogMatrix:UserModulePermissions=complete;
export function flattenPermissions(value:unknown,prefix=""):Record<string,boolean>{
 const result:Record<string,boolean>={};if(!value||typeof value!=="object"||Array.isArray(value))return result;
 for(const [key,entry]of Object.entries(value)){const path=prefix?prefix+"."+key:key;if(typeof entry==="boolean")result[path]=entry;else Object.assign(result,flattenPermissions(entry,path));}return result;
}
export const permissionPaths=new Set(Object.keys(flattenPermissions(catalogMatrix)));
export const reservedPermissionPaths=new Set(["personas.submodules.usuarios_equipo","personas.submodules.roles_permisos"]);
export function permissionValue(value:UserModulePermissions,path:string):boolean {return flattenPermissions(value)[path]===true;}
export function setPermission(value:UserModulePermissions,path:string,enabled:boolean):UserModulePermissions{
 if(!permissionPaths.has(path))throw Error("Permiso desconocido: "+path);
 const result=structuredClone(value) as Record<string,any>;const parts=path.split(".");let node=result;
 for(const part of parts.slice(0,-1)){node[part]??={};node=node[part];}node[parts.at(-1)!]=enabled;
 if(path==="abonados.enabled")result.clientes={...result.clientes,enabled};return result;
}
export function completePermissions(value:UserModulePermissions={},overrides:Record<string,boolean>={}):UserModulePermissions{
 const result:UserModulePermissions={};const incoming={...flattenPermissions(value),...overrides};
 for(const path of permissionPaths){const parts=path.split(".");let node=result as Record<string,any>;for(const part of parts.slice(0,-1)){node[part]??={};node=node[part];}node[parts.at(-1)!]=reservedPermissionPaths.has(path)?false:incoming[path]===true;}
 if(result.clientes)result.clientes.enabled=result.abonados?.enabled===true;
 return result;
}
export function permissionSections():PermissionSection[]{
 const sections:PermissionSection[]=[{key:"visibility",label:"Visibilidad de datos",items:Object.keys(catalogMatrix.visibility!).map(key=>({path:"visibility."+key,label:labels[key]}))}];
 for(const[key,label]of Object.entries(moduleLabels)){
  const value=(catalogMatrix as any)[key],items:PermissionItem[]=[{path:key+".enabled",label:"Acceder a "+label}];
  for(const sub of Object.keys(value?.submodules||{}))items.push({path:key+".submodules."+sub,label:subLabels[sub]||sub,reserved:reservedPermissionPaths.has(key+".submodules."+sub)});
  const actions=key==="ventas"?catalogMatrix.ventas?.actions||catalogMatrix.facturacion!.actions:value?.actions;
  for(const action of Object.keys(actions||{})){if(key==="ventas"&&action==="canAuthorizeSri")continue;items.push({path:key+".actions."+action,label:labels[action]||action});}
  if(key==="abonados")for(const action of Object.keys(catalogMatrix.clientes!.actions!))items.push({path:"clientes.actions."+action,label:labels[action]||action});
  if(key==="arcotel")items.push({path:"actions.canDeleteFiles",label:"Eliminar archivos regulatorios"});
  sections.push({key,label,items});
 }
 return sections;
}
