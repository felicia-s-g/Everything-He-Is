// Look for the event listener that handles device motion
window.addEventListener("devicemotion", function (event) {
  // Check if the code is only using one axis like this:
  let acceleration = event.accelerationIncludingGravity.x;
  // or
  // let acceleration = event.acceleration.x;

  // It should instead use all three axes like this:
  let accX = event.accelerationIncludingGravity.x;
  let accY = event.accelerationIncludingGravity.y;
  let accZ = event.accelerationIncludingGravity.z;

  // Then either use them separately or calculate the total acceleration magnitude:
  let totalAcceleration = Math.sqrt(accX * accX + accY * accY + accZ * accZ);

  // ... rest of the handler function

  // Add debugging to see all acceleration values
  console.log("Acceleration X: " + event.accelerationIncludingGravity.x);
  console.log("Acceleration Y: " + event.accelerationIncludingGravity.y);
  console.log("Acceleration Z: " + event.accelerationIncludingGravity.z);
});

function handleMotion(event) {
  // Add debugging to see all acceleration values
  console.log("Acceleration X: " + event.accelerationIncludingGravity.x);
  console.log("Acceleration Y: " + event.accelerationIncludingGravity.y);
  console.log("Acceleration Z: " + event.accelerationIncludingGravity.z);

  // ... rest of your existing motion handling code
}
