import type { UserProfile, UserModulePermissions, UserRoleTemplate } from "@/types";
import { completePermissions, flattenPermissions, permissionPaths, reservedPermissionPaths, setPermission } from "./permission-catalog.ts";
import { userAccessSnapshot } from "./user-access.ts";
import { canUser } from "./permissions.ts";

export class RoleAccessError extends Error {constructor(message:string){super(message);}}
export function normalizedRole(role:UserRoleTemplate):UserRoleTemplate{
 const snapshot=userAccessSnapshot({uid:"role",email:"",displayName:role.name,role:role.baseRole,status:"activo",permissionModelVersion:2,modulePermissions:role.modulePermissions});
 let matrix=completePermissions(snapshot.modulePermissions);
 // Older consultation templates could contain dormant write flags. Preserve their effective read-only access when upgrading.
 if(role.baseRole==="consulta")for(const path of Object.keys(flattenPermissions(matrix))){const parts=path.split(".");if(parts[1]==="actions"&&!canUser({...snapshot,uid:"role",email:"",displayName:role.name,role:"consulta",status:"activo"},parts[0] as keyof UserModulePermissions,parts[2]))matrix=setPermission(matrix,path,false);}
 return {...role,status:role.status||"activo",version:role.version||0,description:role.description||"",modulePermissions:matrix,permissionModelVersion:2};
}
export function validOverrides(value:Record<string,boolean>={}):Record<string,boolean>{
 for(const[path,flag]of Object.entries(value))if(!permissionPaths.has(path)||typeof flag!=="boolean"||(reservedPermissionPaths.has(path)&&flag))throw new RoleAccessError("La personalización contiene un permiso no permitido.");
 return {...value};
}
export function applyRoleOverrides(base:UserModulePermissions,overrides:Record<string,boolean>={}):UserModulePermissions{
 return completePermissions(base,validOverrides(overrides));
}
export function permissionDifferences(base:UserModulePermissions,effective:UserModulePermissions,previous:Record<string,boolean>={}):Record<string,boolean>{
 const original=flattenPermissions(completePermissions(base)),values=flattenPermissions(completePermissions(effective)),result:Record<string,boolean>={};
 for(const[path,flag]of Object.entries(values)){if(path==="clientes.enabled"||reservedPermissionPaths.has(path))continue;if(flag!==original[path]||(path in previous&&previous[path]===flag))result[path]=flag;}
 return result;
}
export function resolveAssignedRole(profile:UserProfile,definition:UserRoleTemplate|null|undefined):UserProfile{
 if(!profile.accessRoleId)return profile;
 if(profile.role==="superadmin")throw new RoleAccessError("El superadministrador utiliza su perfil protegido de sistema.");
 if(!definition||definition.id!==profile.accessRoleId)throw new RoleAccessError("El rol asignado ya no está disponible. Contacta al administrador.");
 const role=normalizedRole(definition);if(role.status!=="activo")throw new RoleAccessError("El rol asignado está inactivo. Contacta al administrador.");
 const permissions=applyRoleOverrides(role.modulePermissions,profile.permissionOverrides);
 // Custom roles are governed entirely by their matrix. The legacy enum remains an internal compatibility category.
 const resolved={...profile,role:"admin" as const,permissionModelVersion:2 as const,modulePermissions:permissions,accessRoleName:role.name,accessRoleVersion:role.version||0,accessRoleStatus:"activo" as const};
 return {...resolved,...userAccessSnapshot(resolved)};
}
export function administrationProfile(profile:UserProfile,role:UserRoleTemplate|undefined):UserProfile{
 try{return resolveAssignedRole(profile,role);}catch{return {...profile,modulePermissions:completePermissions(),permissions:[],accessRoleName:role?.name||profile.accessRoleName||"Rol no disponible",accessRoleStatus:role?"inactivo":"missing"};}
}
