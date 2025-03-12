let images = [];

function updateFullscreen() {
  let storedIndex = localStorage.getItem("selectedIndex");
  let storedImages = localStorage.getItem("shuffledImages");

  if (storedIndex !== null && storedImages !== null) {
    images = JSON.parse(storedImages);
    let index = parseInt(storedIndex);

    if (index >= 0 && index < images.length) {
      document.getElementById("fullscreen-image").src = images[index];
    }
  } else {
    // If no selected image is found, fetch from API and display the first one
    fetchFirstImage();
  }
}

async function fetchFirstImage() {
  try {
    const response = await fetch("/api/images");
    if (!response.ok) {
      throw new Error("Failed to fetch images");
    }

    const imageData = await response.json();
    if (imageData.length > 0) {
      document.getElementById("fullscreen-image").src = imageData[0].url;
    }
  } catch (error) {
    console.error("Error fetching first image:", error);
  }
}

window.addEventListener("storage", updateFullscreen);
updateFullscreen();
