import sqlite3
import pandas as pd

# Connect to the SQLite database
conn = sqlite3.connect('scooty.db')

def run_query(query):
    print(f"\n--- Query: {query} ---")
    try:
        df = pd.read_sql_query(query, conn)
        if df.empty:
            print("No results found.")
        else:
            print(df.to_markdown(index=False))
    except Exception as e:
        print(f"Error: {e}")

# Example 1: View all scooters
run_query("SELECT * FROM scooty")

# Example 2: View all bookings
run_query("SELECT * FROM bookings")

# Example 3: View available scooters
run_query("SELECT * FROM scooty WHERE status = 'available'")

conn.close()
