import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={
 "Access-Control-Allow-Origin":"https://ahmdwhyu2605-pixel.github.io",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!req.headers.get("Authorization")?.startsWith("Bearer "))return json({ok:false,error:"Login diperlukan."},401);
 const td=Deno.env.get("TWELVE_DATA_API_KEY")||"",oa=Deno.env.get("OPENAI_API_KEY")||"",checks:any={};
 if(!td)checks.twelve_data={configured:false,connected:false,message:"Secret TWELVE_DATA_API_KEY belum dipasang."};
 else try{
  const u=new URL("https://api.twelvedata.com/time_series");u.searchParams.set("symbol","XAU/USD");u.searchParams.set("interval","1min");u.searchParams.set("outputsize","1");u.searchParams.set("apikey",td);
  const r=await fetch(u,{signal:AbortSignal.timeout(12000),headers:{"Accept":"application/json"}}),d=await r.json(),ok=r.ok&&Array.isArray(d.values)&&d.values.length>0&&d.status!=="error";
  checks.twelve_data={configured:true,connected:ok,http_status:r.status,message:ok?"API key diterima; OHLC XAU/USD merespons.":String(d.message||d.code||"Provider tidak mengembalikan OHLC.").slice(0,180)};
 }catch(e){checks.twelve_data={configured:true,connected:false,message:e instanceof Error?e.message:"Koneksi Twelve Data gagal."}}
 if(!oa)checks.openai={configured:false,connected:false,message:"Secret OPENAI_API_KEY belum dipasang."};
 else try{
  const r=await fetch("https://api.openai.com/v1/models/gpt-4o-mini",{headers:{"Authorization":"Bearer "+oa,"Accept":"application/json"},signal:AbortSignal.timeout(12000)}),d=await r.json();
  checks.openai={configured:true,connected:r.ok,http_status:r.status,message:r.ok?"API key diterima; model gpt-4o-mini dapat diakses.":String(d.error?.message||"OpenAI menolak API key atau model tidak tersedia.").slice(0,180)};
 }catch(e){checks.openai={configured:true,connected:false,message:e instanceof Error?e.message:"Koneksi OpenAI gagal."}}
 const kronosUrl=Deno.env.get("KRONOS_API_URL")||"",kronosToken=Deno.env.get("KRONOS_SERVICE_TOKEN")||"";
 if(!kronosUrl||!kronosToken)checks.kronos={configured:false,connected:false,message:"KRONOS_API_URL atau KRONOS_SERVICE_TOKEN belum dipasang."};
 else try{
  const r=await fetch(kronosUrl.replace(/\\/$/,"")+"/health",{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(12000)}),d=await r.json();
  checks.kronos={configured:true,connected:r.ok&&d.ok===true,http_status:r.status,model:d.model||"unknown",model_state:d.model_state||"unknown",message:r.ok?"Service Kronos merespons. Model dimuat saat permintaan forecast pertama.":String(d.detail||"Kronos health check gagal.").slice(0,180)};
 }catch(e){checks.kronos={configured:true,connected:false,message:e instanceof Error?e.message:"Kronos tidak dapat dijangkau."}}
 return json({ok:checks.twelve_data.connected&&checks.openai.connected&&checks.kronos?.connected,checks,checked_at:new Date().toISOString()});
});