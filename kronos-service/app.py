import os, threading, math
from datetime import datetime, timedelta
from typing import Literal
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

MODEL_ID=os.getenv("KRONOS_MODEL_ID","NeoQuasar/Kronos-base")
TOKENIZER_ID=os.getenv("KRONOS_TOKENIZER_ID","NeoQuasar/Kronos-Tokenizer-base")
SERVICE_TOKEN=os.getenv("KRONOS_SERVICE_TOKEN","")
INTERVALS={"M5":5,"M15":15,"H1":60}
SCENARIOS=5
app=FastAPI(title="HFM Kronos Forecast Service",version="0.2.0")
_predictor=None
_state="not_loaded"
_load_lock=threading.Lock()
_infer_lock=threading.Lock()

class Candle(BaseModel):
 time:datetime
 open:float=Field(gt=0)
 high:float=Field(gt=0)
 low:float=Field(gt=0)
 close:float=Field(gt=0)
 volume:float|None=Field(default=0,ge=0)

class TFInput(BaseModel):
 timeframe:Literal["M5","M15","H1"]
 candles:list[Candle]=Field(min_length=210,max_length=512)
 @field_validator("candles")
 @classmethod
 def valid_bars(cls,items):
  prev=None
  for x in items:
   if x.high<max(x.open,x.close,x.low) or x.low>min(x.open,x.close,x.high): raise ValueError("Invalid OHLC range")
   if prev is not None and x.time<=prev: raise ValueError("Candle times must increase")
   prev=x.time
  return items

class RequestBody(BaseModel):
 symbol:Literal["XAUUSD","XAU/USD"]="XAUUSD"
 timeframes:list[TFInput]=Field(min_length=3,max_length=3)
 @field_validator("timeframes")
 @classmethod
 def all_tfs(cls,x):
  if {v.timeframe for v in x}!={"M5","M15","H1"}: raise ValueError("Exactly M5, M15, H1 required")
  return x

def predictor():
 import torch
 global _predictor,_state
 if _predictor is not None:return _predictor
 with _load_lock:
  if _predictor is None:
   _state="loading"
   try:
    torch.set_num_threads(max(1,int(os.getenv("TORCH_NUM_THREADS","2"))))
    try: torch.set_num_interop_threads(1)
    except RuntimeError: pass
    from model import Kronos,KronosTokenizer,KronosPredictor
    tok=KronosTokenizer.from_pretrained(TOKENIZER_ID)
    model=Kronos.from_pretrained(MODEL_ID);model.eval()
    _predictor=KronosPredictor(model,tok,device="cpu",max_context=512)
    _state="ready"
   except Exception:
    _state="error";raise
 return _predictor

def frame_for(item):
 df=pd.DataFrame([{"open":x.open,"high":x.high,"low":x.low,"close":x.close,"volume":x.volume or 0,"amount":0} for x in item.candles])
 xt=pd.Series(pd.to_datetime([x.time for x in item.candles],utc=True).tz_convert(None))
 step=INTERVALS[item.timeframe];last=xt.iloc[-1]
 yt=pd.Series([last+timedelta(minutes=step*n) for n in range(1,7)])
 return df,xt,yt

def rows_for(pred):
 rows=[]
 for stamp,r in pred.iterrows():
  o,h,l,cl=map(float,(r.open,r.high,r.low,r.close))
  if not all(math.isfinite(v) and v>0 for v in (o,h,l,cl)) or not pd.notna(stamp):
   raise ValueError("Kronos returned non-finite or non-positive OHLC.")
  rows.append({"time":pd.Timestamp(stamp).isoformat(),"open":o,"high":max(h,o,cl,l),"low":min(l,o,cl),"close":cl,"volume":float(r.volume) if "volume" in r and pd.notna(r.volume) and math.isfinite(float(r.volume)) else 0})
 if len(rows)!=6: raise ValueError("Invalid Kronos forecast length")
 return rows

@app.get("/health")
def health(): return {"ok":True,"service":"hfm-kronos","model":MODEL_ID,"tokenizer":TOKENIZER_ID,"model_state":_state,"scenario_count":SCENARIOS,"execution":"none"}

@app.post("/forecast-mtf")
def forecast_mtf(body:RequestBody,authorization:str|None=Header(default=None)):
 import torch
 if not SERVICE_TOKEN or authorization!=f"Bearer {SERVICE_TOKEN}": raise HTTPException(401,"Unauthorized")
 try:
  ordered=sorted(body.timeframes,key=lambda x:("M5","M15","H1").index(x.timeframe))
  p=predictor()
  grouped={k:[] for k in ("M5","M15","H1")}
  # Run one path at a time: avoids a 15-series batch exhausting small CPU instances.
  # sample_count=1 returns one sampled path; repeated calls create independent paths.
  with _infer_lock,torch.inference_mode():
   for item in ordered:
    df,xt,yt=frame_for(item)
    for n in range(SCENARIOS):
     out=p.predict(df=df,x_timestamp=xt,y_timestamp=yt,pred_len=6,T=1.0,top_k=0,top_p=0.9,sample_count=1,verbose=False)
     grouped[item.timeframe].append({"scenario":n+1,"forecast":rows_for(out)})
  result={}
  for item in ordered:
   tf=item.timeframe;last=float(item.candles[-1].close);paths=grouped[tf]
   for s in paths:
    v=s["forecast"][-1]["close"];s["direction"]="BUY" if v>last else "SELL" if v<last else "WAIT"
   counts={d:sum(s["direction"]==d for s in paths) for d in ("BUY","SELL","WAIT")}
   dominant=max(counts,key=counts.get);median=sorted(paths,key=lambda s:s["forecast"][-1]["close"])[2]
   result[tf]={"timeframe":tf,"last_close":last,"direction":dominant if counts[dominant]>=3 else "WAIT","scenario_counts":counts,"scenario_consensus_pct":counts[dominant]/SCENARIOS*100,"forecast":median["forecast"],"scenarios":paths}
  return {"ok":True,"model":MODEL_ID,"symbol":body.symbol,"scenario_count":SCENARIOS,"multi_timeframe":result,"execution":"none","note":"Scenario consensus is sampling agreement, not probability of profit or calibrated confidence."}
 except HTTPException:raise
 except Exception as e:raise HTTPException(502,f"Kronos inference failed: {type(e).__name__}: {str(e)[:220]}")
