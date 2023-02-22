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

const paper = document.getElementById('paper');
const context = paper.getContext('2d');
paper.width = 10000;
paper.height = 10000;
context.lineWidth = 1;
context.lineCap = 'round';
context.lineJoin = 'round';

const body = document.body;

/** {@link setTransform} */
let scale = window.innerWidth / paper.width;
let initScale = scale;
let translateX = 0, translateY = 0;

let oldClientX = window.innerWidth / 2, oldClientY = paper.height * scale / 2;
let mouseX = paper.width / 2, mouseY = paper.height / 2; // mouse in image

const record = [];
let points = [], redo = [];

let exceedPaper = true;

/**
 * 0: nothing  
 * 1: drawing  
 * 2: moving  
 * 3: zooming  
 */
let action = 0;
const ACTION_TEXT = ['nothing', 'drawing', 'moving', 'zooming'];

setTransform();

/** @param {MouseEvent} e */
function setMouse(e) {
    mouseX = (e.clientX - translateX) / scale;
    mouseY = (e.clientY - translateY) / scale;
}

function setTransform() {
    if (!exceedPaper) {
        if (scale < initScale) scale = initScale;
        if (translateX > 0) translateX = 0;
    }
    paper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

function refresh() {
    context.clearRect(0, 0, paper.width, paper.height);
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
    scale *= e.deltaY < 0 ? 1.25 : 0.8;
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
    
    if (action === 0) {
        if (e.altKey && e.button === 0 || e.button === 1) {
            action = 2; // moving
        } else if (e.ctrlKey && e.button === 0) {
            action = 3; // zooming
        } else if (e.button === 0) {
            action = 1; // drawing
        }
    }
    
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
    action = 0;
});

document.addEventListener('mousemove', e => {
    setMouse(e);
    
    switch (action) {
    case 1: // draw
        points.push({
            x: mouseX,
            y: mouseY
        });
        refresh();
        break;
    case 2: // move
        translateX += e.clientX - oldClientX;
        translateY += e.clientY - oldClientY;
        setTransform();
        break;
    case 3: // zoom
        mouseZoom(e);
        break;
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
    if (e.code === 'KeyL') {
        exceedPaper = !exceedPaper;
        setTransform();
    }
});

document.addEventListener('wheel', e => {
    e.preventDefault();
    wheelZoom(e);
}, { passive: false });



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
        scale: ${scale}<br>
        translateX: ${translateX}<br>
        translateY: ${translateY}<br>
        points.length ${points.length}<br>
        record.length: ${record.length}<br>
        redo.length: ${redo.length}<br>
        action: ${ACTION_TEXT[action]}<br>
        transform: ${paper.style.transform}<br>
        top: ${paper.offsetTop}
    `;
}

document.addEventListener('mousemove', updateDebugInfo);
document.addEventListener('wheel', updateDebugInfo);