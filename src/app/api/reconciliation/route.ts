import {NextRequest,NextResponse} from "next/server";
import {actor,HttpError} from "@/lib/server/security";
import {adminServices} from "@/lib/server/admin";
import {reconcileCommercial} from "@/lib/reconciliation";
import {canAccessSubmodule, canUser, type Entity} from "@/lib/permissions";
import {canReadCollection, canReadBillingDocument} from "@/lib/persistence-contracts";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  try{const user=await actor(request);if(!canAccessSubmodule(user,"finanzas","reportes"))throw new HttpError(403,"No tienes acceso a reportes financieros.");const {db}=adminServices(),data:Record<string,any[]>={};
    await Promise.all(["clients","clientServices","billingInvoices","monthlyCharges","clientAdvances","bankAccounts","financialMovements","inventoryProducts","inventoryKardex"].map(async name=>{const result=await db.collection(name).get();data[name]=result.docs.map(d=>({...d.data(),id:d.id}));}));
    const issues=reconcileCommercial(data).filter(issue=>canReadCollection(user,issue.collection as Entity))
      .filter(issue=>issue.collection!=="billingInvoices" || canReadBillingDocument(user,data.billingInvoices.find(row=>row.id===issue.id)||{}))
      .map(issue=>{
        if ((issue.collection==="bankAccounts"&&!canUser(user,"finanzas","canViewBankBalances")) || (issue.collection.startsWith("inventory")&&!canUser(user,"inventarios","canViewCosts"))) {
          const {expected,actual,...visible}=issue;return visible;
        }
        return issue;
      });return NextResponse.json({checkedAt:new Date().toISOString(),issues,readOnly:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo conciliar."},{status:error instanceof HttpError?error.status:503});}
}
