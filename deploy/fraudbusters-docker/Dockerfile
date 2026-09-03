FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY model_data ./model_data
ENV MODEL_DATA_DIR=/app/model_data
ENV FRAUD_MODEL_NAME=qsvm-fraud-classifier
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
