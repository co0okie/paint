/** features
 * pen/erase
 * line width
 * color
 * zoom
 * move/center
 * undo/redo
 * save/load
 * select
 * cut/copy/paste
 * expand
 */

let imageCanvas = document.createElement('canvas');
let imageContext = imageCanvas.getContext('2d');
imageCanvas.width = 1920;
imageCanvas.height = 1080;
imageContext.lineWidth = 3;
imageContext.lineCap = 'round';
imageContext.lineJoin = 'round';

let frameCanvas = document.querySelector('canvas');
let frameContext = frameCanvas.getContext('2d');
frameCanvas.width = window.innerWidth;
frameCanvas.height = window.innerHeight;

let scale =  imageCanvas.width / frameCanvas.width;

let mousePressing = [false, false, false]; // left, wheel, right

let frameX = 0, frameY = 0; // frame in image
let oldPageX, oldPageY;
let mouseX, mouseY; // mouse in image

print();

/**
 * @param {Event} e
 */
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

function draw() {
    imageContext.lineTo(mouseX, mouseY);
    imageContext.stroke();
    print();
}

/**
 * @param {Event} e
 */
function move(e) {
    frameX += (oldPageX - e.pageX) * scale;
    frameY += (oldPageY - e.pageY) * scale;
    print();
}

/**
 * @param {Event} e
 * 
 * formula: {@link setMousePosition}
 * ```math
 * m = mouse, p = page, f = frame, s = scale  
 * m = p * s + f  
 * f = m - p * s
 * ```
 */
function wheelZoom(e) {
    scale *= e.deltaY < 0 ? 0.8 : 1.25; // zoom in : out
    frameX = mouseX - e.pageX * scale;
    frameY = mouseY - e.pageY * scale;
    print();
}

/**
 * @param {Event} e 
 * 
 * fix at center
 */
function mouseZoom(e) {
    let rate = Math.pow(1.005, oldPageY - e.pageY);
    frameX += frameCanvas.width / 2 * scale * (1 - rate);
    frameY += frameCanvas.height / 2 * scale * (1 - rate);
    scale *= rate;
    print();
}

document.addEventListener('mousedown', e => {
    if (e.button == 1) e.preventDefault();
    
    if (e.button == 0) {
        imageContext.beginPath();
        imageContext.moveTo(mouseX, mouseY);
    }
    
    mousePressing[e.button] = true;
});

document.addEventListener('mousemove', e => {
    setMousePosition(e);
    
    if (mousePressing[1] || (e.altKey && mousePressing[0])) {
        move(e);
    } else if (e.ctrlKey && mousePressing[0]) {
        mouseZoom(e);
    } else if (mousePressing[0]) {
        draw();
    }
    
    oldPageX = e.pageX;
    oldPageY = e.pageY;
});

document.addEventListener('mouseup', e => {
    mousePressing[e.button] = false;
});

document.addEventListener('keydown', e => {
    
});

document.addEventListener('keyup', e => {
    
});

frameCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    
    wheelZoom(e);
});

window.addEventListener('resize', () => {
    frameCanvas.width = window.innerWidth;
    frameCanvas.height = window.innerHeight;
    print();
});



// debug
let debugInfo = document.getElementById('debug');

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