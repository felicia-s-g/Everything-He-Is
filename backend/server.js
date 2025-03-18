const express = require("express");
const path = require("path");
const https = require("https");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const {
  extractSensorData,
  getAccelerationIndex,
  calibrateOrientation,
  getNormalizedOrientation,
  isOrientationCalibrated,
  resetCalibration,
} = require("./utils");
const fs = require("fs");
const { classifiedPunchDetected } = require("./signals");
const { config, updateConfig, getConfig } = require("./config");

// SSL certificate configuration
const sslOptions = {
  key: fs.readFileSync("./private/hub-selfsigned.key"),
  cert: fs.readFileSync("./certs/hub-selfsigned.crt"),
};

const app = express();
const httpsServer = https.createServer(sslOptions, app);
const httpServer = http.createServer(app);

// Enable CORS for all routes
app.use(cors());

// Create WebSocket server for HTTPS
const websocketsServer = new WebSocket.Server({
  server: httpsServer,
  perMessageDeflate: false,
  clientTracking: true,
});

// Create WebSocket server for HTTP
const httpWebsocketsServer = new WebSocket.Server({
  server: httpServer,
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

// REST API for getting/updating config
app.use(express.json());

// Get current config
app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

// Update config
app.post("/api/config", (req, res) => {
  try {
    updateConfig(req.body);
    res.json({
      success: true,
      message: "Configuration updated",
      config: getConfig(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update configuration",
      error: error.message,
    });
  }
});

function sendToClients(server, channel, message) {
  let clientCount = 0;
  if (server.clients && server.clients.size > 0) {
    server.clients.forEach((client) => {
      if (client.path === channel && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        clientCount++;
      }
    });
  }
}

// Helper function to send to clients on both HTTP and HTTPS servers
function broadcastToAllClients(channel, message) {
  sendToClients(websocketsServer, channel, message);
  sendToClients(httpWebsocketsServer, channel, message);
}

function classifiedPunchDetector(server) {
  // Use the punch detector from signals.js which now uses the config singleton
  const signal = classifiedPunchDetected();

  return (sensorData) => {
    const punch = signal(sensorData);
    if (punch) {
      // Send to UI signals for the TV interface on both servers
      broadcastToAllClients("/ws/ui-signals", punch);

      // Also send to debug interface on both servers
      broadcastToAllClients("/ws/debug", punch);
    }
  };
}

function throttledDebug(server) {
  // Remove throttling entirely
  return (sensorData) => {
    // Send to both HTTP and HTTPS debug clients
    broadcastToAllClients("/ws/debug", sensorData);
  };
}

// Helper function to mirror messages between WebSocket servers
function mirrorWebSocketConnections(ws, req, sourceServer, targetServer) {
  // Store the path in the WebSocket object for later reference
  ws.path = req.url;

  let detectPunch = classifiedPunchDetector(sourceServer);
  let debug = throttledDebug(sourceServer);

  // The phone sends sensor data here
  if (req.url === "/ws/data-input") {
    // Data input handling
    ws.on("message", (message) => {
      try {
        const sensorData = extractSensorData(JSON.parse(message.toString()));

        if (!sensorData) {
          return;
        }

        // Apply normalization to orientation data if needed
        if (
          sensorData.type === "orientation" && isOrientationCalibrated() &&
          !sensorData.orientation.absolute
        ) {
          // Get normalized orientation data
          sensorData.orientation = getNormalizedOrientation(
            sensorData.orientation,
          );
        }

        // Send data immediately without throttling
        debug(sensorData);
        detectPunch(sensorData);

        // No need to mirror the data messages, as the punch detector and debug functions
        // already send to all connected clients via broadcastToAllClients
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  } // Debug interface
  else if (req.url === "/ws/debug") {
    // Send current configuration to the newly connected client
    ws.send(JSON.stringify({
      type: "system",
      message: "Current punch configuration",
      punchConfig: config.punch,
    }));

    // Handle configuration messages from the debug interface
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle configuration updates
        if (data.type === "config" && data.punchConfig) {
          // Update the global config through the singleton
          updateConfig({ punch: data.punchConfig });

          console.log("Updated punch configuration:", config.punch);

          // Re-initialize the punch detector with new configuration
          detectPunch = classifiedPunchDetector(sourceServer);

          // Send confirmation back to all debug clients
          broadcastToAllClients("/ws/debug", {
            type: "system",
            message: "Punch configuration updated",
            punchConfig: config.punch,
          });
        } else if (data.type === "getConfig") {
          // Send current configuration to the client that requested it
          ws.send(JSON.stringify({
            type: "system",
            message: "Current punch configuration",
            punchConfig: config.punch,
          }));
        } // Handle calibration request
        else if (data.type === "calibrateOrientation" && data.orientation) {
          const success = calibrateOrientation(data.orientation);

          // Send confirmation back to all debug clients
          broadcastToAllClients("/ws/debug", {
            type: "system",
            message: success
              ? "Orientation calibrated successfully"
              : "Orientation calibration failed",
            calibration: {
              isCalibrated: isOrientationCalibrated(),
              timestamp: Date.now(),
              // Include the original calibration orientation for reference
              referenceOrientation: {
                x: data.orientation.x,
                y: data.orientation.y,
                z: data.orientation.z,
              },
            },
          });
        } // Handle reset calibration request
        else if (data.type === "resetOrientation") {
          const success = resetCalibration();

          // Send confirmation back to all debug clients
          broadcastToAllClients("/ws/debug", {
            type: "system",
            message: success
              ? "Orientation calibration reset"
              : "Orientation calibration reset failed",
            calibration: {
              isCalibrated: isOrientationCalibrated(),
              timestamp: Date.now(),
            },
          });
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  } // UI signals client
  else if (req.url === "/ws/ui-signals") {
    // Nothing specific for UI signals clients, they just receive data
  }
}

// WebSocket connection handling for HTTPS
websocketsServer.on("connection", (ws, req) => {
  mirrorWebSocketConnections(ws, req, websocketsServer, httpWebsocketsServer);
});

// WebSocket connection handling for HTTP
httpWebsocketsServer.on("connection", (ws, req) => {
  mirrorWebSocketConnections(ws, req, httpWebsocketsServer, websocketsServer);
});

// Environment variables
const HTTPS_PORT = process.env.HTTPS_PORT || 3000;
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const REDIRECT_HTTP_TO_HTTPS = process.env.REDIRECT_HTTP_TO_HTTPS === "true";

// Optional HTTP to HTTPS redirect middleware
if (REDIRECT_HTTP_TO_HTTPS) {
  app.use((req, res, next) => {
    if (!req.secure) {
      // Get host from request and replace port with HTTPS port
      const host = req.get("host").replace(/:\d+$/, ""); // Remove port if present
      return res.redirect(`https://${host}:${HTTPS_PORT}${req.url}`);
    }
    next();
  });
}

// Start the servers
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP Server running on port ${HTTP_PORT}`);
  if (REDIRECT_HTTP_TO_HTTPS) {
    console.log(`HTTP traffic will be redirected to HTTPS`);
  } else {
    console.log(`Both HTTP and HTTPS traffic will be handled separately`);
  }
});
