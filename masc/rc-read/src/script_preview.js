const imagePath = "src/archive";
        const totalImages = 123;
        let images = Array.from({ length: totalImages }, (_, i) => `${imagePath}/MASC_ARCH_${String(i + 1).padStart(5, "0")}.jpg`);
        
        // shuffles images
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        
        localStorage.setItem("shuffledImages", JSON.stringify(images));
        
        let selectedIndex = 0;
        const imageList = document.getElementById("image-list");
        
        function updatePreview() {
            imageList.innerHTML = "";
            images.forEach((imgSrc, index) => {
                const imgElement = document.createElement("img");
                imgElement.src = imgSrc;
                imgElement.className = "preview-image";
                if (index === selectedIndex) {
                    imgElement.classList.add("selected");
                }
                imgElement.onclick = () => {
                    selectedIndex = index;
                    localStorage.setItem("selectedIndex", selectedIndex);
                    window.dispatchEvent(new Event("storage"));
                    updatePreview();
                };
                imageList.appendChild(imgElement);
            });
        }
        
        updatePreview();