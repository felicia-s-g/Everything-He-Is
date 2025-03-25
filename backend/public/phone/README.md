# Phone Interface Documentation

The phone interface is a web-based application that collects device motion and
orientation data from mobile devices and sends it to the server via WebSocket
connection. It's designed to be lightweight and responsive, with automatic
reconnection handling and data throttling.

## Overview

The interface is optimized for mobile device usage with all touch interactions
(zoom, pan) disabled to prevent accidental navigations or data interruptions.
Data is collected and sent to the server every 50ms. The page will attempt to
reconnect to the backend if the WS connection is broken.

## Query Parameters

### deviceId (optional)

- Type: string
- Description: A unique identifier for the device
- Usage: Can be provided in the URL query parameters (e.g., `?deviceId=abc123`)
- Default: If not provided, the system will:
  1. Check localStorage for an existing device ID
  2. Generate a new random ID if none exists

## WebSocket Connection

### Endpoint

```
wss://{hostname}:{port}/ws/data-input
```

### Connection Behavior

- Automatically attempts to reconnect on disconnection
- Maximum reconnection delay is capped at 5 seconds
- Connection status is displayed in the UI

## Data Interfaces

### Acceleration Data

```typescript
interface AccelerationData {
  type: "acceleration";
  sourceId: string;
  timestamp: number;
  acceleration: {
    x: number; // m/s²
    y: number; // m/s²
    z: number; // m/s²
  };
}
```

### Orientation Data

```typescript
interface OrientationData {
  type: "orientation";
  sourceId: string;
  timestamp: number;
  orientation: {
    x: number;
    y: number;
    z: number;
    absolute: boolean;
  };
}
```

## Data Collection

### Update Frequency

- Data is throttled to send updates every 50ms
- Separate throttling for acceleration and orientation data
- Requires user permission for device motion access

### Data Collection Process

1. User clicks the start button
2. System requests device motion permission
3. Upon permission grant:
   - Starts collecting acceleration data
   - Starts collecting orientation data
   - Sends data to server via WebSocket

## UI Features

### Connection Status Display

- Shows current connection state (connected/connecting/disconnected)
- Displays device ID (first 6 characters)
- Updates in real-time as connection state changes

### Touch Handling

- Prevents default touch behaviors to avoid zoom issues
- Disables all touch interactions (zoom, pan) to prevent accidental navigations
- Allows interaction with the start button
- Optimized for mobile device usage
- Ensures stable data collection without interruption

## Security

- Uses WSS (WebSocket Secure) for encrypted communication
- Requires explicit permission for device motion access
- Device identification for data source tracking

## Browser Support

Requires a modern browser with support for:

- WebSocket API
- DeviceMotionEvent API
- DeviceOrientationEvent API
- localStorage API

### Known Browser Limitations

- iOS Safari: Requires user interaction for motion data
- Chrome: Requires HTTPS for motion sensors
- Firefox: May require explicit permission for orientation data

## Usage Example

1. Access the phone interface:
   ```
   https://{hostname}:{port}/phone
   ```

2. Optionally add a device ID:
   ```
   https://{hostname}:{port}/phone?deviceId=your-device-id
   ```

3. Click the start button to begin data collection
4. Monitor the connection status in the UI
