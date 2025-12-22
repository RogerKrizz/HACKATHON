from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db, engine
from models import Scooty, Booking
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # details: For development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ScootyResponse(BaseModel):
    id: int
    location: str
    status: str

    class Config:
        orm_mode = True

class BookingResponse(BaseModel):
    id: int
    scooter_id: int
    user: str
    status: str
    status: str
    ride_status: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    total_amount: float
    payment_status: str

    class Config:
        orm_mode = True

class BookingRequest(BaseModel):
    scooty_id: int
    user: str

class RideRequest(BaseModel):
    scooter_id: int
    user: str

class PaymentRequest(BaseModel):
    booking_id: int


@app.get("/scooty", response_model=List[ScootyResponse])
async def get_scooty(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scooty))
    return result.scalars().all()

@app.get("/get-bookings", response_model=List[BookingResponse])
async def get_bookings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Booking))
    return result.scalars().all()

@app.post("/book")
async def book_scooty(request: BookingRequest, db: AsyncSession = Depends(get_db)):
    # Check if scooter exists and is available
    result = await db.execute(select(Scooty).where(Scooty.id == request.scooty_id))
    scooter = result.scalar_one_or_none()

    if not scooter:
        return {"message": "Scooty ID not found!"}
    
    if scooter.status != "available":
        return {"message": "Scooty is not available"}

    # Update scooter status
    scooter.status = "booked"
    
    # Create booking
    new_booking = Booking(
        scooter_id=request.scooty_id,
        user=request.user,
        status="booked",
        ride_status="not_started"
    )
    db.add(new_booking)
    await db.commit()
    await db.refresh(new_booking)

    return {"message": "Scooty booked successfully", "bookings": new_booking}

@app.post("/start-ride")
async def start_ride(request: RideRequest, db: AsyncSession = Depends(get_db)):
    # Find active booking
    result = await db.execute(select(Booking).where(
        Booking.scooter_id == request.scooter_id,
        Booking.user == request.user,
        Booking.ride_status == "not_started"
    ))
    booking = result.scalar_one_or_none()

    if not booking:
        return {"message": "Booking not found or already started"}

    booking.ride_status = "riding"
    booking.start_time = datetime.utcnow()
    await db.commit()
    await db.refresh(booking)
    
    return {"message": "Ride started", "bookings": booking}

@app.post("/end-ride")
async def end_ride(request: RideRequest, db: AsyncSession = Depends(get_db)):
    # Find active ride
    result = await db.execute(select(Booking).where(
        Booking.scooter_id == request.scooter_id,
        Booking.user == request.user,
        Booking.ride_status == "riding"
    ))
    booking = result.scalar_one_or_none()

    if not booking:
        return {"message": "Active ride not found"}

    # Update booking
    booking.ride_status = "ended"
    booking.end_time = datetime.utcnow()
    
    # Calculate price
    # Defaulting to 0 mins if something is wrong with times
    duration_minutes = 0
    if booking.start_time:
        duration = booking.end_time - booking.start_time
        duration_minutes = duration.total_seconds() / 60
    
    # Pricing Model: Base Rs.15 + Rs.2 per minute
    base_price = 15.0
    booking.total_amount = base_price + (int(duration_minutes) * 2.0)
    
    # Update scooter status
    scooter_result = await db.execute(select(Scooty).where(Scooty.id == request.scooter_id))
    scooter = scooter_result.scalar_one_or_none()
    if scooter:
        scooter.status = "available"

    await db.commit()
    await db.refresh(booking)

    return {
        "message": "Ride ended", 
        "bookings": booking,
        "ride_details": {
            "duration_mins": int(duration_minutes),
            "amount": booking.total_amount
        }
    }

@app.post("/pay-ride")
async def pay_ride(request: PaymentRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Booking).where(Booking.id == request.booking_id))
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.payment_status == "paid":
         return {"message": "Already paid"}

    booking.payment_status = "paid"
    await db.commit()
    
    return {"message": "Payment successful"}

@app.post("/cancel")
async def cancel_scooty(request: BookingRequest, db: AsyncSession = Depends(get_db)):
    # Find booking to cancel (not started)
    result = await db.execute(select(Booking).where(
        Booking.scooter_id == request.scooty_id,
        Booking.user == request.user,
        Booking.ride_status == "not_started"
    ))
    booking = result.scalar_one_or_none()

    if not booking:
        return {"message": "Booking not found available for cancellation"}

    # Remove booking (or mark as cancelled - user originally did 'remove', but typically soft delete is better. 
    # I will stick to user's logic of 'remove' but here 'delete' from DB)
    await db.delete(booking)
    await db.commit()

    return {
        "message": "Booking cancelled",
        "bookings": {
            "scooter_id": request.scooty_id,
            "user": request.user,
            "status": "cancelled"
        }
    }
