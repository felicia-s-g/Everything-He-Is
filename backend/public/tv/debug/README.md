# TV Debug Interface

This debug interface provides real-time visualization and monitoring tools for
the phone-based motion tracking system.

## Features

### 3D Phone Orientation Visualization

- Live 3D view of device orientation
- Color-coded axes for movement tracking
- Interactive calibration support

### Punch Strength Meter

- Real-time acceleration visualization
- Color-coded strength indicators
- Threshold markers for weak/normal/strong

### Message Logging

- Real-time system message display
- Filterable by message type
- Auto-scrolling with clear option

### Runtime Configuration

- Live parameter adjustment
- Punch detection settings
- Photo scrolling controls
- Acceleration weights

### Multi-Device Support

- Source ID selection
- Independent device tracking
- Real-time device switching

## Usage

1. Open the debug interface in your browser
2. Connect your phone device(s)
3. Use the source selector to choose the active device
4. Monitor the 3D visualization and punch strength meter
5. Use the configuration block to adjust settings as needed
6. Check the message logs for system status and debugging information

## Configuration Options

### Punch Thresholds

- **Weak Threshold**: Minimum acceleration value for a weak punch
- **Normal Threshold**: Minimum acceleration value for a normal punch
- **Strong Threshold**: Minimum acceleration value for a strong punch
- **Max Punch Value**: Maximum acceleration value for scaling

### Punch Detection Settings

- **Min Detection Threshold**: Minimum acceleration value to trigger detection
- **Punch Cooldown**: Minimum time between detected punches in milliseconds

### Acceleration Weights

- **X-axis Weight**: Weight for left/right movement (default: 1.0)
- **Y-axis Weight**: Weight for up/down movement (default: 1.0)
- **Z-axis Weight**: Weight for forward/backward movement (default: 1.0)

### Photo Scrolling Settings

- **Base Scroll Multiplier**: Controls overall scrolling speed
  - Range: 0.1 to 10.0
- **Scaling Factor**: How punch strength affects number of photos
  - Range: 0.05 to 2.0
  - Higher values = more photos per punch strength
- **Maximum Photos**: Max photos to scroll per punch

### Message Filters

The debug interface allows filtering of different message types:

- Punches
- System messages
- Error messages
- Acceleration data
- Orientation data

### Endpoints

#### WebSocket

- `/ws/debug` - Main WebSocket connection for real-time data
  - Receives: Device orientation, acceleration, punch events
  - Sends: Configuration updates, calibration data

#### REST API

- `GET /api/config` - Retrieves current configuration
- `POST /api/config` - Updates configuration
  - Body: `{ punch: { ...config } }`
  - Fallback for WebSocket configuration updates
