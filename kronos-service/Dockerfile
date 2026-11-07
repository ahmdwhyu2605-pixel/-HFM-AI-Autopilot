FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/opt/hf-cache TORCH_NUM_THREADS=2
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch
RUN pip install fastapi uvicorn[standard] pandas pydantic huggingface_hub safetensors transformers einops
RUN git clone --depth 1 https://github.com/shiyu-coder/Kronos.git /opt/Kronos
ENV PYTHONPATH=/opt/Kronos
COPY app.py /app/app.py
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
