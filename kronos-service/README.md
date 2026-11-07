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


## Render deployment (free test only)

This repository also includes a root-level `render.yaml` Blueprint for a Render Web Service using the Dockerfile in this folder.

1. Open https://dashboard.render.com/blueprints and connect this GitHub repository.
2. Select the Blueprint named `hfm-kronos` and create the service on the Free plan.
3. Render generates `KRONOS_SERVICE_TOKEN` automatically. Copy its value from the service environment settings; never put it in GitHub or the browser.
4. After deployment, test `https://YOUR-SERVICE.onrender.com/health`. The service must report `ok:true` and `model_state` will initially be `not_loaded`; the first forecast loads the model.
5. Set `KRONOS_API_URL` and the exact same `KRONOS_SERVICE_TOKEN` as Supabase Edge Function secrets.

**Important limitations:** Render Free has 512 MB RAM and sleeps after 15 minutes without inbound traffic. Kronos + PyTorch may exceed the free RAM limit, so this configuration is for a deployment/health-check attempt only, not a guarantee that model inference will fit. It is not suitable for 24/7 trading or automatic order execution. Do not treat forecast scenarios as trade signals or win probabilities.
