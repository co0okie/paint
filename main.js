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
    lineWidth: 1,
    color: 'white',
    
    /** @type {MODE} */
    shape: MODE.SHAPE_RECTANGLE,
}

let translateVelocityX = 0;
let translateVelocityY = 0;

// class Command {
//     run() {}
//     undo() {}
// }

/**
 * @typedef {Object} Command
 * @property {() => void} run
 * @property {() => void} undo
 */

/** @implements {Command} */
class DrawCommand {
    /** @param {SVGPolylineElement} polyline */
    constructor(polyline) {
        /** @type {SVGPolylineElement} */
        this.polyline = polyline
    }
    
    /** @override */
    run() {
        svg.appendChild(this.polyline)
    }
    
    /** @override */
    undo() {
        this.polyline.remove()
    }
}

/** @implements {Command} */
class EraseCommand {
    /** @param {SVGElement[]} elements */
    constructor(elements) {
        /** @type {SVGElement[]} */
        this.elements = elements
    }
    
    /** @override */
    run() {
        for (const element of this.elements) element.style.display = 'none'
    }
    
    /** @override */
    undo() {
        for (const element of this.elements) element.style.removeProperty('display')
    }
}

const commands = {
    /** @type {Command[]} */
    stack: [],
    /** @type {Command[]} */
    redoStack: [],
    /** @type {(command: Command) => void} */
    push: function(command) {
        this.stack.push(command)
        if (this.redoStack.length) this.redoStack = []
    },
    undo: function() {
        if (this.stack.length === 0) return;
        const top = this.stack.pop()
        top.undo()
        this.redoStack.push(top)
    },
    redo: function() {
        if (this.redoStack.length === 0) return;
        const top = this.redoStack.pop()
        top.run()
        this.stack.push(top)
    }
}

const NS_SVG = 'http://www.w3.org/2000/svg'

/** @type {SVGSVGElement} */
const svg = document.querySelector('svg')
// document.body.appendChild(svg)
if (DEBUG) svg.style.backgroundColor = '#222';

const bound = svg.viewBox.baseVal;
bound.x = -500;
bound.y = -500;
bound.right = 500;
bound.bottom = 500;
bound.width = bound.right - bound.x;
bound.height = bound.bottom - bound.y;
svg.width.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_NUMBER, bound.width)
svg.height.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_NUMBER, bound.height)

const matrix = svg.transform.baseVal.appendItem(svg.createSVGTransform()).matrix
matrix.e = window.innerWidth / 2 + bound.x * matrix.a // center
matrix.f = window.innerHeight / 2 + bound.y * matrix.d // center

// calculate e.clientX/Y in svg coordinate
const mouse = {};
for (const type of ['mousemove', 'mousedown']) {
    document.addEventListener(type, e => {
        // screen coordinte => svg coordinate
        mouse.x = bound.x + (e.clientX - matrix.e) / matrix.a;
        mouse.y = bound.y + (e.clientY - matrix.f) / matrix.d;
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
    if (e.ctrlKey && e.code === 'KeyZ') {
        e.shiftKey ? commands.redo() : commands.undo();
        return;
    }
    if (e.repeat) return;
    if (e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault()
        downloadSVG()
    }
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
            onEraseStart(e)
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
    state.action = ACTION.NOTHING;
})

document.addEventListener('mousemove', e => {
});

document.addEventListener('wheel', e => {
    // f(x) = a^-bx
    if (e.deltaY) scale(100 ** (-0.0005 * e.deltaY), e.clientX, e.clientY, mouse.x, mouse.y);
});

window.addEventListener('beforeunload', e => {
    if (DEBUG) return;
    e.preventDefault()
    return ''
})

////////// action handler //////////
function onDrawStart() {
    /** @type {SVGPolylineElement} */
    let polyline;
    let lastX, lastY;
    
    polyline = document.createElementNS(NS_SVG, 'polyline')
    polyline.setAttribute('stroke', state.color)
    polyline.setAttribute('stroke-width', state.lineWidth)
    const point = svg.createSVGPoint()
    point.x = lastX = mouse.x
    point.y = lastY = mouse.y
    polyline.points.appendItem(point)
    svg.appendChild(polyline)
    
    /** @type {(e: MouseEvent) => void} */
    function onDraw(e) {
        const dx = mouse.x - lastX;
        const dy = mouse.y - lastY;
        if (dx * dx + dy * dy < 1) return;
        
        if (mouse.x < bound.x) {
            bound.x = mouse.x - 500;
            svg.width.baseVal.value = bound.width = bound.right - bound.x
            matrix.e = e.clientX + (bound.x - mouse.x) * matrix.a
        } else if (mouse.x > bound.right) {
            bound.right = mouse.x + 500;
            svg.width.baseVal.value = bound.width = bound.right - bound.x
        }
        if (mouse.y < bound.y) {
            bound.y = mouse.y - 500;
            svg.height.baseVal.value = bound.height = bound.bottom - bound.y
            matrix.f = e.clientY + (bound.y - mouse.y) * matrix.d
        } else if (mouse.y > bound.bottom) {
            bound.bottom = mouse.y + 500;
            svg.height.baseVal.value = bound.height = bound.bottom - bound.y
        }
        
        const point = svg.createSVGPoint()
        point.x = lastX = mouse.x
        point.y = lastY = mouse.y
        polyline.points.appendItem(point)
    }
    
    document.addEventListener('mousemove', onDraw)
    
    document.addEventListener('newaction', () => {
        document.removeEventListener('mousemove', onDraw)
        commands.push(new DrawCommand(polyline))
    }, {once: true})
}

function onEraseStart() {
    /** @type {SVGElement[]} */
    const elements = [];
    /** @param {MouseEvent} e */
    function onErase(e) {
        if (e.target.tagName !== 'polyline') return;
        e.target.style.display = 'none';
        elements.push(e.target)
    }
    svg.addEventListener('mouseover', onErase)
    document.addEventListener('newaction', () => {
        svg.removeEventListener('mouseover', onErase)
        if (elements.length) commands.push(new EraseCommand(elements))
    }, {once: true})
}

/** @type {(e: MouseEvent) => void} */
function onDragStart() {
    const onDrag = e => translate(e.movementX, e.movementY);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => {
        document.removeEventListener('mousemove', onDrag);
    }, { once: true });
}

/** screen coordinate
 * @type {(dx: number, dy: number) => void}
 */
function translate(dx, dy) {
    matrix.e += dx;
    matrix.f += dy;
}

/**
 * screen coordinate
 * @param {number} rate
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} mouseX
 * @param {number} mouseY
 */
function scale(rate, clientX, clientY, mouseX, mouseY) {
    const newScale = matrix.a * rate;
    if (newScale < 0.2 || newScale > 100) return;
    matrix.a = matrix.d = newScale;
    matrix.e = clientX + (bound.x - mouseX) * matrix.a
    matrix.f = clientY + (bound.y - mouseY) * matrix.d
}

function downloadSVG() {
    /** @type {SVGSVGElement} */
    const copy = svg.cloneNode(true)
    copy.removeAttribute('style')
    copy.removeAttribute('width')
    copy.removeAttribute('height')
    copy.removeAttribute('transform')
    const bbox = svg.getBBox()
    copy.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
    const a = document.createElement('a')
    a.download = 'image.svg'
    a.href = "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(new XMLSerializer().serializeToString(copy))
    a.dispatchEvent(new MouseEvent('click'))
}

if (DEBUG) {
    const debug = document.createElement('div');
    document.body.appendChild(debug)
    debug.style.position = 'fixed';
    debug.style.top = '0';
    debug.style.left = '0';
    debug.style.fontSize = '20px';
    debug.style.color = 'white';
    debug.style.userSelect = 'none';
    debug.style.zIndex = '1';
    debug.style.backgroundColor = '#00000080';
    
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
        anchorPoint.style.left = `${matrix.e - bound.x * matrix.a}px`;
        anchorPoint.style.top = `${matrix.f - bound.y * matrix.d}px`;
        debug.innerHTML = `
            e.clientX: ${e.clientX}<br>
            e.clientY: ${e.clientY}<br>
            mouse.x: ${mouse.x?.toFixed(2)}<br>
            mouse.y: ${mouse.y?.toFixed(2)}<br>
            bound.x: ${bound.x.toFixed(2)}<br>
            bound.y: ${bound.y.toFixed(2)}<br>
            bound.right: ${bound.right.toFixed(2)}<br>
            bound.bottom: ${bound.bottom.toFixed(2)}<br>
            bound.width: ${bound.width.toFixed(2)}<br>
            bound.height: ${bound.height.toFixed(2)}<br>
            matrix.a: ${matrix.a.toFixed(2)}<br>
            matrix.d: ${matrix.d.toFixed(2)}<br>
            matrix.e: ${matrix.e.toFixed(2)}<br>
            matrix.f: ${matrix.f.toFixed(2)}<br>
            window.innerWidth: ${window.innerWidth}<br>
            window.innerHeight: ${window.innerHeight}<br>
            mode: ${reverseMODE[String(state.mode)]}<br>
            action: ${reverseACTION[String(state.action)]}<br>
        `;
    }
    
    for (let type of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) {
        document.addEventListener(type, updateDebugInfo);
    }
}