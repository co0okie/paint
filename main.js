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
    E/Q: zoom in/out at mouse position
    
setting:
    F + ?: color
    G + wheel: width
*/

////////// mode //////////
/** @enum {number} */
const MODE = Object.freeze({
    SELECT: 0,
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
    ZOOM_IN: 3,
    ZOOM_OUT: 4,
    DRAWING: 10,
    ERASING: 20,
    SELECTING_SHAPE: 30,
    DRAWING_SHAPE: 31,
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

let translateVelocityX = 0;
let translateVelocityY = 0;

/** @type {Command[][][]} */
const net = [];

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{left: number, right: number, top: number, bottom: number}} Bound
 * @typedef {DrawCommand} Command
 */

class Command {
    run() { throw new Error('run() not overridden') }
    undo() { throw new Error('undo() not overridden') }
}

/** @implements {Command} */
class DrawCommand extends Command {
    /**
     * @param {Point[]} path 
     * @param {Bound} bound 
     */
    constructor(path, bound) {
        super();
        /** @type {Point[]} */
        this.path = path;
        /** @type {Bound} */
        this.bound = bound;
    }
    
    /** @override */
    run() {
        // first draw
        if (canvasBound === null) {
            canvasBound = {
                left: this.bound.left - 1000,
                right: this.bound.right + 1000,
                top: this.bound.top - 1000,
                bottom: this.bound.bottom + 1000,
            }
            resize(canvasBound.right - canvasBound.left, canvasBound.bottom - canvasBound.top);
        }
        // out of bounds
        else if (
            this.bound.left < canvasBound.left || this.bound.right > canvasBound.right ||
            this.bound.top < canvasBound.top || this.bound.bottom > canvasBound.bottom
        ) {
            const buffer = new OffscreenCanvas(canvas.width, canvas.height);
            buffer.getContext('2d').drawImage(canvas, 0, 0)
            const oldLeft = canvasBound.left, oldTop = canvasBound.top;
            canvasBound = {
                left: Math.min(this.bound.left - 500, canvasBound.left),
                right: Math.max(this.bound.right + 500, canvasBound.right),
                top: Math.min(this.bound.top - 500, canvasBound.top),
                bottom: Math.max(this.bound.bottom + 500, canvasBound.bottom)
            };
            resize(canvasBound.right - canvasBound.left, canvasBound.bottom - canvasBound.top)
            context.drawImage(buffer, oldLeft, oldTop)
        }

        context.beginPath();
        context.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1, l = this.path.length; i < l; ++i) {
            context.lineTo(this.path[i].x, this.path[i].y);
        }
        context.stroke();
    }
    
    /** @override */
    undo() {
        // if not pass through too many paths: clearRect(bound), redraw all lines in bound
        // if too many paths: redraw all chuncks passed through
    }
}

const commands = {
    /** @type {DrawCommand[]} */
    stack: [],
    /** @type {(path: Point[], bound: Bound) => void} */
    draw: function(path, bound) {
        const command = new DrawCommand(path, bound);
        this.stack.push(command);
        command.run();
    },
    undo: function() {
        
    },
    redo: function() {
        
    }
}

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
let mouseX, mouseY;
for (const type of ['mousemove', 'mousedown']) {
    document.addEventListener(type, e => {
        // screen coordinte => anchor coordinate
        mouseX = (e.clientX - state.anchorX) / state.zoom;
        mouseY = (e.clientY - state.anchorY) / state.zoom;
    })
}

// cast 'newaction' event if click, scroll, press any key or resize
/** @typedef {{detail: KeyboardEvent | MouseEvent | WheelEvent | UIEvent}} NewActionEvent */
for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'wheel']) {
    document.addEventListener(type, e => {
        if (e.key === 'Alt' || e.key === 'Control' || e.key === 'Shift') return;
        if (e.repeat) return; // prevent long press repeated fire
        document.dispatchEvent(new CustomEvent('newaction', { detail: e }));
    });
}
window.addEventListener('resize', e => document.dispatchEvent(new CustomEvent('newaction', { detail: e })));
window.addEventListener('wheel', e => e.preventDefault(), { passive: false })

////////// action recognition //////////
document.addEventListener('keydown', e => {
    // if (e.ctrlKey && e.code === 'KeyZ') {
    //     e.shiftKey ? redo() : undo();
    //     return;
    // }
    if (e.repeat) return;
    switch (e.code) {
    case 'Space':
        state.mode = MODE.SELECT;
        break;
    case 'KeyZ':
        state.mode = MODE.PEN;
        break;
    case 'KeyX':
        state.mode = MODE.ERASER;
        break;
    case 'KeyC':
        state.action = ACTION.SELECTING_SHAPE;
        break;
    case 'KeyV':
        state.mode = MODE.FLOOD_FILL;
        break;
    case 'KeyW':
        translateVelocityY = -1;
        state.action = ACTION.TRANSLATING;
        break;
    case 'KeyA':
        translateVelocityX = -1;
        state.action = ACTION.TRANSLATING;
        break;
    case 'KeyS':
        translateVelocityY = 1;
        state.action = ACTION.TRANSLATING;
        break;
    case 'KeyD':
        translateVelocityX = 1;
        state.action = ACTION.TRANSLATING;
        break;
    case 'KeyE':
        state.action = ACTION.ZOOM_IN;
        break;
    case 'KeyQ':
        state.action = ACTION.ZOOM_OUT;
        break;
    case 'KeyF':
        state.action = ACTION.PALETTE;
        break;
    case 'KeyG':
        state.action = ACTION.LINE_WIDTH;
        break;
    }
});

document.addEventListener('mousedown', e => {
    if (e.button === 1) {
        onDragStart(e)
        state.action = ACTION.DRAGING;
    }
    switch (state.mode) {
    case MODE.SELECT:
        break;
    case MODE.PEN:
        if (e.button === 0) {
            onDrawStart(e);
            state.action = ACTION.DRAWING;
        }
        break;
    case MODE.ERASER:
        if (e.button === 0) {
            state.action = ACTION.ERASING;
        }
        break;
    case MODE.SHAPE_RECTANGLE:
        if (e.button === 0) {
            state.action = ACTION.DRAWING_SHAPE;
        }
        break;
    case MODE.SHAPE_ELLIPSE:
        if (e.button === 0) {
            state.action = ACTION.DRAWING_SHAPE;
        }
        break;
    case MODE.SHAPE_TRIANGLE:
        if (e.button === 0) {
            state.action = ACTION.DRAWING_SHAPE;
        }
        break;
    case MODE.FLOOD_FILL:
        break;
    }
});

document.addEventListener('newaction', e => {
    switch (state.action) {
    case ACTION.DRAWING:
        onDrawEnd(e);
        break;
    }
    state.action = ACTION.NOTHING;
})

document.addEventListener('mousemove', e => {
    switch (state.action) {
    case ACTION.DRAWING:
        onDraw(e);
        break;
    }
});

document.addEventListener('wheel', e => {
    // rate ** -e.deltaY
    if (DEBUG > 1) console.log(e.deltaY);
    // f(x) = a^-bx
    if (e.deltaY) scale(100 ** (-0.0005 * e.deltaY), e.clientX, e.clientY);
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

window.addEventListener('beforeunload', e => {
    if (DEBUG) return;
    e.preventDefault()
    return ''
})

////////// action handler //////////
const [onDrawStart, onDraw, onDrawEnd] = (() => {
    /** @type {Bound} */
    let bound = {};
    /** @type {Point[]} */
    let path = [];
    
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
    
    /** @type {(e: MouseEvent) => void} */
    function onDrawStart(e) {
        bound = {
            left: Math.floor(mouseX), right: Math.ceil(mouseX),
            top: Math.floor(mouseY), bottom: Math.ceil(mouseY)
        };
        path = [{x: mouseX, y: mouseY}];
    }
    
    /** @type {(e: MouseEvent) => void} */
    function onDraw(e) {
        const dx = mouseX - path.at(-1).x;
        const dy = mouseY - path.at(-1).y;
        if (dx * dx + dy * dy < 3) return;
        
        refresh();
        
        if (mouseX < bound.left) bound.left = Math.floor(mouseX);
        else if (mouseX > bound.right) bound.right = Math.ceil(mouseX);
        if (mouseY < bound.top) bound.top = Math.floor(mouseY);
        else if (mouseY > bound.bottom) bound.bottom = Math.ceil(mouseY);
        
        path.push({x: mouseX, y: mouseY});
    }
    
    /** @type {(e: MouseEvent) => void} */
    function onDrawEnd(e) {
        // bound: bound of path
        // undoStack[n].bound: bound of canvas
        // boundUnion(bound);
        // undoStack.push({path: path, bound: canvasBound});
        // doUndoStack();
        // redoStack.length = 0;
        
        commands.draw(path, bound);
        
        screenContext.clearRect(
            screenCanvasBound.left, screenCanvasBound.top,
            screenCanvas.width, screenCanvas.height
        );
    }
    
    return [onDrawStart, onDraw, onDrawEnd];
})()

/** @type {(e: MouseEvent) => void} */
function onEraseStart(e) {
    const path = [{x: mouseX, y: mouseY}];
    
    screenContext.globalCompositeOperation = 'destination-out';
}

/** @type {(e: MouseEvent) => void} */
function onDragStart(e) {
    const onDrag = e => translate(e.movementX, e.movementY);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => {
        document.removeEventListener('mousemove', onDrag);
    
        let blockCountX = state.anchorX / state.zoom;
        let blockCountY = state.anchorY / state.zoom;
        screenCanvasBound.left = -Math.ceil(blockCountX);
        screenCanvasBound.top = -Math.ceil(blockCountY);
        screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * state.zoom}px`;
        screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * state.zoom}px`;
        screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
    }, { once: true });
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
        bound.left   -= 1000;
        bound.right  += 1000;
        bound.top    -= 1000;
        bound.bottom += 1000;
        resize(bound.right - bound.left, bound.bottom - bound.top);
    }
    // out of bounds
    else if (bound.left < canvasBound.left || bound.right  > canvasBound.right ||
             bound.top  < canvasBound.top  || bound.bottom > canvasBound.bottom) {
        canvasBound = { // keep old canvasBound reference
            left  : Math.min(bound.left   - 500, canvasBound.left  ),
            right : Math.max(bound.right  + 500, canvasBound.right ),
            top   : Math.min(bound.top    - 500, canvasBound.top   ),
            bottom: Math.max(bound.bottom + 500, canvasBound.bottom)
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
    
    const reverseMODE = Object.fromEntries(Object.entries(MODE).map(([k, v]) => [v, k]))
    const reverseACTION = Object.fromEntries(Object.entries(ACTION).map(([k, v]) => [v, k]))
    
    function updateDebugInfo(e) {
        anchorPoint.style.left = `${state.anchorX}px`;
        anchorPoint.style.top = `${state.anchorY}px`;
        debugInfo.innerHTML = `
            e.clientX: ${e.clientX}<br>
            e.clientY: ${e.clientY}<br>
            mouseAnchorX: ${mouseX}<br>
            mouseAnchorY: ${mouseY}<br>
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
            mode: ${reverseMODE[String(state.mode)]}<br>
            action: ${reverseACTION[String(state.action)]}<br>
        `;
    }
    
    for (let type of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) {
        document.addEventListener(type, updateDebugInfo);
    }
}