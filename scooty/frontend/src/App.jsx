import { useState, useEffect } from 'react'
import './index.css'
const API = import.meta.env.VITE_API_URL;

function App() {
  const [ridingTime, setRidingTime] = useState(0); // for estimate slider
  const [price, setPrice] = useState(15);
  const [scooterList, setScooterList] = useState([]);
  const [scooter, setScooter] = useState(null);
  const [booking, setBooking] = useState(null);
  const [view, setView] = useState("list"); // list, estimate, tracking, payment
  const [rideStatus, setRideStatus] = useState("idle"); // idle, riding, ended

  // Tracking
  const [rideTimer, setRideTimer] = useState(0); // seconds
  const [timerInterval, setTimerInterval] = useState(null);
  const [rideDetails, setRideDetails] = useState({ duration: 0, amount: 0 });

  // Overtime Warning
  const [committedDuration, setCommittedDuration] = useState(0); // mins selected
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeAccepted, setOvertimeAccepted] = useState(false);

  // Fetch all scooters on load
  useEffect(() => {
    fetchScooters();
  }, []);

  // Monitor Timer for Overtime
  useEffect(() => {
    // If riding, and not yet accepted overtime, check time
    if (rideStatus === "riding" && !overtimeAccepted && !showOvertimeModal && committedDuration > 0) {
      // Check if current seconds > committed minutes * 60
      // giving a buffer of maybe 5 seconds to not be instant
      if (rideTimer > (committedDuration * 60)) {
        setShowOvertimeModal(true);
      }
    }
  }, [rideTimer, committedDuration, overtimeAccepted, showOvertimeModal, rideStatus]);

  const fetchScooters = () => {
    fetch(API+'/scooty')
      .then(res => res.json())
      .then(data => setScooterList(data))
      .catch(err => console.error("API Error", err));
  }

  const handleSelectScooter = (s) => {
    if (s.status !== 'available') {
      alert("This scooter is currently unavailable.");
      return;
    }
    setScooter(s);
    setView('estimate');
  };

  const handleBackToList = () => {
    setScooter(null);
    setView('list');
    fetchScooters();
  };

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value);
    setRidingTime(val);
    setPrice(15 + val * 2);
  };

  // Start Ride
  const handleBookAndRide = async () => {
    if (!scooter) return;
    try {
      // 1. Book
      const bookRes = await fetch(API+'/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scooty_id: scooter.id, user: "User1" })
      });
      const bookData = await bookRes.json();

      if (bookData.message.includes("successfully")) {
        // 2. Start
        const startRes = await fetch(API+'/start-ride', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scooter_id: scooter.id, user: "User1" })
        });
        const startData = await startRes.json();

        if (startData.message.includes("started")) {
          setBooking(startData.bookings);
          setView("tracking");
          setRideStatus("riding");

          // Set committed duration for warning check
          setCommittedDuration(ridingTime);
          setOvertimeAccepted(false);
          setShowOvertimeModal(false);

          startTimer();
        }
      } else {
        alert(bookData.message);
      }
    } catch (e) {
      console.error(e);
      alert("Error starting ride");
    }
  };

  // Timer Logic
  const startTimer = () => {
    setRideTimer(0);
    const interval = setInterval(() => {
      setRideTimer(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const stopTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndRide = async () => {
    if (!booking) return;
    // Close modal if open
    setShowOvertimeModal(false);

    try {
      const res = await fetch(API+'/end-ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scooter_id: scooter.id, user: "User1" })
      });
      const data = await res.json();

      if (data.message.includes("ended")) {
        stopTimer();
        setRideDetails({
          duration: data.ride_details.duration_mins,
          amount: data.ride_details.amount
        });
        // Update booking with payment status if needed, but we rely on ID
        setRideStatus("ended");
        setView("payment");
      }
    } catch (e) {
      console.error(e);
      alert("Error ending ride");
    }
  };

  const handleContinueRide = () => {
    setShowOvertimeModal(false);
    setOvertimeAccepted(true);
  };

  const handlePayNow = async () => {
    if (!booking) return;
    try {
      const res = await fetch(API+'/pay-ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id })
      });
      const data = await res.json();
      if (data.message.includes("successful") || data.message.includes("paid")) {
        alert("Payment Successful! Thank you.");
        // Reset
        setBooking(null);
        setScooter(null);
        setRideTimer(0);
        setRideStatus("idle");
        setView("list");
        fetchScooters();
      }
    } catch (e) {
      console.error(e);
      alert("Payment failed");
    }
  };

  return (
    <div className="mobile-container">
      {/* --- OVERTIME WARNING MODAL --- */}
      {showOvertimeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Time Exceeded! ⏳</h3>
            <p>
              You have exceeded your selected time of {committedDuration} mins.
            </p>
            <p>
              The price will now be calculated based on the total ride duration.
            </p>
            <div className="modal-actions">
              <button className="reject-btn" onClick={handleEndRide}>End Ride</button>
              <button className="confirm-btn" onClick={handleContinueRide}>Continue Ride</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIST VIEW --- */}
      {view === 'list' && (
        <div className="scooter-list-view">
          <div className="header list-header">
            <img src="/image.png" alt="SSN Logo" width="100" height="100" className="app-logo" />
            <h2>Select a Scooter 🛴</h2>
          </div>
          <p className="description">Choose an available scooter near you</p>

          <div className="list-container">
            {scooterList.map(s => (
              <div
                key={s.id}
                className={`scooter-card ${s.status}`}
                onClick={() => handleSelectScooter(s)}
              >
                <div className="scooter-info-overlay">
                  <div className="scooter-icon">🛵</div>
                  <div className="scooter-info">
                    <div className="scooter-name">Scooty #{s.id}</div>
                    <div className="scooter-loc">{s.location}</div>
                  </div>
                  <div className="scooter-status">
                    <span className={`status-badge ${s.status}`}>{s.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- ESTIMATE VIEW --- */}
      {view === 'estimate' && scooter && (
        <>
          <div className="header">
            <button className="back-btn" onClick={handleBackToList}>←</button>
            <h2 >Estimate Your Ride 🧾</h2>
            <div className="sub-header" style={{ color: "white", fontWeight: "bold" }}>Scooty #{scooter.id}</div>
          </div>
          <p className="description" style={{ color: "white", fontWeight: "bold" }} >
            Estimate price based on time
          </p>
          <div className="scooter-image-container">
            {/* Using a placeholder if image missing, or text */}
            <div style={{ fontSize: '10rem' }}>🛵</div>
          </div>
          <div className="controls">
            <div className="label">Estimated Time: {ridingTime} min</div>
            <div className="slider-container">
              <input
                type="range" min="0" max="60"
                value={ridingTime}
                onChange={handleSliderChange}
                style={{ width: '100%' }}
              />
            </div>
            <div className="price-display">
              Est. Price: Rs.{price}
            </div>
            <button className="action-btn" onClick={handleBookAndRide}>
              Ride Now
            </button>
          </div>
        </>
      )}

      {/* --- TRACKING VIEW --- */}
      {view === 'tracking' && (
        <div className="tracking-view">
          <div className="header">
            <h2>Ride in Progress ⚡</h2>
            <div className="sub-header">Scooty #{scooter?.id}</div>
          </div>

          <div className="timer-display">
            <div className="timer-circle">
              <span className="live-time">{formatTime(rideTimer)}</span>
              <span className="timer-label">Duration</span>
            </div>
          </div>

          <div className="ride-info-card">
            <p>Enjoy your ride! Please drive safely.</p>
          </div>

          <button className="action-btn end-btn" onClick={handleEndRide}>
            End Ride
          </button>
        </div>
      )}

      {/* --- PAYMENT VIEW --- */}
      {view === 'payment' && booking && (
        <div className="payment-view">
          <div className="header">
            <h2>Ride Ended ✅</h2>
          </div>

          <div className="bill-card">
            <div className="bill-row">
              <span>Total Time</span>
              <span>{rideDetails.duration} mins</span>
            </div>
            <div className="bill-row total-row">
              <span>Total Amount</span>
              <span>Rs. {rideDetails.amount}</span>
            </div>
          </div>

          <div className="warning-box">
            ⚠️ Fine of Rs.500 will be added if not paid within 24hrs.
          </div>

          <button className="action-btn pay-btn" onClick={handlePayNow}>
            Pay Now
          </button>
        </div>
      )}
    </div>
  )
}

export default App
