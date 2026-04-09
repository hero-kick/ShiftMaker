import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import GenerateRequest, ShiftResult
from sample_data import get_sample_data
import solver

app = FastAPI(title="ShiftMaker API", version="1.0.0")

# CORS: ローカル開発 + デプロイ先のフロントエンドURL
cors_origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://localhost:5175",
    "http://192.168.10.101:5174",
]
# 環境変数 FRONTEND_URL が設定されていれば追加（Vercelデプロイ用）
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/generate", response_model=ShiftResult)
def generate_shift(request: GenerateRequest):
    errors = solver.check_feasibility(request)
    if errors:
        raise HTTPException(status_code=422, detail="\n".join(errors))
    try:
        result = solver.solve(request)
        return ShiftResult(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")


@app.get("/api/sample")
def get_sample():
    return get_sample_data()
