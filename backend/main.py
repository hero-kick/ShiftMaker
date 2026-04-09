from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import GenerateRequest, ShiftResult
from sample_data import get_sample_data
import solver

app = FastAPI(title="ShiftMaker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://localhost:5175",
                   "http://192.168.10.101:5174"],
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
