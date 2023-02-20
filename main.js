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

const image = document.getElementById('image');
const context = image.getContext('2d');
image.width = 1920;
image.height = 1080;
context.lineWidth = 3;
context.lineCap = 'round';
context.lineJoin = 'round';

const body = document.body;

/** {@link setTransform} */
let scale = window.innerWidth / image.width;
let translateX = 0, translateY = 0;

let oldClientX = window.innerWidth / 2, oldClientY = image.height * scale / 2;
let mouseX = image.width / 2, mouseY = image.height / 2; // mouse in image

const record = [];
let points = [], redo = [];

setTransform();

/** @param {MouseEvent} e */
function setMouse(e) {
    mouseX = (e.clientX - translateX) / scale;
    mouseY = (e.clientY - translateY) / scale;
}

function setTransform() {
    image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

function refresh() {
    context.clearRect(0, 0, image.width, image.height);
    context.beginPath();
    for (let command of record) {
        context.moveTo(command[0].x, command[0].y);
        for (let point of command) {
            context.lineTo(point.x, point.y);
        }
    }
    context.stroke();
}

/**
 * @param {WheelEvent} e
 * 
 * formula: {@link setMouse}
 * ```math
 * m = mouse, c = client, o = image.offset, s = scale
 * m = (c - o) * s
 * o = c - m / s
 * ```
 */
function wheelZoom(e) {
    scale *= e.deltaY < 0 ? 1.25 : 0.8; // zoom in : out\
    translateX = e.clientX - mouseX * scale;
    translateY = e.clientY - mouseY * scale;
    setTransform();
}

/**
 * @param {MouseEvent} e
 * 
 * fix at center
 */
function mouseZoom(e) {
    let rate = 1.005 ** (oldClientY - e.clientY);
    translateX += (rate - 1) * (window.innerWidth / 2 - translateX);
    translateY += (rate - 1) * (window.innerHeight / 2 - translateY);
    scale /= rate;
    setTransform();
}

document.addEventListener('mousedown', e => {
    if (e.button === 1) e.preventDefault();
    
    if (e.button === 0) {
        points = [];
        record.push(points);
        redo = [];
        points.push({
            x: mouseX,
            y: mouseY
        });
    }
});

document.addEventListener('mouseup', e => {
});

document.addEventListener('mousemove', e => {
    setMouse(e);
    
    if (e.buttons & 4 || (e.altKey && e.buttons & 1)) { // middle or ctrl+left
        // drag
        translateX += e.clientX - oldClientX;
        translateY += e.clientY - oldClientY;
        setTransform();
    } else if (e.ctrlKey && e.buttons & 1) { // ctrl+left
        // zoom
        mouseZoom(e);
    } else if (e.buttons & 1) { // left
        // draw
        points.push({
            x: mouseX,
            y: mouseY
        });
        refresh();
    }
    
    oldClientX = e.clientX;
    oldClientY = e.clientY;
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code === 'KeyZ') {
        if (e.shiftKey) {
            if (redo.length) record.push(redo.pop());
        } else {
            if (record.length) redo.push(record.pop());
        }
        refresh();
    }
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
        scale: ${scale}<br>
        translateX: ${translateX}<br>
        translateY: ${translateY}<br>
        points.length ${points.length}<br>
        record.length: ${record.length}<br>
        redo.length: ${redo.length}<br>
    `;
}

document.addEventListener('mousemove', updateDebugInfo);
document.addEventListener('wheel', updateDebugInfo);