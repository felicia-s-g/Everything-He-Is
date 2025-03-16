const express = require("express");
const path = require("path");
const https = require("https");
const WebSocket = require("ws");
const cors = require("cors");
const {
  extractSensorData,
  getAccelerationIndex,
} = require("./utils");
const fs = require("fs");
const { aggressionLevel, punchDetected, tiltDetected } = require("./signals");

// SSL certificate configuration
const sslOptions = {
  key: fs.readFileSync("./private/hub-selfsigned.key"),
  cert: fs.readFileSync("./certs/hub-selfsigned.crt"),
};

const app = express();
const server = https.createServer(sslOptions, app);

// Enable CORS for all routes
app.use(cors());

// Create WebSocket server
const websocketsServer = new WebSocket.Server({
  server,
  perMessageDeflate: false,
  clientTracking: true,
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

function sendToClients(server, channel, message) {
  if (server.clients?.size > 0) {
    server.clients.forEach((client) => {
      if (client.path === channel && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

function punchDetector(server) {
  const signal = punchDetected(5);

  return (sensorData) => {
    const punch = signal(sensorData);
    if (punch) {
      sendToClients(server, "/ws/ui-signals", punch);
    }
  };
}

function tiltDetector(server) {
  const signal = tiltDetected();

  return (sensorData) => {
    const tilt = signal(sensorData);

    if (tilt) {
      sendToClients(server, "/ws/ui-signals", {
        type: "tilt",
        tilt: tilt.tilt,
      });
    }
  };
}
function aggresionDetector(server) {
  const signal = aggressionLevel(0.95);

  return (sensorData) => {
    const aggression = signal(sensorData);
    if (aggression) {
      sendToClients(server, "/ws/ui-signals", aggression);
    }
  };
}

function throttledDebug(server) {
  let lastSent = 0;
  const THROTTLE_TIME = 100; // 100ms

  return (sensorData) => {
    const now = Date.now();
    if (now - lastSent > THROTTLE_TIME) {
      sendToClients(server, "/ws/debug", sensorData);
      lastSent = now;
    }
  };
}

// WebSocket connection handling
websocketsServer.on("connection", (ws, req) => {
  // Store the path in the WebSocket object for later reference
  ws.path = req.url;

  let detectPunch = punchDetector(websocketsServer);
  let aggression = aggresionDetector(websocketsServer);
  let tilt = tiltDetector(websocketsServer);
  let debug = throttledDebug(websocketsServer);
  // The phone sends sensor data here
  if (req.url === "/ws/data-input") {
    // Data input handling
    ws.on("message", (message) => {
      try {
        const sensorData = extractSensorData(JSON.parse(message.toString()));

        if (!sensorData) {
          return;
        }
        debug(sensorData);
        detectPunch(sensorData);
        aggression(sensorData);
        tilt(sensorData);
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
