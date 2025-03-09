let video = document.getElementById("movie");

function draw(predictions) {
  let sound = document.getElementById("sound");
  if (predictions.length > 0) {
    //control if we have at least two item with label open
    let hand = predictions.filter((item) => item.label === "open");
    if(hand.length >= 2){
      sound.play();
    }
    else {
      sound.pause();
    }
  }
}

// map function
function mapRange(value, a, b, c, d) {
  value = (value - a) / (b - a);
  return c + value * (d - c);
}
