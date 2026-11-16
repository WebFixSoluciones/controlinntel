// In-memory transaction adapter for isolated production-command QA.
export class Database {
  rows = new Map<string,any>(); tail=Promise.resolve(); failCommit=false;
  constructor(initial:Record<string,any[]>) {for(const [name,rows] of Object.entries(initial))for(const row of rows)this.rows.set(name+"/"+row.id,structuredClone(row));}
  doc(path:string):any {return {path,id:path.split("/").pop(),parent:{id:path.split("/")[0]}};}
  collection(name:string):any {const query=(field?:string,value?:unknown):any=>({name,field,value,doc:(id:string)=>this.doc(name+"/"+id),where:(f:string,_op:string,v:unknown)=>query(f,v),select:()=>query(field,value),
    get:async()=>({docs:this.list(name).filter(row=>!field||row[field]===value).map(row=>({get:(key:string)=>row[key]}))})});return query();}
  async runTransaction(fn:(tx:any)=>Promise<any>) {
    let release!:()=>void;const prior=this.tail;this.tail=new Promise<void>(r=>release=r);await prior;
    const pending=new Map<string,any>(); const deleted=new Set<string>();
    const snap=(path:string)=>({id:path.split("/").pop(),ref:this.doc(path),exists:this.rows.has(path),data:()=>structuredClone(this.rows.get(path))});
    const tx={delete:(ref:any)=>deleted.add(ref.path),get:async(ref:any)=>ref.path?snap(ref.path):{docs:[...this.rows].filter(([key,row])=>key.startsWith(ref.name+"/")&&(!ref.field||row[ref.field]===ref.value)).map(([key])=>snap(key))},getAll:async(...refs:any[])=>refs.map(ref=>snap(ref.path)),set:(ref:any,row:any)=>pending.set(ref.path,structuredClone(row)),update:(ref:any,row:any)=>pending.set(ref.path,{...structuredClone(this.rows.get(ref.path)),...structuredClone(row)}),create:(ref:any,row:any)=>{if(this.rows.has(ref.path))throw Error("Already exists");pending.set(ref.path,structuredClone(row));}};
    try {const result=await fn(tx);if(this.failCommit)throw Error("Injected commit failure");pending.forEach((row,key)=>this.rows.set(key,row));deleted.forEach(key=>this.rows.delete(key));return result;} finally{release();}
  }
  list(name:string){return [...this.rows].filter(([key])=>key.startsWith(name+"/")).map(([,row])=>row);}
  row(name:string,id:string){return this.rows.get(name+"/"+id);}
}
