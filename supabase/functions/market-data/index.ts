import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors = {
  "Access-Control-Allow-Origin": "https://ahmdwhyu2605-pixel.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const intervals: Record<string,string> = { M1:"1min", M5:"5min", M15:"15min", M30:"30min", H1:"1h", H4:"4h", D1:"1day" };
const intervalMs: Record<string,number> = { M1:60_000, M5:300_000, M15:900_000, M30:1_800_000, H1:3_600_000, H4:14_400_000, D1:86_400_000 };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "GET") return json({ok:false,error:"Method not allowed"},405);
  const key = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!key) return json({ok:false,error:"TWELVE_DATA_API_KEY belum dipasang di Supabase Edge Function Secrets."},503);
  const url = new URL(req.url);
  const tf = (url.searchParams.get("timeframe") || "M15").toUpperCase();
  const interval = intervals[tf];
  if (!interval) return json({ok:false,error:"Timeframe tidak didukung."},400);
  const outputsize = Math.min(500, Math.max(50, Number(url.searchParams.get("limit") || 300)));
  try {
    const endpoint = new URL("https://api.twelvedata.com/time_series");
    endpoint.searchParams.set("symbol","XAU/USD");
    endpoint.searchParams.set("interval",interval);
    endpoint.searchParams.set("outputsize",String(outputsize));
    endpoint.searchParams.set("timezone","UTC");
    endpoint.searchParams.set("apikey",key);
    const response = await fetch(endpoint, {signal:AbortSignal.timeout(15000),headers:{"Accept":"application/json"}});
    const data = await response.json();
    if (!response.ok || data.status === "error" || !Array.isArray(data.values)) {
      return json({ok:false,provider:"Twelve Data",error:String(data.message || data.code || "Feed OHLC tidak tersedia"),provider_status:response.status},502);
    }
    const candles = data.values.map((v:any)=>({
      time:v.datetime, o:Number(v.open), h:Number(v.high), l:Number(v.low), c:Number(v.close),
      volume:v.volume == null ? null : Number(v.volume)
    })).filter((c:any)=>[c.o,c.h,c.l,c.c].every(Number.isFinite) && c.h>=Math.max(c.o,c.c,c.l) && c.l<=Math.min(c.o,c.c,c.h)).reverse();
    const current = candles[candles.length-1];
    const currentStamp = current ? Date.parse(String(current.time).replace(" ","T")+"Z") : NaN;
    if (Number.isFinite(currentStamp) && Date.now()-currentStamp < intervalMs[tf]) candles.pop();
    if (candles.length < 210) return json({ok:false,provider:"Twelve Data",error:"Candle selesai kurang dari 210 bar.",count:candles.length},502);
    const latest = candles[candles.length-1];
    const latestStamp = Date.parse(String(latest.time).replace(" ","T")+"Z");
    if (!Number.isFinite(latestStamp) || Date.now()-latestStamp > intervalMs[tf]*4) return json({ok:false,provider:"Twelve Data",error:"Candle terakhir kedaluwarsa atau timestamp tidak valid."},502);
    return json({
      ok:true, provider:"Twelve Data", symbol:"XAU/USD", broker_match:false,
      timeframe:tf, interval, timezone:"UTC", count:candles.length,
      latest_price:latest.c, latest_candle_time:latest.time, candles,
      data_quality:"external_market_aggregate_not_HFM_execution_quote",
      fetched_at:new Date().toISOString()
    });
  } catch (e) {
    return json({ok:false,provider:"Twelve Data",error:e instanceof Error?e.message:"Feed request gagal"},502);
  }
});