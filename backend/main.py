import logging
import time
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from models import GenerateRequest, ShiftResult
from sample_data import get_sample_data
import solver

# ── ロギング設定 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("shiftmaker")

APP_VERSION = "3.1.0"

app = FastAPI(title="ShiftMaker API", version=APP_VERSION)

# ── CORS ──
# 環境変数 SHIFTMAKER_CORS_ORIGINS（カンマ区切り）で追加 origin を指定可能。
# 未指定でも開発用ポートと LAN は許可。本番は同一オリジン配信なので CORS 不要。
_default_origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    "http://localhost:5175", "http://127.0.0.1:5175",
]
_env_origins = os.environ.get("SHIFTMAKER_CORS_ORIGINS", "")
_extra_origins = [o.strip() for o in _env_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    # LAN IP（192.168.x.x / 10.x.x.x / 172.16-31.x.x）の任意ポートを許可
    allow_origin_regex=r"http://(192\.168|10|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


# ── リクエストロギング ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error during %s %s", request.method, request.url.path)
        raise
    elapsed = (time.time() - start) * 1000
    # 静的ファイルは騒がしいので API のみログ
    if request.url.path.startswith("/api"):
        logger.info(
            "%s %s -> %d (%.0fms)",
            request.method, request.url.path, response.status_code, elapsed,
        )
    return response


@app.get("/api/health")
def health_check():
    """ヘルスチェック。バージョンとソルバー利用可否を返す。"""
    solver_ok = True
    try:
        import ortools  # noqa: F401
    except Exception:
        solver_ok = False
    return {
        "status": "ok",
        "version": APP_VERSION,
        "solver_available": solver_ok,
    }


@app.post("/api/generate", response_model=ShiftResult)
def generate_shift(request: GenerateRequest):
    n_staff = len(request.staff)
    logger.info(
        "generate: %d staff, %d/%d, %d wishes, %d pairs, %d locked-staff",
        n_staff, request.year, request.month,
        len(request.wishes), len(request.pairs), len(request.locked_shifts),
    )
    # 事前充足チェック
    errors = solver.check_feasibility(request)
    if errors:
        logger.info("generate: infeasible pre-check (%d issues)", len(errors))
        raise HTTPException(status_code=422, detail="\n".join(errors))

    try:
        t0 = time.time()
        result = solver.solve(request)
        logger.info("generate: solved in %.2fs", time.time() - t0)
        return ShiftResult(**result)
    except ValueError as e:
        # ソルバー由来の「解なし」など。ユーザー向けメッセージはそのまま返す。
        logger.info("generate: solver ValueError: %s", str(e).split(chr(10))[0])
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        # 想定外の内部エラー。詳細はログに残し、ユーザーには汎用メッセージ。
        logger.exception("generate: unexpected solver error")
        raise HTTPException(
            status_code=500,
            detail="サーバー内部でエラーが発生しました。時間をおいて再試行してください。"
                   "解決しない場合は管理者にお問い合わせください。",
        )


@app.get("/api/sample")
def get_sample(year: int | None = None, month: int | None = None):
    """サンプルデータ。year/month を渡すとその月の日別条件で返す。"""
    from datetime import date as _date
    if year is None or month is None:
        today = _date.today()
        year, month = today.year, today.month
    # 範囲ガード
    year = max(2000, min(2100, year))
    month = max(1, min(12, month))
    return get_sample_data(year=year, month=month)


# ── 本番: フロントエンド静的ファイル配信 ──
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
        """SPA のフォールバック: 全パスを index.html に。"""
        # パストラバーサル防止
        candidate = (STATIC_DIR / full_path).resolve()
        try:
            candidate.relative_to(STATIC_DIR.resolve())
        except ValueError:
            return FileResponse(STATIC_DIR / "index.html", headers=NO_CACHE_HEADERS)

        if candidate.is_file():
            if candidate.name == "index.html":
                return FileResponse(candidate, headers=NO_CACHE_HEADERS)
            return FileResponse(candidate, headers=LONG_CACHE_HEADERS)
        return FileResponse(STATIC_DIR / "index.html", headers=NO_CACHE_HEADERS)
