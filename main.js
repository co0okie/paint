let debugInfo = document.getElementById('debug');

let imageCanvas = document.createElement('canvas');
let imageContext = imageCanvas.getContext('2d');
let windowCanvas = document.querySelector('canvas');
let windowContext = windowCanvas.getContext('2d');

let isDrawing = false;

// windowCanvas.width = window.innerWidth;
// windowCanvas.height = window.innerHeight;
windowCanvas.width = 960;
windowCanvas.height = 540;

imageCanvas.width = 1;
imageCanvas.height = 1;

let windowX, windowY; // window in image
let mouseX, mouseY; // mouse in window

let windowRect = windowCanvas.getBoundingClientRect();

function setMousePosition(e) {
    mouseX = e.clientX - windowRect.left;
    mouseY = e.clientY - windowRect.top;
}

windowCanvas.addEventListener('mousedown', e => {
    if (e.button != 0) return; // left click only
    
    setMousePosition(e);
    
    isDrawing = true;
    
    if (imageCanvas.width == 1 && imageCanvas.height == 1) {
        windowX = -mouseX;
        windowY = -mouseY;
    }
    
    imageContext.beginPath();
    imageContext.moveTo(windowX + mouseX, windowY + mouseY);
});

windowCanvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    
    setMousePosition(e);
    
    let gap, dw = 0, dh = 0, offsetX = 0, offsetY = 0;
    
    if (gap = mouseX - imageCanvas.width + windowX > 0) { // right
        dw = gap;
    } else if (gap = mouseX + windowX < 0) { // left
        dw = gap;
        offsetX = dw;
        windowX = -mouseX;
    }
    
    if (gap = mouseY - imageCanvas.height + windowY > 0) { // below
        dh = gap;
    } else if (gap = mouseY + windowY < 0) { // above
        dh = gap;
        offsetY = dh;
        windowY = -mouseY;
    }
    
    if (dw || dh) { // resize
        let data = imageContext.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        imageCanvas.width += dw;
        imageCanvas.height += dh;
        imageContext.putImageData(data, offsetX, offsetY);
    }
    
    imageContext.lineTo(mouseX, mouseY);
    imageContext.stroke();
    
    windowContext.clearRect(0, 0, windowCanvas.width, windowCanvas.height);
    windowContext.beginPath();
    windowContext.arc(-windowX, -windowY, 5, 0, 2 * Math.PI);
    windowContext.arc(-windowX + imageCanvas.width, -windowY + imageCanvas.height, 5, 0, 2 * Math.PI);
    windowContext.fill();
});

windowCanvas.addEventListener('mouseup', e => {
    if (e.button != 0) return; // left click only
    
    isDrawing = false;
});

document.addEventListener('mousemove', e => {
    debugInfo.innerHTML = `
        mouseX: ${mouseX}<br>
        mouseY: ${mouseY}<br>
        windowX: ${windowX}<br>
        windowY: ${windowY}<br>
        imageCanvas.width: ${imageCanvas.width}<br>
        imageCanvas.height: ${imageCanvas.height}<br>
    `;
});

document.body.appendChild(imageCanvas);