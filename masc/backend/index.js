const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const { validateSensorData, generateSignal } = require("./utils");

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors());

// Create a single WebSocket server
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: false,
  clientTracking: true,
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Route to serve phone interface
app.get("/phone", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "phone", "index.html"));
});

// Route to serve TV interface
app.get("/tv", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tv", "index.html"));
});

// Redirect root to phone interface by default
app.get("/", (req, res) => {
  res.redirect("/phone");
});

// Route to return array of strings
app.get("/api/images", (req, res) => {
  const numberOfImages = 12;
  const imageUrls = Array.from({ length: numberOfImages }, (_, i) => ({
    id: i + 1,
    url: `https://picsum.photos/800/450?random=${i + 1}`,
    alt: `Random Image ${i + 1}`,
  }));
  res.json(imageUrls);
});

// Store recent sensor readings (rolling window)
const sensorReadings = [];
const MAX_READINGS = 5; // Keep last 5 readings for analysis

// Broadcast punch intensity to all clients connected to data-output
function broadcastPunchIntensity(intensity) {
  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN && client.path === "/ws/data-output"
    ) {
      const data = {
        type: "punch_intensity",
        timestamp: new Date().toISOString(),
        punchIntensity: intensity,
      };
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket connection handling for both data input and output
wss.on("connection", (ws, req) => {
  // Store the path in the WebSocket object for later reference
  ws.path = req.url;

  if (req.url === "/ws/data-input") {
    // Data input handling
    ws.on("message", (message) => {
      try {
        const sensorData = JSON.parse(message.toString());

        // Validate the received data
        const validSensorData = validateSensorData(sensorData);

        if (validSensorData) {
          // Add new reading to the rolling window
          sensorReadings.push(validSensorData);
          if (sensorReadings.length > MAX_READINGS) {
            sensorReadings.shift(); // Remove oldest reading
          }

          // Only calculate intensity if we have at least 2 readings
          if (sensorReadings.length >= 2) {
            const intensity = generateSignal(sensorReadings);
            console.log("Current punch intensity:", intensity);

            // Broadcast the intensity to all data-output clients
            broadcastPunchIntensity(intensity);
          }
        }
      } catch (error) {
        console.error("Error processing sensor data:", error);
      }
    });
  } else if (req.url === "/ws/data-output") {
    // Send initial connection confirmation
    const data = {
      timestamp: new Date().toISOString(),
      message: "Connected to punch intensity stream",
    };
    ws.send(JSON.stringify(data));
  }

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed for path:", req.url);
  });
});

// Add error handling for the WebSocket server
wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
