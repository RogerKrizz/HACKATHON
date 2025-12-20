from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from database import Base

class Scooty(Base):
    __tablename__ = "scooty"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String, index=True)
    status = Column(String, default="available")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    scooter_id = Column(Integer, ForeignKey("scooty.id"))
    user = Column(String)
    status = Column(String, default="booked")
    ride_status = Column(String, default="not_started")
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    total_amount = Column(Float, default=0.0)
    payment_status = Column(String, default="pending")
