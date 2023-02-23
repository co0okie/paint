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

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
canvas.width = 1920;
canvas.height = 10800;
context.lineWidth = 3;
context.lineCap = 'round';
context.lineJoin = 'round';
context.strokeStyle = 'white';

const body = document.body;

/** {@link setTransform} */
let scale = window.innerWidth / canvas.width;
let initScale = scale;
let translateX = 0, translateY = 0;

let oldClientX, oldClientY;
let mouseX, mouseY; // mouse in image

const commands = [];
let command = [], redo = [];

const setting = {
    stayInPage: false
};

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
    if (setting.stayInPage && scale < initScale) scale = initScale;
    canvas.style.width = canvas.width * scale + 'px';
    if (setting.stayInPage) {
        if (translateX > 0) translateX = 0;
        let rightLimit = window.innerWidth - canvas.offsetWidth;
        if (translateX < rightLimit) translateX = rightLimit;
    }
    canvas.style.left = translateX + 'px';
    canvas.style.top = translateY + 'px';
}

function refresh() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    for (let command of commands) {
        context.moveTo(command[0].x, command[0].y);
        for (let point of command) {
            context.lineTo(point.x, point.y);
        }
    }
    context.stroke();
}

/**
 * formula: {@link setMouse}
 * ```math
 * m = mouse, c = client, t = translate, s = scale
 * m = (c - t) * s
 * t = c - m / s
 * ```
 * @param {WheelEvent} e
 */
function wheelZoom(e) {
    scale *= e.deltaY < 0 ? 1.25 : 0.8;
    if (setting.stayInPage && scale < initScale) scale = initScale;
    translateX = e.clientX - mouseX * scale;
    translateY = e.clientY - mouseY * scale;
    setTransform();
}

/** fix at center  
 * w = window, t = translate, s = scale, c = center
 * ```math
 * (w / 2 - t) / s = c
 * t = w / 2 - s * c
 * t' = w / 2 - r * s * c
 *    = w / 2 - r * s * (w / 2 - t) / s
 *    = t + (1 - r) * (w / 2 - t)
 * ```
 * @param {MouseEvent} e
 */
function mouseZoom(e) {
    let rate = 1.005 ** (e.clientY - oldClientY);
    scale *= rate;
    if (setting.stayInPage && scale < initScale) scale = initScale;
    translateX += (1 - rate) * (window.innerWidth / 2 - translateX);
    translateY += (1 - rate) * (window.innerHeight / 2 - translateY);
    setTransform();
}

/** @param {MouseEvent} e */
function onMouseDown(e) {
    if (e.button === 1) e.preventDefault();
    
    if (action === 0) {
        if (e.altKey && e.button === 0 || e.button === 1) {
            action = 2; // moving
        } else if (e.ctrlKey && e.button === 0) {
            action = 3; // zooming
        } else if (e.button === 0) {
            action = 1; // drawing
            command = [];
            commands.push(command);
            redo = [];
            command.push({
                x: mouseX,
                y: mouseY
            });
        }
    }
}

/** @param {MouseEvent} e */
function onMouseUp(e) {
    action = 0;
}

/** @param {MouseEvent} e */
function onMouseMove(e) {
    setMouse(e);
    
    switch (action) {
    case 1: // draw
        command.push({
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
}

/** @param {KeyboardEvent} e */
function onKeyDown(e) {
    if (e.ctrlKey && e.code === 'KeyZ') {
        if (e.shiftKey) {
            if (redo.length) commands.push(redo.pop());
        } else {
            if (commands.length) redo.push(commands.pop());
        }
        refresh();
    }
}

/** @param {KeyboardEvent} e */
function onKeyUp(e) {
    if (e.code === 'KeyL') {
        setting.stayInPage = !setting.stayInPage;
        setTransform();
    }
    if (e.ctrlKey && e.code === 'KeyC') {
        canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]));
    }
}

/** @param {WheelEvent} e */
function onWheel(e) {
    e.preventDefault();
    wheelZoom(e);
}

function onResize() {
    initScale = window.innerWidth / canvas.width;
    setTransform();
}

document.addEventListener('mousemove', e => {
    setMouse(e);
    oldClientX = e.clientX;
    oldClientY = e.clientY;
    
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);
}, { once: true });

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
        points.length ${command.length}<br>
        record.length: ${commands.length}<br>
        redo.length: ${redo.length}<br>
        action: ${ACTION_TEXT[action]}<br>
        transform: ${canvas.style.transform}<br>
        canvas.offsetWidth: ${canvas.offsetWidth}<br>
        translateX + canvas.offsetWidth: ${translateX + canvas.offsetWidth}<br>
        window.innerWidth: ${window.innerWidth}<br>
    `;
}

document.addEventListener('mousemove', updateDebugInfo);
document.addEventListener('wheel', updateDebugInfo);