FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/data/huggingface TORCH_NUM_THREADS=2 PORT=7860
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN git clone --depth 1 https://github.com/shiyu-coder/Kronos.git /opt/Kronos
ENV PYTHONPATH=/opt/Kronos
COPY app.py /app/app.py
EXPOSE 7860
CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1"]
