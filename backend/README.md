# Interactive Image Gallery Backend

## Overview

This backend server powers an interactive image gallery system that enables
real-time synchronization between mobile devices and display screens.

## Prerequisites

- Node.js (v14 or higher)
- NPM (Node Package Manager) v6 or higher

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/felicia-s-g/felicia-s-g.github.io.git
cd felicia-s-g.github.io
```

2. Install dependencies:

```bash
cd backend
npm install
```

3. Start the server:

```bash
npm start
```

### Configuration

The server ports can be customized using environment variables:

```bash
HTTP_PORT=3000 HTTPS_PORT=3443 npm start
```

Default ports are 3000 (HTTP) and 3443 (HTTPS) if not specified.

## Running the project

Once the server is running, follow these steps to use the interactive image
gallery:

1. **Access the Mobile Interface**
   - Open your mobile device's web browser
   - Navigate to `http://[your-server-ip]:[port]/phone/`
   - Allow browser permissions for motion and orientation sensors when prompted
   - The phone interface will show a connection status indicator

2. **Launch the Gallery Display**
   - On a separate device (preferably a larger screen), open your web browser
   - Navigate to `http://[your-server-ip]:[port]/tv/`
   - The page should react to real-time device data

3. **Troubleshooting**
   - If the connection is lost, refresh both pages
   - For debugging, you can open
     `http://[your-server-ip]:[port]/phone/debug.html` to see real-time sensor
     data
   - Ensure the gallery page uses the correct data `sourceId`

### Multiple Device Support

The system supports multiple simultaneous sensor data streams from different
devices. Each device can be configured with a unique identifier (sourceId) to
control different gallery displays. By default, the gallery page listens for
sensor data with the sourceId `felicia`. To use multiple devices:

1. On the phone interface, you can set a custom `sourceId` via query parameters
2. On the gallery page, select the corresponding `sourceId` from the dropdown
   menu
3. Each gallery instance can be controlled by a different phone by selecting
   different sourceIds

For more detailed information about device configuration and sourceId
management, see the [phone README](./public/phone/README.md).

## Project Structure

The system is built as a client-server architecture with multiple frontend
components and a unified backend server. The core communication between
components is handled through WebSocket connections, enabling real-time data
streaming and synchronization.

### Architecture Overview

The application consists of these main components:

1. **Frontend Pages**: Multiple web interfaces serving different purposes
2. **Backend Server**: A Node.js/Express server handling both HTTP and WebSocket
   connections

### Frontend Components

1. **Interactive Image Gallery** (`public/tv/index.html`)
   - Displays images with dynamic scrolling, panning, and zooming
   - Responds to real-time acceleration and orientation data
   - Synchronized with mobile device movements

2. **Mobile Sensor Interface** (`public/phone/index.html`)
   - Captures device motion and orientation data
   - Utilizes browser DeviceMotion and DeviceOrientation APIs
   - Transmits sensor data via WebSocket connection

3. **Debug Dashboard** (`public/phone/debug.html`)
   - Real-time visualization of device orientation
   - Displays incoming WebSocket event data
   - Useful for development and troubleshooting

### Backend Components

1. **HTTP / WebSocket Server**
   - Serves the frontend components listed above
   - Manages real-time bidirectional communication, handles client connections
     and data routing
   - Processes and broadcasts sensor data

2. **Transport Protocols**
   - WebSocket channels for real-time sensor data
   - HTTP endpoints for static content

### Data Flow Architecture

The system follows a publish-subscribe pattern where:

1. Mobile devices act as data publishers, sending sensor data through WebSocket
   connections
2. The backend server processes and routes this data to appropriate subscribers
3. Display screens subscribe to specific data streams and update their
   visualizations accordingly

Each component can be configured to work with specific data streams using unique
identifiers (sourceIds), allowing for multiple independent control channels to
coexist on the same server.
