'use strict'

const DEBUG = 1;

/*
mode:
    Space: select
    Z: pen
    X: eraser
    C: shape(rectangle/ellipse/triangle)
    V: flood fill

action:
    wheel: zoom
    ctrl + Z: undo
    ctrl + shift + Z: redo
    
setting:
    A + wheel: width
    S + ?: color
*/

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{left: number, right: number, top: number, bottom: number}} Bound
 * @typedef {{path: Point[], bound: Bound}} Command
 */

// mode
/** @enum {number} */
const MODE = Object.freeze({
    PEN: 1,
    ERASER: 2,
    SHAPE: 3,
    FLOOD_FILL: 4
})
/** @type {MODE} */
let mode = MODE.PEN;
const pen = {
    lineWidth: 3,
    strokeStyle: 'white',
}

/** O = window top left, screen coordinate
 * @type {Point}
 */
const anchor = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
};

// anchor coordinate * scaleRate = screen cooridinate
let scaleRate = 1;

/** @type {HTMLCanvasElement} */
let canvas = document.getElementById('main');
canvas.width = 0;
canvas.height = 0;
if (DEBUG) canvas.style.backgroundColor = '#222';

/** anchor coordinate
 * @type {Bound | null}
 */
let canvasBound = null;

/** @type {CanvasRenderingContext2D} */
let context = canvas.getContext('2d');
context.lineWidth = 3;
context.lineCap = 'round';
context.lineJoin = 'round';
context.strokeStyle = 'white';
context.fillStyle = 'white';

/** @type {HTMLCanvasElement} */
const screenCanvas = document.getElementById('screen');
screenCanvas.width = window.innerWidth;
screenCanvas.height = window.innerHeight;
screenCanvas.style.width = `${window.innerWidth}px`;
screenCanvas.style.height = `${window.innerHeight}px`;
screenCanvas.style.left = '0px';
screenCanvas.style.top = '0px';

/** anchor coordinate
 * @type {Bound}
 */
let screenCanvasBound = {left: -Math.ceil(anchor.x), top: -Math.ceil(anchor.y)};

/** @type {CanvasRenderingContext2D} */
const screenContext = screenCanvas.getContext('2d');
screenContext.lineWidth = context.lineWidth;
screenContext.strokeStyle = DEBUG ? 'cyan' : context.strokeStyle;
screenContext.fillStyle = DEBUG ? 'cyan' : context.fillStyle;
screenContext.lineCap = 'round';
screenContext.lineJoin = 'round';
screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);

/** @type {Command[]} */
const undoStack = [];

/** @type {Command[]} */
const redoStack = [];


// add e.clientX/Y relative to anchor
for (const type of ['mousemove', 'mousedown']) {
    document.addEventListener(type, e => {
        // screen coordinte => anchor coordinate
        e.anchorX = (e.clientX - anchor.x) / scaleRate;
        e.anchorY = (e.clientY - anchor.y) / scaleRate;
    })
}

// cast 'newaction' event if click, scroll, press any key or resize 
for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'wheel', 'mouseleave']) {
    document.addEventListener(type, e => {
        if (e.repeat) return; // prevent long press repeated fire
        document.dispatchEvent(new CustomEvent('newaction'));
    });
}
document.addEventListener('keyup', e => {
});
window.addEventListener('resize', e => document.dispatchEvent(new CustomEvent('newaction')));
window.addEventListener('wheel', e => e.preventDefault(), { passive: false })


////////// action recognition //////////
document.addEventListener('mousemove', e => {
    // setCursorPosition(e);
});

document.addEventListener('mousedown', e => {
    if (e.button === 0 && !e.altKey) onDrawStart(e);
    if (e.button === 1) onDragStart(e);
    if (e.button === 0 && e.altKey) onDragStart(e);
});

document.addEventListener('wheel', e => {
    // rate ** -e.deltaY
    if (DEBUG > 1) console.log(e.deltaY);
    // f(x) = a^-bx
    if (e.deltaY) scale(100 ** (-0.0005 * e.deltaY), e.clientX, e.clientY);
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code === 'KeyZ') e.shiftKey ? redo() : undo();
    if (e.code === 'KeyE') {
        mode = MODE.ERASER;
        context.globalCompositeOperation = 'destination-out';
    }
    if (e.code === 'KeyP') {
        mode = MODE.PEN;
        context.globalCompositeOperation = 'source-over';
    }
});

document.addEventListener('keyup', e => {
});

window.addEventListener('resize', e => {
    screenCanvas.width = Math.ceil(window.innerWidth / scaleRate) + 1;
    screenCanvas.height = Math.ceil(window.innerHeight / scaleRate) + 1;
    screenCanvas.style.width = `${screenCanvas.width * scaleRate}px`;
    screenCanvas.style.height = `${screenCanvas.height * scaleRate}px`;
    let blockCountX = anchor.x / scaleRate;
    let blockCountY = anchor.y / scaleRate;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * scaleRate}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * scaleRate}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
    screenContext.lineWidth = context.lineWidth;
    screenContext.strokeStyle = DEBUG ? 'cyan' : context.strokeStyle;
    screenContext.fillStyle = DEBUG ? 'cyan' : context.fillStyle;
    screenContext.lineCap = 'round';
    screenContext.lineJoin = 'round';
});

////////// action handler //////////
/** @type {(e: MouseEvent) => void} */
function onDrawStart(e) {
    const bound = {
        left: Math.floor(e.anchorX), right: Math.ceil(e.anchorX),
        top: Math.floor(e.anchorY), bottom: Math.ceil(e.anchorY)
    };
    
    const path = [{x: e.anchorX, y: e.anchorY}];
    
    function refresh() {
        screenContext.clearRect(
            screenCanvasBound.left, screenCanvasBound.top,
            screenCanvas.width, screenCanvas.height
        );
        
        screenContext.beginPath();
        screenContext.moveTo(path[0].x, path[0].y);
        for (const point of path) {
            screenContext.lineTo(point.x, point.y);
        }
        screenContext.stroke();
    }
    
    refresh();
    
    function onDraw(e) {
        const dx = e.anchorX - path.at(-1).x;
        const dy = e.anchorY - path.at(-1).y;
        if (dx * dx + dy * dy < 3) return;
        
        refresh();
        
        if (e.anchorX < bound.left) bound.left = Math.floor(e.anchorX);
        else if (e.anchorX > bound.right) bound.right = Math.ceil(e.anchorX);
        if (e.anchorY < bound.top) bound.top = Math.floor(e.anchorY);
        else if (e.anchorY > bound.bottom) bound.bottom = Math.ceil(e.anchorY);
        
        path.push({x: e.anchorX, y: e.anchorY});
    }
    
    document.addEventListener('mousemove', onDraw);
    
    document.addEventListener('newaction', e => {
        document.removeEventListener('mousemove', onDraw);
        
        // bound: bound of path
        // undoStack[n].bound: bound of canvas
        boundUnion(bound);
        undoStack.push({path: path, bound: canvasBound});
        doUndoStack();
        redoStack.length = 0;
        
        screenContext.clearRect(
            screenCanvasBound.left, screenCanvasBound.top,
            screenCanvas.width, screenCanvas.height
        );
    }, { once: true });
}

/** @type {(e: MouseEvent) => void} */
function onEraseStart(e) {
    const path = [{x: e.anchorX, y: e.anchorY}];
    
    screenContext.globalCompositeOperation = 'destination-out';
}

/** @type {(e: MouseEvent) => void} */
function onDragStart(e) {
    const onDrag = e => translate(e.movementX, e.movementY);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => document.removeEventListener('mousemove', onDrag), { once: true });
}


/** change canvas.width & canvas.height while keeping context
 * @type {(width: number, height: number) => void}
 */
function resize(width, height) {
    let lineWidth   = context.lineWidth  ;
    let lineCap     = context.lineCap    ;
    let lineJoin    = context.lineJoin   ;
    let strokeStyle = context.strokeStyle;
    let fillStyle   = context.fillStyle  ;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width  = `${canvas.width  * scaleRate}px`;
    canvas.style.height = `${canvas.height * scaleRate}px`;
    
    context.lineWidth   = lineWidth  ;
    context.lineCap     = lineCap    ;
    context.lineJoin    = lineJoin   ;
    context.strokeStyle = strokeStyle;
    context.fillStyle   = fillStyle  ;
    
    if (canvasBound === null) return;
    
    canvas.style.left = `${anchor.x + canvasBound.left * scaleRate}px`;
    canvas.style.top  = `${anchor.y + canvasBound.top  * scaleRate}px`;
    
    context.translate(-canvasBound.left, -canvasBound.top);
}

// do all commands in undo stack
function doUndoStack() {
    context.beginPath();
    for (let step of undoStack) {
        context.moveTo(step.path[0].x, step.path[0].y);
        for (let point of step.path) context.lineTo(point.x, point.y);
    }
    context.stroke();
}

// screen coordinte => anchor coordinate
function toAnchor(x, y) {
    return {x: (x - anchor.x) / scaleRate, y: (y - anchor.y) / scaleRate};
}

// 
/** canvasBound = union of canvasBound and bound, will clear canvas
 * @type {(bound: Bound) => void}
 */
function boundUnion(bound) {
    // first draw
    if (canvasBound === null) {
        canvasBound = bound;
        resize(canvasBound.right - canvasBound.left, canvasBound.bottom - canvasBound.top);
    }
    // out of bounds
    else if (bound.left < canvasBound.left || bound.right  > canvasBound.right ||
             bound.top  < canvasBound.top  || bound.bottom > canvasBound.bottom) {
        canvasBound = { // keep old canvasBound reference
            left  : Math.min(bound.left  , canvasBound.left  ),
            right : Math.max(bound.right , canvasBound.right ),
            top   : Math.min(bound.top   , canvasBound.top   ),
            bottom: Math.max(bound.bottom, canvasBound.bottom)
        };
        resize(canvasBound.right - canvasBound.left, canvasBound.bottom - canvasBound.top);
    } else {
        context.clearRect(canvasBound.left, canvasBound.top, canvas.width, canvas.height);
    }
}

// anchor coordinate
function draw(path, bound) {
    
}

/** screen coordinate
 * @type {(dx: number, dy: number) => void}
 */
function translate(dx, dy) {
    anchor.x += dx;
    anchor.y += dy;
    if (canvasBound !== null) {
        canvas.style.left = `${anchor.x + canvasBound.left * scaleRate}px`;
        canvas.style.top = `${anchor.y + canvasBound.top * scaleRate}px`;
    }
    
    let blockCountX = anchor.x / scaleRate;
    let blockCountY = anchor.y / scaleRate;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * scaleRate}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * scaleRate}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
}

/** screen coordinate
 * @type {(rate: number, x: number, y: number) => void}
 */
function scale(rate, x, y) {
    const newScaleRate = scaleRate * rate;
    if (newScaleRate < 0.2 || newScaleRate > 500) return;
    scaleRate = newScaleRate;
    anchor.x = x + rate * (anchor.x - x);
    anchor.y = y + rate * (anchor.y - y);
    if (canvasBound !== null) {
        canvas.style.left = `${anchor.x + canvasBound.left * scaleRate}px`;
        canvas.style.top  = `${anchor.y + canvasBound.top  * scaleRate}px`;
        canvas.style.width = `${canvas.width * scaleRate}px`;
        canvas.style.height = `${canvas.height * scaleRate}px`;
    }
    
    screenCanvas.width = Math.ceil(window.innerWidth / scaleRate) + 1;
    screenCanvas.height = Math.ceil(window.innerHeight / scaleRate) + 1;
    screenCanvas.style.width = `${screenCanvas.width * scaleRate}px`;
    screenCanvas.style.height = `${screenCanvas.height * scaleRate}px`;
    let blockCountX = anchor.x / scaleRate;
    let blockCountY = anchor.y / scaleRate;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * scaleRate}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * scaleRate}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
    screenContext.lineWidth = context.lineWidth;
    screenContext.strokeStyle = DEBUG ? 'cyan' : context.strokeStyle;
    screenContext.fillStyle = DEBUG ? 'cyan' : context.fillStyle;
    screenContext.lineCap = 'round';
    screenContext.lineJoin = 'round';
}

function undo() {
    if (undoStack.length === 0) return;
    
    redoStack.push(undoStack.pop());
    
    if (undoStack.length === 0) {
        // reset canvas
        canvasBound = null;
        resize(0, 0);
        return;
    }
    
    const bound = undoStack.at(-1).bound;
    if (bound !== canvasBound) {
        canvasBound = bound;
        resize(bound.right - bound.left, bound.bottom - bound.top);
    } else {
        context.clearRect(bound.left, bound.top, canvas.width, canvas.height);
    }
    
    doUndoStack();
}

function redo() {
    if (redoStack.length === 0) return;
    
    const command = redoStack.pop();
    canvasBound = command.bound;
    resize(canvasBound.right - canvasBound.left, canvasBound.bottom - canvasBound.top);
    undoStack.push(command);
    doUndoStack();
}

if (DEBUG) { // debug
    const debugInfo = document.getElementById('debug');
    
    const anchorPoint = document.createElement('div');
    anchorPoint.style.backgroundColor = 'red';
    anchorPoint.style.position = 'fixed';
    anchorPoint.style.width = '10px';
    anchorPoint.style.height = '10px';
    anchorPoint.style.borderRadius = '50%';
    anchorPoint.style.translate = '-50% -50%';
    document.body.appendChild(anchorPoint);
    
    function updateDebugInfo(e) {
        anchorPoint.style.left = `${anchor.x}px`;
        anchorPoint.style.top = `${anchor.y}px`;
        debugInfo.innerHTML = `
            e.clientX: ${e.clientX}<br>
            e.clientY: ${e.clientY}<br>
            e.anchorX: ${e.anchorX}<br>
            e.anchorY: ${e.anchorY}<br>
            anchor.x: ${anchor.x}<br>
            anchor.y: ${anchor.y}<br>
            scaleRate: ${scaleRate}<br>
            canvas.width: ${canvas.width}<br>
            canvas.height: ${canvas.height}<br>
            canvas.offsetWidth: ${canvas.offsetWidth}<br>
            canvas.offsetHeight: ${canvas.offsetHeight}<br>
            canvas.offsetLeft: ${canvas.offsetLeft}<br>
            canvas.offsetTop: ${canvas.offsetTop}<br>
            canvasBound.left: ${canvasBound?.left}<br>
            canvasBound.right: ${canvasBound?.right}<br>
            canvasBound.top: ${canvasBound?.top}<br>
            canvasBound.bottom: ${canvasBound?.bottom}<br>
            screenCanvas.width: ${screenCanvas.width}<br>
            screenCanvas.height: ${screenCanvas.height}<br>
            screenCanvas.offsetWidth: ${screenCanvas.offsetWidth}<br>
            screenCanvas.offsetHeight: ${screenCanvas.offsetHeight}<br>
            screenCanvas.offsetLeft: ${screenCanvas.offsetLeft}<br>
            screenCanvas.offsetTop: ${screenCanvas.offsetTop}<br>
            screenCanvasBound.left: ${screenCanvasBound.left}<br>
            screenCanvasBound.top: ${screenCanvasBound.top}<br>
            window.innerWidth: ${window.innerWidth}<br>
            window.innerHeight: ${window.innerHeight}<br>
            undoStack.length: ${undoStack.length}<br>
            undoStack.at(-1).path.length: ${undoStack.at(-1)?.path.length}<br>
            redoStack.length: ${redoStack.length}<br>
        `;
    }
    
    for (let type of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) {
        document.addEventListener(type, updateDebugInfo);
    }
}