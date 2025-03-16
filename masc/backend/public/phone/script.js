// WebSocket connection
let ws;
let reconnectAttempts = 0;
const baseReconnectDelay = 1000; // 1 second
let isConnected = false;
let maxReconnectDelay = 30000; // Cap delay at 30 seconds

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
    updateConnectionStatus("connected", "Connected");
  };

  ws.onmessage = (event) => {
    console.log("Received message:", event.data);
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
    delay = Math.min(delay, maxReconnectDelay); // Cap the delay

    console.log(`Attempting to reconnect in ${delay}ms...`);

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
  updateConnectionStatus("connecting", "Initializing...");

  // Initialize WebSocket connection
  connectWebSocket();
});

async function getAccel() {
  DeviceMotionEvent.requestPermission().then((response) => {
    if (response == "granted") {
      window.addEventListener("devicemotion", (event) => {
        if (isConnected && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "acceleration",
              timestamp: Date.now(),
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
        if (isConnected && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "orientation",
              timestamp: Date.now(),
              orientation: {
                x: event.alpha,
                y: event.beta,
                z: event.gamma,
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
