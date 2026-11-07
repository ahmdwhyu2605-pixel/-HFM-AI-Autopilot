# HFM Kronos inference service

This service runs the official Kronos Python implementation and pretrained model. It does not connect to a broker and never places trades.

## Deploy
Deploy this directory as a Docker web service on a host with persistent disk/cache and enough RAM. Kronos-base is 102.3M parameters; allow several GB of RAM for Python/PyTorch plus model weights. A free 512 MB web container is not sufficient. Set the environment variables in `.env.example` in the hosting dashboard. Do not commit real secrets.

The first `/forecast` request downloads the model weights from Hugging Face and can take several minutes. Subsequent requests reuse the in-memory model. Health check path: `/health`.

## API
`POST /forecast` requires `Authorization: Bearer <KRONOS_SERVICE_TOKEN>` and JSON:
```json
{
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "candles": [
    {"time":"2026-11-06T10:00:00Z","open":2800,"high":2802,"low":2799,"close":2801,"volume":100}
  ]
}
```
Supply 210–512 completed candles in chronological order. This API returns a six-bar model forecast. The returned direction is only the sign of the final forecast close versus the last observed close; it is not a trading signal, probability, or order instruction.

## Important
- Use only completed candles. Caller is responsible for verifying the source and timestamps.
- Forecasting quality is not guaranteed. Validate on out-of-sample XAUUSD broker data before any trading.
- Do not expose this service publicly without the bearer token.
- The official model's inference API expects OHLCV and timestamps. See https://github.com/shiyu-coder/Kronos and https://huggingface.co/NeoQuasar/Kronos-base.
