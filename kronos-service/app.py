import os
from datetime import datetime, timedelta, timezone
from typing import Literal

import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

MODEL_ID = os.getenv("KRONOS_MODEL_ID", "NeoQuasar/Kronos-base")
TOKENIZER_ID = os.getenv("KRONOS_TOKENIZER_ID", "NeoQuasar/Kronos-Tokenizer-base")
SERVICE_TOKEN = os.getenv("KRONOS_SERVICE_TOKEN", "")
MAX_BARS = 512
INTERVALS = {"M5": 5, "M15": 15, "H1": 60}

app = FastAPI(title="HFM Kronos Forecast Service", version="0.1.0")
_predictor = None
_model_state = "not_loaded"


class Candle(BaseModel):
    time: datetime
    open: float = Field(gt=0)
    high: float = Field(gt=0)
    low: float = Field(gt=0)
    close: float = Field(gt=0)
    volume: float | None = Field(default=0, ge=0)


class ForecastRequest(BaseModel):
    symbol: Literal["XAUUSD", "XAU/USD"] = "XAUUSD"
    timeframe: Literal["M5", "M15", "H1"]
    candles: list[Candle] = Field(min_length=210, max_length=512)

    @field_validator("candles")
    @classmethod
    def validate_candles(cls, candles):
        previous = None
        for c in candles:
            if c.high < max(c.open, c.close, c.low):
                raise ValueError("Invalid candle high")
            if c.low > min(c.open, c.close, c.high):
                raise ValueError("Invalid candle low")
            if previous and c.time <= previous:
                raise ValueError("Candle timestamps must be strictly increasing")
            previous = c.time
        return candles


def get_predictor():
    global _predictor, _model_state
    if _predictor is None:
        _model_state = "loading"
        try:
            import torch
            from model import Kronos, KronosTokenizer, KronosPredictor
            torch.set_num_threads(max(1, int(os.getenv("TORCH_NUM_THREADS", "2"))))
            tokenizer = KronosTokenizer.from_pretrained(TOKENIZER_ID)
            model = Kronos.from_pretrained(MODEL_ID)
            model.eval()
            _predictor = KronosPredictor(model, tokenizer, max_context=512)
            _model_state = "ready"
        except Exception:
            _model_state = "error"
            raise
    return _predictor


@app.get("/health")
def health():
    return {"ok": True, "service": "hfm-kronos", "model": MODEL_ID, "model_state": _model_state}


@app.post("/forecast")
def forecast(payload: ForecastRequest, authorization: str | None = Header(default=None)):
    if not SERVICE_TOKEN or authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        interval = INTERVALS[payload.timeframe]
        frame = pd.DataFrame([{
            "open": c.open, "high": c.high, "low": c.low,
            "close": c.close, "volume": c.volume or 0, "amount": 0
        } for c in payload.candles])
        x_ts = pd.Series(pd.to_datetime([c.time for c in payload.candles], utc=True).tz_convert(None))
        last_time = x_ts.iloc[-1]
        y_ts = pd.Series([last_time + timedelta(minutes=interval * i) for i in range(1, 7)])
        predictor = get_predictor()
        result = predictor.predict(
            df=frame, x_timestamp=x_ts, y_timestamp=y_ts,
            pred_len=6, T=1.0, top_p=0.9, sample_count=1
        )
        rows = []
        for stamp, row in result.iterrows():
            rows.append({
                "time": pd.Timestamp(stamp).isoformat(),
                "open": float(row["open"]), "high": float(row["high"]),
                "low": float(row["low"]), "close": float(row["close"]),
                "volume": float(row["volume"]) if "volume" in row and pd.notna(row["volume"]) else 0
            })
        if len(rows) != 6 or any(not all(pd.notna(v) for v in [r["open"], r["high"], r["low"], r["close"]]) for r in rows):
            raise ValueError("Model returned invalid forecast")
        last_close = float(frame.iloc[-1]["close"])
        predicted_close = rows[-1]["close"]
        direction = "BUY" if predicted_close > last_close else "SELL" if predicted_close < last_close else "WAIT"
        return {
            "ok": True, "model": MODEL_ID, "symbol": payload.symbol,
            "timeframe": payload.timeframe, "direction": direction,
            "last_close": last_close, "forecast_close": predicted_close,
            "forecast": rows, "forecast_steps": len(rows),
            "sample_count": 1, "data_origin": "caller_supplied_completed_ohlcv",
            "execution": "none", "created_at": datetime.now(timezone.utc).isoformat()
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Kronos inference failed: {type(exc).__name__}: {str(exc)[:240]}")
