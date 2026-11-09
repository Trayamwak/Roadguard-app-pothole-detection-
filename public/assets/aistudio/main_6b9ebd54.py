from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS so your mobile app can talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "FastAPI service is running"}

@app.post("/scan")
async def scan_pothole(file: UploadFile = File(...)):
    # AI scan analysis logic
    return {
        "severity": "Medium",
        "confidence": 0.88,
        "message": "Pothole scanned successfully"
    }