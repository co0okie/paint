let debugInfo = document.getElementById('debug');

let imageCanvas = document.createElement('canvas');
let imageContext = imageCanvas.getContext('2d');
let frameCanvas = document.querySelector('canvas');
let frameContext = frameCanvas.getContext('2d');

frameCanvas.width = window.innerWidth;
frameCanvas.height = window.innerHeight;

imageCanvas.width = 1920;
imageCanvas.height = 1080;

let scale =  imageCanvas.width / frameCanvas.width;

imageContext.lineWidth = 3;
imageContext.lineCap = 'round';
imageContext.lineJoin = 'round';

let drawing = false, moving = false;

let frameX = 0, frameY = 0; // frame in image
let oldPageX, oldPageY;
let mouseX, mouseY; // mouse in image

print();

function setMousePosition(e) {
    mouseX = e.pageX * scale + frameX;
    mouseY = e.pageY * scale + frameY;
}

function print() {
    frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
    frameContext.fillStyle = '#00000008';
    frameContext.fillRect(-frameX / scale, -frameY / scale, imageCanvas.width / scale, imageCanvas.height / scale);
    frameContext.drawImage(imageCanvas,
        frameX, frameY, frameCanvas.width * scale, frameCanvas.height * scale,
        0, 0, frameCanvas.width, frameCanvas.height
    );
}

function startDraw(e) {
    imageContext.beginPath();
    imageContext.moveTo(mouseX, mouseY);
    
    drawing = true;
}

function draw(e) {
    imageContext.lineTo(mouseX, mouseY);
    imageContext.stroke();
    
    print();
}

function move(e) {
    frameX += (oldPageX - e.pageX) * scale;
    frameY += (oldPageY - e.pageY) * scale;
    
    print();
}

document.addEventListener('mousedown', e => {
    switch (e.button) {
        case 0: // left click
            startDraw(e);
            break;
        case 1: // wheel click
            e.preventDefault();
            moving = true;
            break;
    }
});

document.addEventListener('mousemove', e => {
    setMousePosition(e);
    if (moving) move(e);
    else if (drawing) draw(e);
    oldPageX = e.pageX;
    oldPageY = e.pageY;
});

document.addEventListener('mouseup', e => {
    switch (e.button) {
        case 0: // left click
            drawing = false;
            break;
        case 1: // wheel click
            moving = false;
            break;
    }
});

frameCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    
    /**
     * m = mouse, p = page, f = frame, s = scale, r = rate
     * m = p * s + f
     * f = m - p * s
     * f' = f + m - p * r * s - f
     *    = f += m - p * r * s - m + p * s
     *    = f += p * s * (1 - r)
     */
    
    let rate = e.deltaY < 0 ? 0.8 : 1.25; // zoom in : out
    frameX += e.pageX * scale * (1 - rate);
    frameY += e.pageY * scale * (1 - rate);
    scale *= rate;
    
    print();
});

// debug
function updateDebugInfo(e) {
    debugInfo.innerHTML = `
        pageX: ${e.pageX}<br>
        pageY: ${e.pageY}<br>
        clientX: ${e.clientX}<br>
        clientY: ${e.clientY}<br>
        mouseX: ${mouseX}<br>
        mouseY: ${mouseY}<br>
        frameX: ${frameX}<br>
        frameY: ${frameY}<br>
        scale: ${scale}<br>
    `;
}

// document.addEventListener('mousemove', updateDebugInfo);
// document.addEventListener('wheel', updateDebugInfo);

// document.body.appendChild(imageCanvas);