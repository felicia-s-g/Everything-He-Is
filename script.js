// Global variables section - add these
let isSeedMode = false;
let currentSeed = Date.now().toString(); // Default seed based on current time
let seededRandom; // Function for deterministic random selection

// At the beginning of your script, add this function to parse URL parameters
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("seed")) {
    isSeedMode = true;
    currentSeed = params.get("seed");
    console.log(`Seed mode activated with seed: ${currentSeed}`);
    // Initialize the seeded random function
    initSeededRandom(currentSeed);
  } else {
    isSeedMode = false;
    console.log("Random mode active (no seed provided)");
  }
}

// Add a function to initialize and create a seeded random number generator
function initSeededRandom(seed) {
  // Simple seeded random function
  let state = Array.from(seed.toString()).reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  seededRandom = function () {
    const x = Math.sin(state++) * 10000;
    return x - Math.floor(x);
  };
}

// Modify your existing random selection functions to use the seeded random when in seed mode
function getRandomInt(min, max) {
  if (isSeedMode) {
    return Math.floor(seededRandom() * (max - min + 1)) + min;
  } else {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Modify your image selection function to use the seeded random
function getRandomImage(images) {
  if (isSeedMode) {
    const randomIndex = Math.floor(seededRandom() * images.length);
    return images[randomIndex];
  } else {
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
  }
}

// Call the query param function when the page loads
window.addEventListener("DOMContentLoaded", function () {
  getQueryParams();
  // Add mode indicator to the page
  const modeIndicator = document.createElement("div");
  modeIndicator.id = "mode-indicator";
  modeIndicator.style.position = "fixed";
  modeIndicator.style.bottom = "10px";
  modeIndicator.style.right = "10px";
  modeIndicator.style.background = "rgba(0,0,0,0.7)";
  modeIndicator.style.color = "white";
  modeIndicator.style.padding = "5px 10px";
  modeIndicator.style.borderRadius = "5px";
  modeIndicator.style.fontSize = "12px";
  modeIndicator.style.zIndex = "1000";

  if (isSeedMode) {
    modeIndicator.textContent = `Seed Mode: ${currentSeed}`;
  } else {
    modeIndicator.textContent = "Random Mode";
  }

  document.body.appendChild(modeIndicator);

  // Continue with your existing initialization
  // ... existing code ...
});
