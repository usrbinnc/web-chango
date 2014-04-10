/*Do the video capture stuff here. 

  There are two canvases:
  Canvo/canvas - used to capture frames of video
  displaycanvo/dispcanvas - used as the framebuffer
 
  The framebuffer is updated periodically in putOnCanvas (10 fps-20 fps work OK)

  The video capture element is hidden.  Its data is slapped into canvo for 
  processing
*/
/*the video element -- in a hidden div*/
var video = document.getElementById('vidyo');

/*the "work" canvas -- in a hidden div*/
var canvas = document.getElementById('canvo');
var dispcanvas = document.getElementById('displaycanvo');

/*the rendering canvas -- in a visible div*/
var ctx = canvas.getContext('2d');
ctx.scale(.25,.25);
var dispctx = dispcanvas.getContext('2d');
dispctx.scale(4,4);

/*The rate at which the frame rendering callback gets called*/
var fps = 2;
   
var numBlocks = 25;
var blocksPerRow = 5;
var numPxPerBCol = 32; //canvo width / 5
var numPxPerBRow = 24; 
var numPxPerBlock = numPxPerBCol * numPxPerBRow;

var dispw = canvas.width;
var disph = canvas.height;

var blockArray = new Array();

/*Get the right-named callback*/
navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.getUserMedia;
window.URL = window.URL || window.webkitURL;

var audiolet = new Audiolet();
var synth;
var Synth = function(audiolet, frequency) {

  AudioletGroup.apply(this, [audiolet, 0, 1]);
  
  this.fd = new Saw(audiolet, 100);
  this.reverb = new Reverb(audiolet, .5, .9, .5);
  this.endGain = new Gain(audiolet,.5);

  var tones = [131, 147, 165, 175, 196,    220, 247, 262, 294, 330,   349, 391, 440, 493, 523,   587, 659, 698, 783, 880,   988, 1047, 1175, 1319, 1397];
            

  this.waveArray = new Array();
  for( var i = 0; i < numBlocks; i++ ){

    this.waveArray[i] = new Sine(audiolet, tones[i]/*TODO: Tuning*/);

  }

  this.gainArray = new Array();
  for( var i = 0; i < numBlocks; i++ ){
    this.gainArray[i] = new Gain(audiolet,.5);
    this.waveArray[i].connect(this.gainArray[i]);
    this.gainArray[i].connect(this.endGain);
  }

  this.fd.connect(this.reverb,0,1);
  this.reverb.connect(this.endGain);

  this.endGain.connect(this.outputs[0]);

};
extend(Synth, AudioletGroup);


/*
  0  1  2  3
  4  5  6  7
  8  9  10 11 
  12 13 14 15
*/

function Col(px,w){
  return px % w;
}
  
function Row(px,w){
  return Math.floor(px / w);
}

function BlockCol(col){
  return Math.floor(col / numPxPerBCol);
}

function BlockRow(row){
  return Math.floor(row / numPxPerBRow);
}

/*
  The image processing callback
  Put the output pixels into dispctx 
*/
function putOnCanvas(img){

  ctx.drawImage(video,0,0); 
  
  var frame = ctx.getImageData(0,0,canvas.width,canvas.height);
  var origframe = ctx.getImageData(0,0,canvas.width,canvas.height);

  var l = frame.data.length / 4;

  for (var j = 0; j < numBlocks; j++){
    blockArray[j] = 0;    
  }

  for (var i = 0; i < l; i = i + 4) {

    var row = Row(i,canvas.width);
    var col = Col(i,canvas.width);
    var brow = BlockRow(row,canvas.height);
    var bcol = BlockCol(col,canvas.width);

    var off = i * 4;
    var r = frame.data[off + 0];
    var g = frame.data[off + 1];
    var b = frame.data[off + 2];

   
    off = brow * blocksPerRow + bcol; 
    blockArray[off] = blockArray[off] + r + g + b;

  }

  for (var j = 0; j < numBlocks; j++){
    var newVal = blockArray[j] / (numPxPerBlock);
    blockArray[j] = newVal;
    synth.gainArray[j].gain.setValue( newVal / 768 )
  }

  for (var i = 0; i < l; i++) {
    
    var row = Row(i,canvas.width);
    var col = Col(i,canvas.width);
    var brow = BlockRow(row,canvas.height);
    var bcol = BlockCol(col,canvas.width);

    var off = i * 4;
    frame.data[off + 0] = 0;
    frame.data[off + 1] = 0;
    //frame.data[off + 2] = blockArray[brow * blocksPerRow + bcol]; //Math.floor((blockArray[brow * blocksPerRow + bcol] + origframe.data[off + 2]) / 2);
    frame.data[off + 2] = Math.floor((blockArray[brow * blocksPerRow + bcol] + origframe.data[off + 2]) / 2);

  }
 
  ctx.putImageData(frame, 0, 0);
  dispctx.drawImage(canvas,10,10);

};

/*This is the Success handler when we try to start a video element.  
  It finds the window and handles resizing the canvases we use for
  pixel manipulation*/
function gotStream(stream) {

  if (window.URL) {

    video.src = window.URL.createObjectURL(stream);

  } else {

    video.src = stream; // Opera.

  }

  video.onerror = function(e) {
    stream.stop();
  };

  stream.onended = noStream;

  video.onloadedmetadata = function(e) { // Not firing in Chrome. See crbug.com/110938.
    canvas.width = video.videoWidth;
    canvas.height= video.videoHeight;
    dispcanvas.width = video.videoWidth;
    dispcanvas.height= video.videoHeight;
    numPxPerBCol = canvas.width / blocksPerRow; 
    numPxPerBRow = canvas.height / blocksPerRow; 

  };

}

/*This is the failure handler for the video element.
  If your camera is screwy or something goes wrong, this happens*/
function noStream(e) {
  var msg = 'No camera available.';
  if (e.code == 1) {
    msg = 'User denied access to use camera.';
  }
  document.getElementById('errorMessage').textContent = msg;
}

/*Start button callback.  
  This calls getUserMedia to start the video element playing.
  This also sets up the frame rendering callback putOnCanvas
*/
function init(el) {

  if (!navigator.getUserMedia) {
    document.getElementById('errorMessage').innerHTML = 'Sorry. <code>navigator.getUserMedia()</code> is not available.';
    return;
  }

  navigator.getUserMedia({video: true}, gotStream, noStream);
  setInterval( putOnCanvas, 1000 / fps );
  synth = new Synth(audiolet, 440);
  synth.connect(this.audiolet.output);

}
