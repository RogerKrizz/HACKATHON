import { Routes, Route, Navigate } from "react-router-dom"
import TrackingPage from "./pages/TrackingPage"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/user_dashboard" />} />
      <Route path="/user_dashboard" element={<div>User Dashboard</div>} />
      <Route path="/tracking" element={<TrackingPage />} />
      <Route path="/payment" element={<div>Payment Page</div>} />
    </Routes>
  )
}

export default App

