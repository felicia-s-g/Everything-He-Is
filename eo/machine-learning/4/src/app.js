function draw(predictions) {
  let sound = document.getElementById("sound");
  let heightCanvas = document.getElementById("canvas").height;
  let widthCanvas = document.getElementById("canvas").width;


  if (predictions.length > 0) {

    let open = predictions.filter((item) => item.label === "open");
    if (open.length >= 1) {
      sound.play();
    } else {
      sound.pause();
    }

    let close = predictions.filter((item) => item.label === "closed");
    if (close.length >= 1) {
      let xClose = close[0].bbox[0];
      let yClose = close[0].bbox[1];
      let volume = mapRange(yClose, 0, heightCanvas, 1, 0);
      if(volume > 0 && volume < 1){
        sound.volume = volume;
      }
    }
  }
}

// map function
function mapRange(value, a, b, c, d) {
  value = (value - a) / (b - a);
  return c + value * (d - c);
}
