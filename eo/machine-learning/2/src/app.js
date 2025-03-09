//two open hand

let video = document.getElementById("movie");

function draw(predictions) {

  // if we have a prediction
  if (predictions.length > 0) {
    //control if we have at least two item with label open

    let hand = predictions.filter((item) => item.label === "open");

    if(hand.length >= 3){
      video.play();
    }
    else {
      video.pause();
    }
  }

}

video.addEventListener("click", () => {
  video.muted = !video.muted;
});
