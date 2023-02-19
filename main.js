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

let image = document.getElementById('image');
let context = image.getContext('2d');
image.width = 1920;
image.height = 1080;
context.lineWidth = 3;
context.lineCap = 'round';
context.lineJoin = 'round';

let body = document.body;

let scale = image.width / window.innerWidth;
let imageStyleWidth = window.innerWidth;
image.style.width = imageStyleWidth + 'px';

let translateX = 0, translateY = 0;

let oldClientX, oldClientY;
let mouseX, mouseY; // mouse in image

/** @param {MouseEvent} e */
function setMousePosition(e) {
    mouseX = (e.clientX - translateX) * scale;
    mouseY = (e.clientY - translateY) * scale;
}

function setTransform() {
    image.style.transform = `translate(${translateX}, ${translateY}) scale(${scale})`;
}

function draw() {
    context.lineTo(mouseX, mouseY);
    context.stroke();
}

/** @param {MouseEvent} e */
function move(e) {
    translateX += e.clientX - oldClientX;
    translateY += e.clientY - oldClientY;
    image.style.left = translateX + 'px';
    image.style.top = translateY + 'px';
}

/**
 * @param {WheelEvent} e
 * 
 * formula: {@link setMousePosition}
 * ```math
 * m = mouse, c = client, o = image.offset, s = scale
 * m = (c - o) * s
 * o = c - m / s
 * ```
 */
function wheelZoom(e) {
    scale *= e.deltaY < 0 ? 0.8 : 1.25; // zoom in : out\
    imageStyleWidth = image.width / scale;
    translateX = e.clientX - mouseX / scale;
    translateY = e.clientY - mouseY / scale;
    image.style.width = imageStyleWidth + 'px';
    image.style.left = translateX + 'px';
    image.style.top = translateY + 'px';
}

/**
 * @param {MouseEvent} e
 * 
 * fix at center
 */
function mouseZoom(e) {
    let rate = 1.005 ** (oldClientY - e.clientY);
    translateX += (1 - rate) * (window.innerWidth / 2 - translateX);
    translateY += (1 - rate) * (window.innerHeight / 2 - translateY);
    scale /= rate;
    imageStyleWidth = image.width / scale;
    image.style.width = imageStyleWidth + 'px';
    image.style.left = translateX + 'px';
    image.style.top = translateY + 'px';
}

document.addEventListener('mousedown', e => {
    if (e.button == 1) e.preventDefault();
    
    if (e.button == 0) {
        context.beginPath();
        context.moveTo(mouseX, mouseY);
    }
});

document.addEventListener('mouseup', e => {
});

document.addEventListener('mousemove', e => {
    setMousePosition(e);
    
    if (e.buttons & 4 || (e.altKey && e.buttons & 1)) { // middle or ctrl+left
        move(e);
    } else if (e.ctrlKey && e.buttons & 1) { // ctrl+left
        mouseZoom(e);
    } else if (e.buttons & 1) { // left
        draw();
    }
    
    oldClientX = e.clientX;
    oldClientY = e.clientY;
});

document.addEventListener('keydown', e => {
});

document.addEventListener('keyup', e => {
});

document.addEventListener('wheel', e => {
    e.preventDefault();
    wheelZoom(e);
}, { passive: false });



// debug
let debugInfo = document.getElementById('debug');

function updateDebugInfo(e) {
    debugInfo.innerHTML = `
        clientX: ${e.clientX}<br>
        clientY: ${e.clientY}<br>
        mouseX: ${mouseX}<br>
        mouseY: ${mouseY}<br>
        image.offsetLeft: ${image.offsetLeft}<br>
        image.offsetTop: ${image.offsetTop}<br>
        scale: ${scale}<br>
        imageStyleWidth: ${imageStyleWidth}<br>
        imageStyleLeft: ${translateX}<br>
        imageStyleTop: ${translateY}<br>
        window.innerWidth: ${window.innerWidth / 2}<br>
        top left to center: ${window.innerWidth / 2 - translateX}<br>
    `;
}

document.addEventListener('mousemove', updateDebugInfo);
document.addEventListener('wheel', updateDebugInfo);