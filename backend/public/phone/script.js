// WebSocket connection
let ws;
let reconnectAttempts = 0;
const baseReconnectDelay = 1000; // 1 second
let isConnected = false;
let maxReconnectDelay = 5000; // Cap delay at 5 seconds

// Throttling variables
let lastAccelUpdate = 0;
let lastOrientationUpdate = 0;
const updateInterval = 50; // Send updates every 100ms

// Get deviceId from URL query parameters or generate a random one
function getDeviceId() {
  // Parse URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const deviceIdParam = urlParams.get("deviceId");

  // If deviceId is in query params, use that
  if (deviceIdParam) {
    return deviceIdParam;
  }

  // Otherwise, try to get from localStorage or generate a new random ID
  return localStorage.getItem("deviceSourceId") ||
    (Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15));
}

// Get or generate source ID and store in variable
let sourceId = null;

// Function to update connection status UI
function updateConnectionStatus(status, message) {
  const statusElement = document.getElementById("connection-status");
  const statusTextElement = statusElement.querySelector(".status-text");

  // Remove all current status classes
  statusElement.classList.remove("connected", "connecting", "disconnected");

  // Add the new status class
  statusElement.classList.add(status);

  // Update the status text
  statusTextElement.textContent = message;
}

function connectWebSocket() {
  // Set sourceId if it's not already set
  // Update status to connecting
  updateConnectionStatus("connecting", "Connecting...");

  ws = new WebSocket(
    `wss://${window.location.hostname}${
      window.location.port ? ":" + window.location.port : ""
    }/ws/data-input`,
  );

  ws.onopen = () => {
    console.log("WebSocket connection established");
    isConnected = true;
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection

    // Update status to connected
    updateConnectionStatus(
      "connected",
      `Connected (Source ID: ${sourceId.substring(0, 6)}...)`,
    );
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    // Update status to connecting instead of error
    updateConnectionStatus("connecting", "Connection Issue - Retrying...");
  };

  ws.onclose = () => {
    console.log("WebSocket connection closed");
    isConnected = false;

    // Calculate delay with exponential backoff, but cap it
    let delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
    delay = 1000; // Cap the delay

    // Update status to reconnecting
    updateConnectionStatus(
      "connecting",
      `Reconnecting in ${Math.round(delay / 1000)}s...`,
    );

    setTimeout(() => {
      reconnectAttempts++;
      connectWebSocket();
    }, delay);
  };
}

// Initialize connection status as connecting
document.addEventListener("DOMContentLoaded", () => {
  // Initialize sourceId as early as possible
  if (sourceId === null) {
    sourceId = getDeviceId();
    console.log(`Using device ID: ${sourceId}`);
  }

  updateConnectionStatus("connecting", "Initializing...");

  // Initialize WebSocket connection
  connectWebSocket();
});

async function getAccel() {
  DeviceMotionEvent.requestPermission().then((response) => {
    if (response == "granted") {
      window.addEventListener("devicemotion", (event) => {
        const now = Date.now();
        if (
          isConnected && ws.readyState === WebSocket.OPEN &&
          now - lastAccelUpdate >= updateInterval
        ) {
          lastAccelUpdate = now;
          ws.send(
            JSON.stringify({
              type: "acceleration",
              sourceId: sourceId,
              timestamp: now,
              acceleration: {
                x: event.acceleration.x,
                y: event.acceleration.y,
                z: event.acceleration.z,
              },
            }),
          );
        }
      });

      window.addEventListener("deviceorientation", (event) => {
        const now = Date.now();
        if (
          isConnected && ws.readyState === WebSocket.OPEN &&
          now - lastOrientationUpdate >= updateInterval
        ) {
          lastOrientationUpdate = now;
          ws.send(
            JSON.stringify({
              type: "orientation",
              sourceId: sourceId,
              timestamp: now,
              orientation: {
                x: event.alpha,
                y: event.beta,
                z: event.gamma,
                absolute: event.absolute,
              },
            }),
          );
        }
      });
    }
  });
}

// Prevent default touch behavior to avoid zoom and interaction issues
document.addEventListener("touchmove", function (event) {
  event.preventDefault();
}, { passive: false });

document.addEventListener("touchstart", function (event) {
  if (event.target.id !== "startButton") {
    event.preventDefault();
  }
}, { passive: false });

// Start the app
document.getElementById("startButton").addEventListener("click", function () {
  getAccel();
});
