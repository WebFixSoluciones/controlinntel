import {NextRequest,NextResponse} from "next/server";
import {actor,requirePermission,HttpError} from "@/lib/server/security";
import {adminServices} from "@/lib/server/admin";
import {reconcileCommercial} from "@/lib/reconciliation";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  try{const user=await actor(request);requirePermission(user,"manage_finance");const {db}=adminServices(),data:Record<string,any[]>={};
    await Promise.all(["clients","clientServices","billingInvoices","monthlyCharges","clientAdvances","bankAccounts","financialMovements","inventoryProducts","inventoryKardex"].map(async name=>{const result=await db.collection(name).get();data[name]=result.docs.map(d=>({...d.data(),id:d.id}));}));
    const issues=reconcileCommercial(data);return NextResponse.json({checkedAt:new Date().toISOString(),issues,readOnly:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo conciliar."},{status:error instanceof HttpError?error.status:503});}
}
