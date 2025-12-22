import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./TrackingPage.css";

const GOOGLE_MAPS_API_KEY = "AIzaSyDJp7uscyjA-4ey5MeO65ux79UOvPSaSV4";
const BACKEND_URL = "http://10.255.53.170:8000/api/location";

// ---------- Custom scooter marker ----------
function getScooterMarkerIcon(scale = 1.5) {
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: "#1167b1",
    fillOpacity: 1,
    strokeColor: "#03254c",
    strokeWeight: 2,
    scale,
    anchor: new google.maps.Point(12, 22),      // pin tip
    labelOrigin: new google.maps.Point(12, -4), // label above pin
  };
}

// ---------- Load Google Maps ----------
function loadGoogleMaps(callback) {
  if (window.google) {
    callback();
    return;
  }

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
  script.async = true;
  script.onload = callback;
  document.body.appendChild(script);
}

// ---------- User location ----------
function locateUser(map, userMarkerRef, accuracyCircleRef) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const userPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          map,
          position: userPos,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#16a34a",
            fillOpacity: 1,
            strokeColor: "#065f46",
            strokeWeight: 2,
          },
          title: "Your location",
        });

        accuracyCircleRef.current = new google.maps.Circle({
          map,
          center: userPos,
          radius: pos.coords.accuracy,
          fillColor: "#22c55e",
          fillOpacity: 0.15,
          strokeColor: "#16a34a",
          strokeOpacity: 0.4,
          strokeWeight: 1,
        });
      } else {
        userMarkerRef.current.setPosition(userPos);
        accuracyCircleRef.current.setCenter(userPos);
        accuracyCircleRef.current.setRadius(pos.coords.accuracy);
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

// ---------- Component ----------
export default function TrackingPage() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const scooterMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    let intervalId;

    loadGoogleMaps(() => {
      // Initial fetch to center map correctly
      fetch(`${BACKEND_URL}?t=${Date.now()}`, { cache: "no-store" })
        .then(res => res.json())
        .then(data => {
          const lat = Number(data.latitude);
          const lng = Number(data.longitude);

          if (
            isNaN(lat) || isNaN(lng) ||
            lat < -90 || lat > 90 ||
            lng < -180 || lng > 180
          ) {
            throw new Error("Invalid GPS data");
          }

          const scooterPos = { lat, lng };

          // Create map
          const map = new google.maps.Map(mapRef.current, {
            center: scooterPos,
            zoom: 16,
          });
          mapInstanceRef.current = map;

          setTimeout(() => {
            google.maps.event.trigger(map, "resize");
            map.setCenter(scooterPos);
          }, 300);

          // Scooter marker
          const BASE_SCALE = 1.5;
          scooterMarkerRef.current = new google.maps.Marker({
            map,
            position: scooterPos,
            icon: getScooterMarkerIcon(BASE_SCALE),
            label: {
              text: String(data.scooter_id || "SCOOTER"),
              color: "#6b7280",
              fontSize: "13px",
              fontWeight: "600",
            },
            animation: google.maps.Animation.DROP,
          });

          // Zoom scaling
          map.addListener("zoom_changed", () => {
            const zoom = map.getZoom();
            let scale = 1.2;
            if (zoom >= 17) scale = 1.6;
            if (zoom >= 18) scale = 1.9;
            if (zoom >= 19) scale = 2.2;

            scooterMarkerRef.current.setIcon(
              getScooterMarkerIcon(scale)
            );
          });

          // User location
          locateUser(map, userMarkerRef, accuracyCircleRef);

          // Fit bounds once
          setTimeout(() => {
            if (userMarkerRef.current && scooterMarkerRef.current) {
              const bounds = new google.maps.LatLngBounds();
              bounds.extend(userMarkerRef.current.getPosition());
              bounds.extend(scooterMarkerRef.current.getPosition());
              map.fitBounds(bounds);
            }
          }, 800);

          // Live scooter updates
          intervalId = setInterval(() => {
            fetch(`${BACKEND_URL}?t=${Date.now()}`, { cache: "no-store" })
              .then(res => res.json())
              .then(data => {
                const lat = Number(data.latitude);
                const lng = Number(data.longitude);

                if (
                  isNaN(lat) || isNaN(lng) ||
                  lat < -90 || lat > 90 ||
                  lng < -180 || lng > 180
                ) return;

                const pos = { lat, lng };
                scooterMarkerRef.current.setPosition(pos);
              });
          }, 5000);
        })
        .catch(err => console.error("Map init failed:", err));
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="tracking-page">
      <div className="tracking-header">Track Scooter</div>

      <div ref={mapRef} className="map-container" />

      <div className="tracking-actions">
        <button
          className="tracking-btn btn-secondary"
          onClick={() => navigate("/user_dashboard")}
        >
          Back to Dashboard
        </button>

        <button
          className="tracking-btn btn-primary"
          onClick={() => navigate("/payment")}
        >
          Book Scooter
        </button>

        <button
          className="tracking-btn btn-primary"
          onClick={() => {
            const pos = scooterMarkerRef.current?.getPosition();
            if (!pos) return;

            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${pos.lat()},${pos.lng()}`,
              "_blank"
            );
          }}
        >
          Navigate to Scooter
        </button>
      </div>
    </div>
  );
}
