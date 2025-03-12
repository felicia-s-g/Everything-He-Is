const express = require("express");
const path = require("path");
const https = require("https");
const WebSocket = require("ws");
const cors = require("cors");
const {
  validateSensorData,
  generateSignal,
  normalizeSensorData,
  getAccelerationIndex,
} = require("./utils");
const fs = require("fs");

// SSL certificate configuration
const sslOptions = {
  key: fs.readFileSync("./private/hub-selfsigned.key"),
  cert: fs.readFileSync("./certs/hub-selfsigned.crt"),
};

const app = express();
const server = https.createServer(sslOptions, app);

// Baseline calibration values for sensor data
let baseline = {
  acceleration: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0 },
  isCalibrated: false,
};

// Enable CORS for all routes
app.use(cors());

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: false,
  clientTracking: true,
});

// Apply baseline calibration to sensor data
function applyCalibration(sensorData) {
  if (!baseline.isCalibrated) return sensorData;

  const calibratedData = { ...sensorData };

  if (sensorData.type === "acceleration" && sensorData.acceleration) {
    calibratedData.acceleration = {
      x: sensorData.acceleration.x - baseline.acceleration.x,
      y: sensorData.acceleration.y - baseline.acceleration.y,
      z: sensorData.acceleration.z - baseline.acceleration.z,
    };
  } else if (sensorData.type === "orientation" && sensorData.orientation) {
    calibratedData.orientation = {
      x: sensorData.orientation.x - baseline.orientation.x,
      y: sensorData.orientation.y - baseline.orientation.y,
      z: sensorData.orientation.z - baseline.orientation.z,
    };
  }

  // Normalize the calibrated data to ensure values stay within expected ranges
  return normalizeSensorData(calibratedData);
}

// API endpoint to set baseline calibration
app.post("/api/calibrate", express.json(), (req, res) => {
  const { acceleration, orientation } = req.body;

  if (acceleration) {
    baseline.acceleration = acceleration;
  }

  if (orientation) {
    baseline.orientation = orientation;
  }

  baseline.isCalibrated = true;

  res.json({
    success: true,
    message: "Calibration successful",
    baseline,
  });
});

// API endpoint to reset calibration
app.post("/api/reset-calibration", (req, res) => {
  baseline = {
    acceleration: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0 },
    isCalibrated: false,
  };

  res.json({
    success: true,
    message: "Calibration reset successful",
  });
});

// API endpoint to get current calibration
app.get("/api/calibration", (req, res) => {
  res.json({
    isCalibrated: baseline.isCalibrated,
    baseline,
  });
});

// HTTP Routes for serving web pages / script files / images.
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

// Route to serve TV fullscreen view
app.get("/tv/fullscreen", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "tv", "fullscreen", "index.html"),
  );
});

// Route to serve TV preview view
app.get("/tv/preview", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tv", "preview", "index.html"));
});

// Redirect root to phone interface by default
app.get("/", (req, res) => {
  res.redirect("/phone");
});

// Route to return array of strings
app.get("/api/images", (req, res) => {
  const archivePath = path.join(__dirname, "public", "archive");

  fs.readdir(archivePath, (err, files) => {
    if (err) {
      console.error("Error reading archive directory:", err);
      return res.status(500).json({
        error: "Failed to read archive directory",
      });
    }

    // Filter for image files only (jpg, jpeg, png, gif)
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );

    // Create array of image objects with necessary properties
    const imageUrls = imageFiles.map((file, index) => ({
      id: index + 1,
      url: `/archive/${file}`,
      alt: file.replace(/\.[^/.]+$/, ""), // Remove file extension for alt text
      filename: file,
    }));

    res.json(imageUrls);
  });
});

// Store recent sensor readings (rolling window)
const sensorReadings = [];
const MAX_READINGS = 5; // Keep last 5 readings for analysis

function broadcastOrientation(orientation) {
  wss.clients.forEach((client) => {
    if (
      client.path === "/ws/raw-data-output" &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(JSON.stringify({
        type: "orientation",
        timestamp: new Date().toISOString(),
        orientation,
      }));
    }
  });
}

function broadcastPunchIntensity(intensity) {
  wss.clients.forEach((client) => {
    if (
      client.path === "/ws/data-output" && client.readyState === WebSocket.OPEN
    ) {
      client.send(JSON.stringify({
        type: "punch_intensity",
        timestamp: new Date().toISOString(),
        punchIntensity: intensity,
      }));
    }
  });
}

function broadcastRawSensorData(sensorData) {
  wss.clients.forEach((client) => {
    if (
      client.path === "/ws/raw-data-output" &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(JSON.stringify({
        type: "raw_sensor_data",
        timestamp: new Date().toISOString(),
        sensorData: sensorData,
      }));
    }
  });
}

// WebSocket connection handling
wss.on("connection", (ws, req) => {
  // Store the path in the WebSocket object for later reference
  ws.path = req.url;

  // The phone sends sensor data here
  if (req.url === "/ws/data-input") {
    // Data input handling
    ws.on("message", (message) => {
      try {
        const sensorData = JSON.parse(message.toString());
        const validSensorData = validateSensorData(sensorData);

        if (validSensorData) {
          // Apply calibration to the sensor data
          const calibratedData = applyCalibration(validSensorData);

          // Broadcast raw sensor data to raw-data-output clients
          broadcastRawSensorData(calibratedData);

          // Add new reading to the rolling window
          sensorReadings.push(calibratedData);
          if (sensorReadings.length > MAX_READINGS) {
            sensorReadings.shift(); // Remove oldest reading
          }

          if (sensorData.type === "acceleration") {
            const acceleration = getAccelerationIndex(sensorData);
            if (acceleration > 7) {
              console.log(acceleration);
              broadcastPunchIntensity(acceleration);
            }
          }

          if (sensorData.type === "orientation") {
            broadcastOrientation(sensorData.orientation);
          }
        }
      } catch (error) {
        console.error("Error processing sensor data:", error);
      }
    });
  } else if (req.url === "/ws/data-output") {
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      timestamp: new Date().toISOString(),
      message: "Connected to punch intensity stream",
    }));
  } else if (req.url === "/ws/raw-data-output") {
    // Send initial connection confirmation for raw data stream
    ws.send(JSON.stringify({
      timestamp: new Date().toISOString(),
      message: "Connected to raw sensor data stream",
    }));
  }

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed for path:", req.url);
  });
});

// Error handling for WebSocket server
wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

const PORT = process.env.PORT || 443;
server.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});
