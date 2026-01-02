from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone

app = FastAPI()

# CORS – allow your hosted frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
       "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ssneflow.site",
        "https://www.ssneflow.site",
        "http://10.238.17.170:5173",
        "http://10.238.17.170",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory scooter state (single scooter for now)
scooter_data = {
    "scooter_id": "SCOOTER_1",
    "latitude": 12.752598,
    "longitude": 80.196944,
    "last_updated": None
}

class ScooterLocation(BaseModel):
    scooter_id: str
    latitude: float
    longitude: float

@app.get("/api/location")
def get_location():
    return scooter_data

@app.post("/api/location")
def update_location(data: ScooterLocation):
    scooter_data["scooter_id"] = data.scooter_id
    scooter_data["latitude"] = data.latitude
    scooter_data["longitude"] = data.longitude
    scooter_data["last_updated"] = datetime.now(timezone.utc).isoformat()
    return {"status": "updated"}
