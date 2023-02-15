let debugInfo = document.getElementById('debug');

let imageCanvas = document.createElement('canvas');
let imageContext = imageCanvas.getContext('2d', { willReadFrequently: true });
let frameCanvas = document.querySelector('canvas');
let frameContext = frameCanvas.getContext('2d');

// frameCanvas.width = window.innerWidth;
// frameCanvas.height = window.innerHeight;
frameCanvas.width = 960;
frameCanvas.height = 540;

imageCanvas.width = 1920;
imageCanvas.height = 1080;

// let scale = frameCanvas.width / imageCanvas.width;
let scale = 0.25;
frameContext.scale(scale, scale);

imageContext.lineWidth = 5;

let isDrawing = false;

let frameX = 0, frameY = 0; // frame in image
let mouseX, mouseY; // mouse in image

let frameRect = frameCanvas.getBoundingClientRect();

function setMousePosition(e) {
    mouseX = e.pageX / scale - frameX;
    mouseY = e.pageY / scale - frameY;
}

document.addEventListener('mousedown', e => {
    if (e.button != 0) return; // left click only
    
    setMousePosition(e);
    
    imageContext.beginPath();
    imageContext.moveTo(mouseX, mouseY);
    
    isDrawing = true;
});

document.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    
    setMousePosition(e);
    
    imageContext.lineTo(mouseX, mouseY);
    imageContext.stroke();
    
    // let data = imageContext.getImageData(frameX, frameY, frameCanvas.width / scale, frameCanvas.height / scale);
    frameContext.drawImage(imageCanvas, 0, 0);
});

document.addEventListener('mouseup', e => {
    if (e.button != 0) return; // left click only
    
    isDrawing = false;
});

document.addEventListener('mousemove', e => {
    // setMousePosition(e);
    debugInfo.innerHTML = `
        pageX: ${e.pageX}<br>
        pageY: ${e.pageY}<br>
        clientX: ${e.clientX}<br>
        clientY: ${e.clientY}<br>
        mouseX: ${mouseX}<br>
        mouseY: ${mouseY}<br>
        frameX: ${frameX}<br>
        frameY: ${frameY}<br>
    `;
});

document.body.appendChild(imageCanvas);