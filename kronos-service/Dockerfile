FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/tmp/huggingface \
    TORCH_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    PORT=10000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN git clone --depth 1 https://github.com/shiyu-coder/Kronos.git /opt/Kronos
ENV PYTHONPATH=/opt/Kronos
COPY app.py /app/app.py
EXPOSE 10000
CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --timeout-keep-alive 30"]
