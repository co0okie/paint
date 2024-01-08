'use strict'

const DEBUG = 1;

/*
mode:
    Space: select
    Z: pen
    X: eraser
    C: shape(rectangle/ellipse/triangle)
    V: flood fill

action (instant):
    wheel: zoom
    ctrl + Z: undo
    ctrl + shift + Z: redo

action (pressed):
    left button: main function
    wheel button: drag
    W/A/S/D: move canvas up/right/down/left
    Q/E: zoom in/out at mouse position
    
setting:
    F + wheel: width
    G + ?: color
*/

////////// mode //////////
/** @enum {number} */
const MODE = Object.freeze({
    PEN: 10,
    ERASER: 20,
    SHAPE_RECTANGLE: 30,
    SHAPE_ELLIPSE: 31,
    SHAPE_TRIANGLE: 32,
    FLOOD_FILL: 40
})


////////// action //////////
/** @enum {number} */
const ACTION = Object.freeze({
    NOTHING: 0,
    DRAGING: 1,
    TRANSLATING: 2,
    ZOOMING: 3,
    DRAWING: 10,
    ERASING: 20,
    SELECTING_SHAPE: 30,
    HELP_PAGE: 100,
    PALETTE: 101,
    LINE_WIDTH: 102,
})

////////// status //////////
const state = {
    /** @type {MODE} */
    mode: MODE.PEN,
    /** @type {ACTION} */
    action: ACTION.NOTHING,
    lineWidth: 3,
    color: 'white',
    
    /** @type {MODE} */
    shape: MODE.SHAPE_RECTANGLE,
    
    // anchor coordinate * zoom = screen cooridinate
    zoom: 1,
    
    // screen coordinate
    anchorX: window.innerWidth / 2,
    anchorY: window.innerHeight / 2,
}

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{left: number, right: number, top: number, bottom: number}} Bound
 * @typedef {{path: Point[], bound: Bound}} Command
 */

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('main');
canvas.width = 0;
canvas.height = 0;
if (DEBUG) canvas.style.backgroundColor = '#222';

/** @type {Bound | null} anchor coordinate */
let canvasBound = null;

/** @type {CanvasRenderingContext2D} */
const context = canvas.getContext('2d');
context.lineWidth = 3;
context.lineCap = 'round';
context.lineJoin = 'round';
context.strokeStyle = state.color;
context.fillStyle = state.color;

/** @type {HTMLCanvasElement} */
const screenCanvas = document.getElementById('screen');
screenCanvas.width = window.innerWidth;
screenCanvas.height = window.innerHeight;
screenCanvas.style.width = `${window.innerWidth}px`;
screenCanvas.style.height = `${window.innerHeight}px`;
screenCanvas.style.left = '0px';
screenCanvas.style.top = '0px';

/** @type {Bound} anchor coordinate */
let screenCanvasBound = {left: -Math.ceil(state.anchorX), top: -Math.ceil(state.anchorY)};

/** @type {CanvasRenderingContext2D} */
const screenContext = screenCanvas.getContext('2d');
screenContext.lineWidth = context.lineWidth;
screenContext.strokeStyle = DEBUG ? 'cyan' : state.color;
screenContext.fillStyle = DEBUG ? 'cyan' : state.color;
screenContext.lineCap = 'round';
screenContext.lineJoin = 'round';
screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);

/** @type {Command[]} */
const undoStack = [];

/** @type {Command[]} */
const redoStack = [];


// calculate e.clientX/Y in anchor coordinate
let mouseAnchorX, mouseAnchorY;
for (const type of ['mousemove', 'mousedown']) {
    document.addEventListener(type, e => {
        // screen coordinte => anchor coordinate
        mouseAnchorX = (e.clientX - state.anchorX) / state.zoom;
        mouseAnchorY = (e.clientY - state.anchorY) / state.zoom;
    })
}

// cast 'newaction' event if click, scroll, press any key or resize
/** @typedef {{detail: KeyboardEvent | MouseEvent | WheelEvent | UIEvent}} NewActionEvent */
for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'wheel', 'mouseleave']) {
    document.addEventListener(type, e => {
        if (e.repeat) return; // prevent long press repeated fire
        document.dispatchEvent(new CustomEvent('newaction', { detail: e }));
    });
}
document.addEventListener('keyup', e => {
});
window.addEventListener('resize', e => document.dispatchEvent(new CustomEvent('newaction', { detail: e })));
window.addEventListener('wheel', e => e.preventDefault(), { passive: false })


////////// action recognition //////////
document.addEventListener('mousemove', e => {
    
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
        state.mode = MODE.ERASER;
        context.globalCompositeOperation = 'destination-out';
    }
    if (e.code === 'KeyP') {
        state.mode = MODE.PEN;
        context.globalCompositeOperation = 'source-over';
    }
});

document.addEventListener('keyup', e => {
});

window.addEventListener('resize', e => {
    screenCanvas.width = Math.ceil(window.innerWidth / state.zoom) + 1;
    screenCanvas.height = Math.ceil(window.innerHeight / state.zoom) + 1;
    screenCanvas.style.width = `${screenCanvas.width * state.zoom}px`;
    screenCanvas.style.height = `${screenCanvas.height * state.zoom}px`;
    let blockCountX = state.anchorX / state.zoom;
    let blockCountY = state.anchorY / state.zoom;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * state.zoom}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * state.zoom}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
    screenContext.lineWidth = state.lineWidth;
    screenContext.strokeStyle = DEBUG ? 'cyan' : state.color;
    screenContext.fillStyle = DEBUG ? 'cyan' : state.color;
    screenContext.lineCap = 'round';
    screenContext.lineJoin = 'round';
});

////////// action handler //////////
/** @type {(e: MouseEvent) => void} */
function onDrawStart(e) {
    const bound = {
        left: Math.floor(mouseAnchorX), right: Math.ceil(mouseAnchorX),
        top: Math.floor(mouseAnchorY), bottom: Math.ceil(mouseAnchorY)
    };
    
    const path = [{x: mouseAnchorX, y: mouseAnchorY}];
    
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
        const dx = mouseAnchorX - path.at(-1).x;
        const dy = mouseAnchorY - path.at(-1).y;
        if (dx * dx + dy * dy < 3) return;
        
        refresh();
        
        if (mouseAnchorX < bound.left) bound.left = Math.floor(mouseAnchorX);
        else if (mouseAnchorX > bound.right) bound.right = Math.ceil(mouseAnchorX);
        if (mouseAnchorY < bound.top) bound.top = Math.floor(mouseAnchorY);
        else if (mouseAnchorY > bound.bottom) bound.bottom = Math.ceil(mouseAnchorY);
        
        path.push({x: mouseAnchorX, y: mouseAnchorY});
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
    const path = [{x: mouseAnchorX, y: mouseAnchorY}];
    
    screenContext.globalCompositeOperation = 'destination-out';
}

/** @type {(e: MouseEvent) => void} */
function onDragStart(e) {
    const onDrag = e => translate(e.movementX, e.movementY);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => document.removeEventListener('mousemove', onDrag), { once: true });
}


//change canvas.width & canvas.height while keeping context
/** @type {(width: number, height: number) => void} */
function resize(width, height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width  = `${canvas.width  * state.zoom}px`;
    canvas.style.height = `${canvas.height * state.zoom}px`;
    
    context.lineWidth   = state.lineWidth;
    context.lineCap     =         'round';
    context.lineJoin    =         'round';
    context.strokeStyle =     state.color;
    context.fillStyle   =     state.color;
    
    if (canvasBound === null) return;
    
    canvas.style.left = `${state.anchorX + canvasBound.left * state.zoom}px`;
    canvas.style.top  = `${state.anchorY + canvasBound.top  * state.zoom}px`;
    
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
    return {x: (x - state.anchorX) / state.zoom, y: (y - state.anchorY) / state.zoom};
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
    state.anchorX += dx;
    state.anchorY += dy;
    if (canvasBound !== null) {
        canvas.style.left = `${state.anchorX + canvasBound.left * state.zoom}px`;
        canvas.style.top = `${state.anchorY + canvasBound.top * state.zoom}px`;
    }
    
    let blockCountX = state.anchorX / state.zoom;
    let blockCountY = state.anchorY / state.zoom;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * state.zoom}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * state.zoom}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
}

/** screen coordinate
 * @type {(rate: number, x: number, y: number) => void}
 */
function scale(rate, x, y) {
    const newScaleRate = state.zoom * rate;
    if (newScaleRate < 0.2 || newScaleRate > 100) return;
    state.zoom = newScaleRate;
    state.anchorX = x + rate * (state.anchorX - x);
    state.anchorY = y + rate * (state.anchorY - y);
    if (canvasBound !== null) {
        canvas.style.left = `${state.anchorX + canvasBound.left * state.zoom}px`;
        canvas.style.top  = `${state.anchorY + canvasBound.top  * state.zoom}px`;
        canvas.style.width = `${canvas.width * state.zoom}px`;
        canvas.style.height = `${canvas.height * state.zoom}px`;
    }
    
    screenCanvas.width = Math.ceil(window.innerWidth / state.zoom) + 1;
    screenCanvas.height = Math.ceil(window.innerHeight / state.zoom) + 1;
    screenCanvas.style.width = `${screenCanvas.width * state.zoom}px`;
    screenCanvas.style.height = `${screenCanvas.height * state.zoom}px`;
    let blockCountX = state.anchorX / state.zoom;
    let blockCountY = state.anchorY / state.zoom;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * state.zoom}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * state.zoom}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
    screenContext.lineWidth = state.lineWidth;
    screenContext.strokeStyle = DEBUG ? 'cyan' : state.color;
    screenContext.fillStyle = DEBUG ? 'cyan' : state.color;
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
        anchorPoint.style.left = `${state.anchorX}px`;
        anchorPoint.style.top = `${state.anchorY}px`;
        debugInfo.innerHTML = `
            e.clientX: ${e.clientX}<br>
            e.clientY: ${e.clientY}<br>
            mouseAnchorX: ${mouseAnchorX}<br>
            mouseAnchorY: ${mouseAnchorY}<br>
            state.anchorX: ${state.anchorX}<br>
            state.anchorY: ${state.anchorY}<br>
            state.zoom: ${state.zoom}<br>
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