import asyncio
from database import engine, Base, SessionLocal
from models import Scooty
from sqlalchemy import select

async def init_db():
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        # Check if we have scooters
        result = await session.execute(select(Scooty))
        scooters = result.scalars().all()

        if not scooters:
            print("Seeding initial data...")
            initial_scooters = [
                Scooty(id=1, location="Hostel", status="available"),
                Scooty(id=2, location="Clock Tower", status="available"),
                Scooty(id=3, location="EEE-block", status="available")
            ]
            session.add_all(initial_scooters)
            await session.commit()
            print("Data seeded.")
        else:
            print("Data already exists.")

if __name__ == "__main__":
    asyncio.run(init_db())
