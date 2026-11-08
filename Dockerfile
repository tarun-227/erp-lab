# Stage 1: build the React app
FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend serving the API and the built app
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY data/ data/
COPY --from=web /app/frontend/dist frontend/dist
ENV PYTHONPATH=/app/backend
EXPOSE 8000
CMD ["uvicorn", "erp_module.api:app", "--host", "0.0.0.0", "--port", "8000"]
