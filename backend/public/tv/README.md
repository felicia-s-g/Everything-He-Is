# TV Interface Documentation

The TV interface is a web-based application that displays and responds to device
motion data, particularly focused on punch detection and photo display.

## Overview

The interface is designed to be displayed on TV screens or large displays,
offering:

- Real-time photo display and navigation
- Punch-based interaction for photo scrolling
- Multi-device synchronization
- Dynamic visual effects based on device orientation

## Features

The interface implements a robust state synchronization system with automatic
reconnection handling and periodic state updates. It maintains consistency
across multiple displays through real-time sync status monitoring and on-demand
full state synchronization.

The display system features dynamic perspective adjustments and
orientation-based zoom effects, implemented through smooth CSS transitions and
responsive layout adaptation. The interface processes device orientation data to
create immersive visual effects that respond to device movement in real-time.

## Configuration

The TV interface supports various configuration options through query parameters
and interactive elements. The interface automatically fetches its configuration
from the API on initial load, which includes settings for visual effects and
transitions.

### Query Parameters

- `alphaOfTV`: Sets the initial rotation angle of the TV display (in degrees)
  relative to the phone's resting position
  - Positive values rotate clockwise
  - Negative values rotate counterclockwise
  - Example: `?alphaOfTV=90` for a 90-degree clockwise rotation
  - Default: 0 degrees

### Interactive Elements

The interface includes several interactive elements that appear on hover:

1. **Rotation Button** (`#rotate-button`)
   - Located in the bottom-right corner
   - Rotates the entire interface in 90-degree increments
   - Automatically adjusts image fitting for optimal display
   - Hidden by default, appears on hover

2. **Source ID Selector** (`#source-id-selector`)
   - Located in the top-right corner
   - Allows filtering content by device source
   - Options include:
     - "All Sources": Shows content from all connected devices
     - "Unclassified": Shows content without a source ID
     - Dynamic list of connected device IDs
   - Hidden by default, appears on hover

### Visual Effects

The interface implements dynamic visual effects based on device orientation.
These effects are fully configurable through the API configuration:

- **Perspective Changes**: Images respond to device movement with 3D transforms
- **Zoom Effects**: Dynamic scaling based on device tilt
- **Rotation Effects**: Subtle rotations based on device orientation
- **Smooth Transitions**: All effects use CSS transitions for smooth animation
- **Effect Parameters**: All visual effects can be tuned through the API config,
  including transition timing, intensity, and sensitivity to device movement

### Endpoints

The TV interface communicates with the server through two main WebSocket
endpoints:

#### `/ws/debug` Endpoint

This endpoint receives raw sensor data and system information:

- **Message Types**:
  - `acceleration`: Raw acceleration data from the device
  - `orientation`: Device orientation data (alpha, beta, gamma angles)

- **Configuration Updates**:
  - Receives and applies punch detection configuration
  - Updates TV-specific settings like calibrated alpha angle
  - Maintains synchronization with other connected clients

#### `/ws/ui-signals` Endpoint

This endpoint handles UI synchronization and punch events:

- **Message Types**:
  - `punch`: Punch events for photo navigation
  - `sync`: State synchronization messages
    - `fullSync`: Complete state synchronization
    - `update`: Incremental state updates
  - `system`: System status and counter updates

- **State Synchronization**:
  - Maintains consistent photo selection across multiple displays
  - Uses a global sync counter for event ordering
  - Implements periodic heartbeat updates
  - Supports on-demand full state synchronization

### `/api/config`

The TV interface fetches its configuration from this endpoint on initial load.
This endpoint provides settings for visual effects, transitions, and other
interface behaviors. See the [Debug page](./debug/README.md) documentation for
an overview of all options.

#### Usage

The interface automatically fetches this configuration on load and applies it
immediately. Configuration changes can be pushed to connected clients through
the `/ws/debug` WebSocket endpoint, allowing for dynamic updates to the
interface behavior without page reload.

### Message Format

```typescript
// Punch Event
interface PunchEvent {
   type: "punch";
   intensity: "weak" | "normal" | "strong";
   direction: string;
   timestamp: number;
   syncCounter?: number;
   sourceId?: string;
}

// Sync Event
interface SyncEvent {
   type: "sync";
   action: "fullSync" | "update";
   timestamp: number;
   data: {
      selectedIndex: number;
      seed: number;
      totalImages?: number;
   };
}
```
