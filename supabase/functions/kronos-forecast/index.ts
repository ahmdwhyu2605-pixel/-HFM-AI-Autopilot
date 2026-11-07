import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={
 "Access-Control-Allow-Origin":"https://ahmdwhyu2605-pixel.github.io",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const intervals:Record<string,{api:string,ms:number}>={
 M5:{api:"5min",ms:300000},M15:{api:"15min",ms:900000},H1:{api:"1h",ms:3600000}
};
async function candles(tf:string,key:string){
 const spec=intervals[tf];if(!spec)throw new Error("Timeframe Kronos hanya M5, M15, H1.");
 const u=new URL("https://api.twelvedata.com/time_series");
 u.searchParams.set("symbol","XAU/USD");u.searchParams.set("interval",spec.api);
 u.searchParams.set("outputsize","350");u.searchParams.set("timezone","UTC");u.searchParams.set("apikey",key);
 const r=await fetch(u,{signal:AbortSignal.timeout(18000),headers:{"Accept":"application/json"}});
 const d=await r.json();
 if(!r.ok||d.status==="error"||!Array.isArray(d.values))throw new Error("Twelve Data: "+String(d.message||d.code||"OHLC tidak tersedia").slice(0,180));
 let cs=d.values.map((v:any)=>({time:String(v.datetime||"").replace(" ","T")+"Z",open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),volume:Number(v.volume)||0}))
 .filter((c:any)=>c.time&&[c.open,c.high,c.low,c.close].every(Number.isFinite)&&c.high>=Math.max(c.open,c.close,c.low)&&c.low<=Math.min(c.open,c.close,c.high)).reverse();
 const last=cs.at(-1),stamp=last?Date.parse(last.time):NaN;
 if(Number.isFinite(stamp)&&Date.now()-stamp<spec.ms)cs.pop();
 if(cs.length<210)throw new Error(tf+" candle selesai kurang dari 210 ("+cs.length+").");
 const t=Date.parse(cs.at(-1).time);
 if(!Number.isFinite(t)||Date.now()-t>spec.ms*4)throw new Error(tf+" candle stale/kedaluwarsa.");
 return cs.slice(-512);
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return json({ok:false,error:"Login diperlukan."},401);
 const td=Deno.env.get("TWELVE_DATA_API_KEY")||"";
 const url=Deno.env.get("KRONOS_API_URL")||"";
 const token=Deno.env.get("KRONOS_SERVICE_TOKEN")||"";
 if(!td)return json({ok:false,error:"TWELVE_DATA_API_KEY belum tersedia."},503);
 if(!url||!token)return json({ok:false,error:"Kronos belum di-deploy. Konfigurasikan KRONOS_API_URL dan KRONOS_SERVICE_TOKEN setelah hosting inference service."},503);
 try{
  const timeframes=["M5","M15","H1"];
  const results=await Promise.all(timeframes.map(async tf=>{
   const cs=await candles(tf,td);
   const r=await fetch(url.replace(/\/$/,"")+"/forecast",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({symbol:"XAUUSD",timeframe:tf,candles:cs}),
    signal:AbortSignal.timeout(120000)
   });
   const d=await r.json();
   if(!r.ok||!d.ok)throw new Error(tf+": "+String(d.detail||d.error||"Kronos inference gagal").slice(0,220));
   return d;
  }));
  const dirs=results.map(x=>x.direction);
  const aligned=dirs.every(x=>x===dirs[0])&&dirs[0]!=="WAIT";
  return json({
   ok:true,model:"Kronos-base",provider:"self-hosted Kronos inference",
   symbol:"XAUUSD",source:"Twelve Data XAU/USD aggregate; not HFM broker quote",
   multi_timeframe:{M5:results[0],M15:results[1],H1:results[2]},
   agreement:aligned?"ALIGNED":"NO_ALIGNMENT",
   direction:aligned?dirs[0]:"WAIT",
   execution:"NONE",confidence:null,
   note:"Forecast direction is not a calibrated probability or order instruction. MT5 EA is not connected."
  });
 }catch(e){return json({ok:false,error:e instanceof Error?e.message:"Kronos forecast failed."},502)}
});
