const DEBUG = 1;

// O = window top left, screen coordinate
const origin = {
    x: window.innerWidth / 2, 
    y: window.innerHeight / 2
};

// origin coordinate * scaleRate = screen cooridinate
let scaleRate = 1;

let canvas = document.getElementById('main');
canvas.width = 0;
canvas.height = 0;
if (DEBUG) canvas.style.backgroundColor = '#222';

// O = origin, origin coordinate
let canvasBound;

let context = canvas.getContext('2d');
context.lineWidth = 3;
context.lineCap = 'round';
context.lineJoin = 'round';
context.strokeStyle = 'white';

const screenCanvas = document.getElementById('screen');
screenCanvas.width = window.innerWidth;
screenCanvas.height = window.innerHeight;
screenCanvas.style.width = `${window.innerWidth}px`;
screenCanvas.style.height = `${window.innerHeight}px`;
screenCanvas.style.left = '0px';
screenCanvas.style.top = '0px';

// O = origin, origin coordinate
let screenCanvasBound = {left: -Math.ceil(origin.x), top: -Math.ceil(origin.y)};

const screenContext = screenCanvas.getContext('2d');
screenContext.lineWidth = context.lineWidth;
screenContext.strokeStyle = DEBUG ? 'blue' : context.strokeStyle;
screenContext.lineCap = 'round';
screenContext.lineJoin = 'round';
screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);

let undoStack = [];
let redoStack = [];



// add e.clientX/Y relative to origin
for (let type of ['mousemove', 'mousedown']) {
    document.addEventListener(type, e => {
        // screen coordinte => origin coordinate
        e.originX = (e.clientX - origin.x) / scaleRate;
        e.originY = (e.clientY - origin.y) / scaleRate;
    })
}

{ // add old mouse position in mousemove event
    let oldEvent = {};
    document.addEventListener('mousemove', e => {
        e.oldClientX = oldEvent.clientX;
        e.oldClientY = oldEvent.clientY;
        oldEvent = e;
    }, true)
}

// cast 'newaction' event if click, scroll, press any key or resize window
for (type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'wheel', 'mouseleave']) {
    document.addEventListener(type, e => document.dispatchEvent(new CustomEvent('newaction')));
}
window.addEventListener('resize', e => document.dispatchEvent(new CustomEvent('newaction')));
window.addEventListener('wheel', e => e.preventDefault(), { passive: false })


// event handler
document.addEventListener('mousedown', e => {
    switch (e.button) {
        case 0: // left click
            onDrawStart(e);
            break;
        case 1: // middle click
            onDragStart(e);
            break;
    }
})

document.addEventListener('wheel', e => {
    // rate ** -e.deltaY
    if (DEBUG > 1) console.log(e.deltaY);
    // f(x) = a^-bx
    if (e.deltaY) scale(1.5 ** (-0.01 * e.deltaY), e.clientX, e.clientY);
})

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code === 'KeyZ') e.shiftKey ? redo() : undo();
});

window.addEventListener('resize', e => {
    screenCanvas.width = Math.ceil(window.innerWidth / scaleRate);
    screenCanvas.height = Math.ceil(window.innerHeight / scaleRate);
    screenCanvas.style.width = `${screenCanvas.width * scaleRate}px`;
    screenCanvas.style.height = `${screenCanvas.height * scaleRate}px`;
    let blockCountX = origin.x / scaleRate;
    let blockCountY = origin.y / scaleRate;
    let marginX = blockCountX - Math.ceil(blockCountX);
    let marginY = blockCountY - Math.ceil(blockCountY);
    screenCanvas.style.left = `${marginX * scaleRate}px`;
    screenCanvas.style.top = `${marginY * scaleRate}px`;
    screenContext.setTransform(1, 0, 0, 1, -marginX, -marginY);
    screenContext.lineWidth = context.lineWidth;
    screenContext.strokeStyle = DEBUG ? 'blue' : context.strokeStyle;
    screenContext.lineCap = 'round';
    screenContext.lineJoin = 'round';
})



function onDrawStart(e) {
    const bound = {
        left: Math.floor(e.originX), right: Math.ceil(e.originX), 
        top: Math.floor(e.originY), bottom: Math.ceil(e.originY)
    };
    
    const path = [{x: e.originX, y: e.originY}];
    
    function onDraw(e) {
        screenContext.clearRect(
            screenCanvasBound.left, screenCanvasBound.top,
            screenCanvas.width, screenCanvas.height
        );
        screenContext.beginPath();
        screenContext.moveTo(path[0].x, path[0].y);
        for (point of path) {
            screenContext.lineTo(point.x, point.y);
        }
        // screenContext.moveTo(e.originX, e.originY);
        // screenContext.lineTo(e.clientX / scaleRate, e.clientY / scaleRate);
        screenContext.stroke();
        
        if (e.originX < bound.left) bound.left = Math.floor(e.originX);
        else if (e.originX > bound.right) bound.right = Math.ceil(e.originX);
        if (e.originY < bound.top) bound.top = Math.floor(e.originY);
        else if (e.originY > bound.bottom) bound.bottom = Math.ceil(e.originY);
        
        path.push({x: e.originX, y: e.originY});
    }
    
    document.addEventListener('mousemove', onDraw);
    
    document.addEventListener('newaction', e => {
        document.removeEventListener('mousemove', onDraw);
        
        draw(path, bound);
        undoStack.push({path: path, bound: canvasBound});
        redoStack = [];
        
        screenContext.clearRect(
            screenCanvasBound.left, screenCanvasBound.top,
            screenCanvas.width, screenCanvas.height
        );
    }, { once: true });
}

function onDragStart(e) {
    const onDrag = e => translate(e.clientX - e.oldClientX, e.clientY - e.oldClientY);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => document.removeEventListener('mousemove', onDrag), { once: true });
}



// change canvas.width & canvas.height while keeping context
function resize(width, height) {
    let lineWidth   = context.lineWidth  ;
    let lineCap     = context.lineCap    ;
    let lineJoin    = context.lineJoin   ;
    let strokeStyle = context.strokeStyle;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width  = `${canvas.width  * scaleRate}px`;
    canvas.style.height = `${canvas.height * scaleRate}px`;
    
    context.lineWidth   = lineWidth  ;
    context.lineCap     = lineCap    ;
    context.lineJoin    = lineJoin   ;
    context.strokeStyle = strokeStyle;
    
    if (canvasBound === undefined) return;
    
    canvas.style.left = `${origin.x + canvasBound.left * scaleRate}px`;
    canvas.style.top  = `${origin.y + canvasBound.top  * scaleRate}px`;
    
    context.translate(-canvasBound.left, -canvasBound.top);
}

// screen coordinte => origin coordinate
function toOrigin(x, y) {
    return {x: (x - origin.x) / scaleRate, y: (y - origin.y) / scaleRate};
}

// origin coordinate
function draw(path, bound) {
    bound.left -= 10;
    bound.right += 10;
    bound.top -= 10;
    bound.bottom += 10;
    
    // first draw
    if (canvasBound === undefined) {
        canvasBound = bound;
        resize(bound.right - bound.left, bound.bottom - bound.top);
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
        
        // canvasBound = bound;
        resize(canvasBound.right - canvasBound.left, canvasBound.bottom - canvasBound.top);
        
        context.beginPath();
        for (let step of undoStack) {
            context.moveTo(step.path[0].x, step.path[0].y);
            for (let point of step.path) context.lineTo(point.x, point.y);
        }
        context.stroke();
        
    }
    
    context.beginPath();
    context.moveTo(path[0].x, path[0].y);
    for (let point of path) context.lineTo(point.x, point.y);
    context.stroke();
}

// screen coordinate
function translate(dx, dy) {
    origin.x += dx;
    origin.y += dy;
    if (canvasBound !== undefined) {
        canvas.style.left = `${origin.x + canvasBound.left * scaleRate}px`;
        canvas.style.top = `${origin.y + canvasBound.top * scaleRate}px`;
    }
}

// screen coordinate
function scale(rate, x, y) {
    scaleRate *= rate;
    origin.x = x + rate * (origin.x - x);
    origin.y = y + rate * (origin.y - y);
    if (canvasBound) {
        canvas.style.left = `${origin.x + canvasBound.left * scaleRate}px`;
        canvas.style.top  = `${origin.y + canvasBound.top  * scaleRate}px`;
        canvas.style.width = `${canvas.width * scaleRate}px`;
        canvas.style.height = `${canvas.height * scaleRate}px`;
    }
    
    screenCanvas.width = Math.ceil(window.innerWidth / scaleRate) + 1;
    screenCanvas.height = Math.ceil(window.innerHeight / scaleRate) + 1;
    screenCanvas.style.width = `${screenCanvas.width * scaleRate}px`;
    screenCanvas.style.height = `${screenCanvas.height * scaleRate}px`;
    let blockCountX = origin.x / scaleRate;
    let blockCountY = origin.y / scaleRate;
    screenCanvasBound.left = -Math.ceil(blockCountX);
    screenCanvasBound.top = -Math.ceil(blockCountY);
    screenCanvas.style.left = `${(blockCountX + screenCanvasBound.left) * scaleRate}px`;
    screenCanvas.style.top = `${(blockCountY + screenCanvasBound.top) * scaleRate}px`;
    screenContext.setTransform(1, 0, 0, 1, -screenCanvasBound.left, -screenCanvasBound.top);
    screenContext.lineWidth = context.lineWidth;
    screenContext.strokeStyle = DEBUG ? 'blue' : context.strokeStyle;
    screenContext.lineCap = 'round';
    screenContext.lineJoin = 'round';
}

function undo() {
    if (undoStack.length === 0) return;
    
    redoStack.push(undoStack.pop());
    
    if (undoStack.length === 0) {
        // reset canvas
        canvasBound = undefined;
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
    
    context.beginPath();
    for (let step of undoStack) {
        context.moveTo(step.path[0].x, step.path[0].y);
        for (let point of step.path) context.lineTo(point.x, point.y);
    }
    context.stroke();
}

function redo() {
    if (redoStack.length === 0) return;
    
    const command = redoStack.pop();
    
    draw(command.path, command.bound);
    
    undoStack.push(command);
}

if (DEBUG) { // debug
    const debugInfo = document.getElementById('debug');
    
    const originPoint = document.createElement('div');
    originPoint.style.backgroundColor = 'red';
    originPoint.style.position = 'fixed';
    originPoint.style.width = '10px';
    originPoint.style.height = '10px';
    originPoint.style.borderRadius = '50%';
    originPoint.style.translate = '-50% -50%';
    document.body.appendChild(originPoint);
    
    function updateDebugInfo(e) {
        originPoint.style.left = `${origin.x}px`;
        originPoint.style.top = `${origin.y}px`;
        debugInfo.innerHTML = `
            e.clientX: ${e.clientX}<br>
            e.clientY: ${e.clientY}<br>
            e.originX: ${e.originX}<br>
            e.originY: ${e.originY}<br>
            origin.x: ${origin.x}<br>
            origin.y: ${origin.y}<br>
            scaleRate: ${scaleRate}<br>
            canvas.width: ${canvas.width}<br>
            canvas.height: ${canvas.height}<br>
            canvas.offsetWidth: ${canvas.offsetWidth}<br>
            canvas.offsetHeight: ${canvas.offsetHeight}<br>
            canvas.offsetLeft: ${canvas.offsetLeft}<br>
            canvas.offsetTop: ${canvas.offsetTop}<br>
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
            redoStack.length: ${redoStack.length}<br>
        `;
    }
    
    for (let type of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) {
        document.addEventListener(type, updateDebugInfo);
    }
}