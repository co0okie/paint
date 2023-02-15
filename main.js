let debugInfo = document.getElementById('debug');

let imageCanvas = document.createElement('canvas');
let imageContext = imageCanvas.getContext('2d');
let frameCanvas = document.querySelector('canvas');
let frameContext = frameCanvas.getContext('2d');

let isDrawing = false;

// frameCanvas.width = window.innerWidth;
// frameCanvas.height = window.innerHeight;
frameCanvas.width = 960;
frameCanvas.height = 540;

imageCanvas.width = 0;
imageCanvas.height = 0;

let frameX, frameY; // window in image
let mouseX, mouseY; // mouse in window
let padding = 10; // image canvas padding

let frameRect = frameCanvas.getBoundingClientRect();

function setMousePosition(e) {
    mouseX = e.clientX - frameRect.left;
    mouseY = e.clientY - frameRect.top;
}

frameCanvas.addEventListener('mousedown', e => {
    if (e.button != 0) return; // left click only
    
    setMousePosition(e);
    
    if (imageCanvas.width == 0 && imageCanvas.height == 0) {
        imageCanvas.width = padding * 2 + 1;
        imageCanvas.height = padding * 2 + 1;
        frameX = -mouseX + padding;
        frameY = -mouseY + padding;
    }
    
    imageContext.beginPath();
    imageContext.moveTo(frameX + mouseX, frameY + mouseY);
    
    isDrawing = true;
});

frameCanvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    
    setMousePosition(e);
    
    let dw, dh;
    
    if ((dw = mouseX - imageCanvas.width + padding + frameX) > 0) { // right
    } else if ((dw = mouseX + frameX - padding) < 0) { // left
        frameX -= dw;
    } else { // between
        dw = 0;
    }
    
    if ((dh = mouseY - imageCanvas.height + padding + frameY) > 0) { // below
    } else if ((dh = mouseY + frameY - padding) < 0) { // above
        frameY -= dh;
    } else { // between
        dh = 0;
    }
    
    if (dw || dh) { // resize
        let data = imageContext.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        imageCanvas.width += dw > 0 ? dw : -dw;
        imageCanvas.height += dh > 0 ? dh : -dh;
        imageContext.putImageData(data, dw < 0 ? -dw : 0, dh < 0 ? -dh : 0);
    }
    
    imageContext.lineTo(frameX + mouseX, frameY + mouseY);
    imageContext.stroke();
    
    let data = imageContext.getImageData(frameX, frameY, frameCanvas.width, frameCanvas.height);
    frameContext.putImageData(data, 0, 0);
});

frameCanvas.addEventListener('mouseup', e => {
    if (e.button != 0) return; // left click only
    
    isDrawing = false;
});

document.addEventListener('mousemove', e => {
    debugInfo.innerHTML = `
        mouseX: ${mouseX}<br>
        mouseY: ${mouseY}<br>
        windowX: ${frameX}<br>
        windowY: ${frameY}<br>
        imageCanvas.width: ${imageCanvas.width}<br>
        imageCanvas.height: ${imageCanvas.height}<br>
    `;
});

document.body.appendChild(imageCanvas);