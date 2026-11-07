---
title: HFM Kronos Forecast
emoji: 📈
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# HFM Kronos Forecast Service

Official NeoQuasar/Kronos-base. Returns five independently sampled paths for M5/M15/H1.

## Deploy from Android
1. Open https://huggingface.co/new-space in Chrome. Create Docker Space named hfm-kronos.
2. Copy app.py, Dockerfile, requirements.txt and this README into the Space repository root.
3. In Space Settings → Variables and secrets add KRONOS_SERVICE_TOKEN with a long random value. Never publish it.
4. Wait until Space is Running. Test /health; it must return ok:true. First forecast downloads model weights.
5. In Supabase → Edge Functions → Secrets set KRONOS_API_URL to the Space URL (no trailing slash) and KRONOS_SERVICE_TOKEN to the same value.

Optional variables: KRONOS_MODEL_ID=NeoQuasar/Kronos-base, KRONOS_TOKENIZER_ID=NeoQuasar/Kronos-Tokenizer-base, TORCH_NUM_THREADS=2.

Free CPU hosting can sleep, cold-start or run out of memory/time. Upgrade hardware if required. This service never places orders. Scenario consensus is not a win probability.
