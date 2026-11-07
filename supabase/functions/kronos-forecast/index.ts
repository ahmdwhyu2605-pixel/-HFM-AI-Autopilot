import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"Access-Control-Allow-Origin":"https://ahmdwhyu2605-pixel.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const intervals:Record<string,{api:string,ms:number}>={M5:{api:"5min",ms:300000},M15:{api:"15min",ms:900000},H1:{api:"1h",ms:3600000}};
async function fetchBars(tf:string,key:string){
 const spec=intervals[tf],u=new URL("https://api.twelvedata.com/time_series");
 u.searchParams.set("symbol","XAU/USD");u.searchParams.set("interval",spec.api);u.searchParams.set("outputsize","350");u.searchParams.set("timezone","UTC");u.searchParams.set("apikey",key);
 const r=await fetch(u,{signal:AbortSignal.timeout(18000)}),d=await r.json();
 if(!r.ok||d.status==="error"||!Array.isArray(d.values))throw Error("Twelve Data "+tf+": "+String(d.message||d.code||"OHLC unavailable").slice(0,150));
 let a=d.values.map((v:any)=>({time:String(v.datetime||"").replace(" ","T")+"Z",open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close),volume:Number(v.volume)||0})).filter((x:any)=>x.time&&[x.open,x.high,x.low,x.close].every(Number.isFinite)&&x.high>=Math.max(x.open,x.close,x.low)&&x.low<=Math.min(x.open,x.close,x.high)).reverse();
 const last=a.at(-1),stamp=last?Date.parse(last.time):NaN;if(Number.isFinite(stamp)&&Date.now()-stamp<spec.ms)a.pop();
 if(a.length<210)throw Error(tf+" completed candles below 210 ("+a.length+").");
 const age=Date.now()-Date.parse(a.at(-1).time);if(!Number.isFinite(age)||age>spec.ms*4)throw Error(tf+" candles stale.");
 return a.slice(-512);
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!req.headers.get("Authorization")?.startsWith("Bearer "))return json({ok:false,error:"Login required."},401);
 const td=Deno.env.get("TWELVE_DATA_API_KEY")||"",base=Deno.env.get("KRONOS_API_URL")||"",token=Deno.env.get("KRONOS_SERVICE_TOKEN")||"";
 if(!td)return json({ok:false,error:"TWELVE_DATA_API_KEY missing."},503);
 if(!base||!token)return json({ok:false,error:"Kronos cloud not configured. Set KRONOS_API_URL and KRONOS_SERVICE_TOKEN in Supabase Edge Function Secrets."},503);
 try{
  const tfs=["M5","M15","H1"],timeframes=await Promise.all(tfs.map(async timeframe=>({timeframe,candles:await fetchBars(timeframe,td)})));
  const r=await fetch(base.replace(/\/$/,"")+"/forecast-mtf",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({symbol:"XAUUSD",timeframes}),signal:AbortSignal.timeout(120000)});
  const d=await r.json();if(!r.ok||!d.ok)throw Error(String(d.detail||d.error||"Kronos inference failed").slice(0,220));
  const m=d.multi_timeframe||{},count=(tf:string,dir:string)=>Number(m[tf]?.scenario_counts?.[dir]||0);let direction="WAIT";
  for(const dir of ["BUY","SELL"])if(count("M5",dir)>=4&&count("M15",dir)>=3&&count("H1",dir)>=3){direction=dir;break}
  return json({ok:true,model:d.model||"NeoQuasar/Kronos-base",symbol:"XAUUSD",source:"Twelve Data XAU/USD aggregate, not HFM broker quote",scenario_count:5,multi_timeframe:m,direction,agreement:direction==="WAIT"?"NO_ALIGNMENT":"ALIGNED",rule:"M5 >=4/5; M15 >=3/5; H1 >=3/5 same direction.",execution:"NONE",confidence:null,note:"Scenario consensus is model-sampling agreement, not calibrated probability or expected win rate. No broker orders are sent."});
 }catch(e){return json({ok:false,error:e instanceof Error?e.message:"Kronos forecast failed."},502)}
});
