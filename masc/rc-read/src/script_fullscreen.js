const imagePath = "src/archive";
        const totalImages = 54;
        let images = Array.from({ length: totalImages }, (_, i) => `${imagePath}/MASC_ARCH_${String(i + 1).padStart(5, "0")}.jpg`);
        
        function updateFullscreen() {
            let storedIndex = localStorage.getItem("selectedIndex");
            let storedImages = localStorage.getItem("shuffledImages");
            if (storedIndex !== null && storedImages !== null) {
                images = JSON.parse(storedImages);
                let index = parseInt(storedIndex);
                if (index >= 0 && index < images.length) {
                    document.getElementById("fullscreen-image").src = images[index];
                }
            }
        }
        
        window.addEventListener("storage", updateFullscreen);
        updateFullscreen();