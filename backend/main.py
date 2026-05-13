import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from models import GenerateRequest, ShiftResult
from sample_data import get_sample_data
import solver

app = FastAPI(title="ShiftMaker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://localhost:5175",
        "http://192.168.10.101:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 本番用: ビルド済みフロントエンドの静的ファイル配信
STATIC_DIR = Path(__file__).parent / "static"


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


# 本番用: フロントエンド静的ファイル配信（Dockerビルド時に配置）
# Vite はファイル名にハッシュを付ける（例: index-ABC123.js）ので /assets/* は長期キャッシュOK。
# index.html はハッシュなしなのでキャッシュさせると新バンドルへ切り替わらない → no-cache。
NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}
LONG_CACHE_HEADERS = {"Cache-Control": "public, max-age=31536000, immutable"}

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPAのフォールバック: 全パスをindex.htmlに"""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            # 静的ファイル（ハッシュ付き）は長期キャッシュ。index.html はキャッシュ無効。
            if file_path.name == "index.html":
                return FileResponse(file_path, headers=NO_CACHE_HEADERS)
            return FileResponse(file_path, headers=LONG_CACHE_HEADERS)
        return FileResponse(STATIC_DIR / "index.html", headers=NO_CACHE_HEADERS)
