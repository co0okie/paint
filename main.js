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

document.addEventListener('mousemove', /** @type {MouseEvent} */ e => {
    cursor.matrix.e = e.clientX
    cursor.matrix.f = e.clientY
})
document.addEventListener('keydown', /** @type {KeyboardEvent} */ e => {
    if (e.ctrlKey && e.code === 'KeyZ') {
        e.shiftKey ? commands.redo() : commands.undo();
        return;
    }
    if (e.repeat) return;
    if (e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault()
        saveSVG()
        return;
    }
    if (e.ctrlKey && e.code === 'KeyO') {
        e.preventDefault()
        loadSVG()
        return;
    }
    const mode = ({
        'KeyZ': penMode,
        'KeyX': eraseMode,
    })[e.code]
    if (mode && state.mode !== mode) {
        state.mode.exit()
        state.mode = mode
        state.mode.enter()
    };
})
document.addEventListener('mousedown', /** @type {MouseEvent} */ e => {
    if (e.button === 1) onDragStart(e)
})
document.addEventListener('wheel', /** @type {WheelEvent} */ e => {
    // f(x) = a^-bx
    if (e.deltaY) scale(100 ** (-0.0005 * e.deltaY), e.clientX, e.clientY, mouse.x, mouse.y);
})
window.addEventListener('beforeunload', /** @type {BeforeUnloadEvent} */ e => {
    if (DEBUG) return;
    e.preventDefault()
    return ''
})

// calculate e.clientX/Y in svg coordinate
const mouse = {};
for (const type of ['mousemove', 'mousedown']) {
    document.addEventListener(type, e => {
        // screen coordinte => svg coordinate
        mouse.x = bound.x + (e.clientX - matrix.e) / matrix.a;
        mouse.y = bound.y + (e.clientY - matrix.f) / matrix.d;
    })
}

////////// command //////////
/** @interface */
class Command {
    run() {}
    undo() {}
}

/** @implements {Command} */
class DrawCommand {
    /** @param {SVGPolylineElement} polyline */
    constructor(polyline) {
        /** @type {SVGPolylineElement} */
        this.polyline = polyline
    }
    
    run() {
        svg.appendChild(this.polyline)
    }
    
    undo() {
        this.polyline.remove()
    }
}

/** @implements {Command} */
class EraseCommand {
    /** @param {Array<SVGElement>} elements */
    constructor(elements) {
        /** @type {Array<SVGElement>} */
        this.elements = elements
    }
    
    run() {
        for (const element of this.elements) element.style.display = 'none'
    }
    
    undo() {
        for (const element of this.elements) element.style.removeProperty('display')
    }
}

const commands = {
    /** @type {Array<Command>} */
    stack: [],
    /** @type {Array<Command>} */
    redoStack: [],
    /** @param {Command} command */
    push(command) {
        this.stack.push(command)
        if (this.redoStack.length) this.redoStack = []
    },
    undo() {
        if (this.stack.length === 0) return;
        const top = this.stack.pop()
        top.undo()
        this.redoStack.push(top)
    },
    redo() {
        if (this.redoStack.length === 0) return;
        const top = this.redoStack.pop()
        top.run()
        this.stack.push(top)
    }
}

////////// mode //////////
/** 
 * @typedef {Object} Mode
 * @property {function(): void} enter
 * @property {function(): void} exit
 */

/** @type {Mode} */
const penMode = {
    enter() {
        cursor.pen.setAttribute('fill', `${state.color}`)
        cursor.matrix.a = cursor.matrix.d = state.lineWidth * matrix.a
        cursor.svg.appendChild(cursor.pen)
        
        document.addEventListener('mousedown', this.onMousedown)
        document.addEventListener('keydown', this.onKeydown)
        document.addEventListener('wheel', this.onWheel)
    },
    exit() {
        document.removeEventListener('mousedown', this.onMousedown)
        document.removeEventListener('keydown', this.onKeydown)
        document.removeEventListener('wheel', this.onWheel)
        
        cursor.pen.remove()
    },
    onMousedown(/** @type {MouseEvent} */ e) {
        if (e.button === 0) {
            onDrawStart(e);
        }
    },
    onKeydown(/** @type {KeyboardEvent} */ e) {
        
    },
    onWheel(/** @type {WheelEvent} */ e) {
        if (!e.deltaY) return;
        cursor.matrix.a = cursor.matrix.d = state.lineWidth * matrix.a
    }
}

/** @type {Mode} */
const eraseMode = {
    enter() {
        cursor.matrix.a = cursor.matrix.d = 50
        cursor.svg.appendChild(cursor.eraser)
        
        document.addEventListener('mousedown', this.onMousedown)
        document.addEventListener('keydown', this.onKeydown)
    },
    exit() {
        document.removeEventListener('mousedown', this.onMousedown)
        document.removeEventListener('keydown', this.onKeydown)
        
        cursor.eraser.remove()
    },
    onMousedown(e) {
        if (e.button === 0) {
            onEraseStart(e);
        }
    },
    onKeydown(e) {
        
    }
}

/** @enum {number} */
const MODE = {
    SELECT: 0,
    PEN: 10,
    ERASER: 20,
    SHAPE_RECTANGLE: 30,
    SHAPE_ELLIPSE: 31,
    SHAPE_TRIANGLE: 32,
    FLOOD_FILL: 40
}

////////// action //////////
/** @enum {number} */
const ACTION = {
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


////////// status //////////
const state = {
    /** @type {Mode} */
    mode: penMode,
    /** @type {ACTION} */
    action: ACTION.NOTHING,
    lineWidth: 3,
    color: 'white',
    
    /** @type {MODE} */
    shape: MODE.SHAPE_RECTANGLE,
}

const cursor = {
    svg: document.createElementNS(NS_SVG, 'svg'),
    /** @type {SVGMatrix} */
    matrix: null,
    pen: document.createElementNS(NS_SVG, 'circle'),
    /** @type {SVGGElement} */
    eraser: document.createElementNS(NS_SVG, 'g')
}
cursor.svg.id = 'cursor'
cursor.svg.width.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_NUMBER, 1)
cursor.svg.height.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_NUMBER, 1)
cursor.matrix = cursor.svg.transform.baseVal.appendItem(cursor.svg.createSVGTransform()).matrix
cursor.pen.cx.baseVal.value = 0.5
cursor.pen.cy.baseVal.value = 0.5
cursor.pen.r.baseVal.value = 0.5
cursor.eraser.setAttribute('transform', 'rotate(45, 0.5, 0.5) translate(0.5, 0.356)')
cursor.eraser.setAttribute('stroke', 'white')
cursor.eraser.setAttribute('stroke-width', '0.03')
cursor.eraser.setAttribute('fill', 'none')
cursor.eraser.innerHTML = '<rect width="0.466" height="0.288" rx="0.05"/><line x1="0.12" y1="0" x2="0.12" y2="0.288"/><line x1="0.12" y1="0.088" x2="0.466" y2="0.088"/><line x1="0.12" y1="0.2" x2="0.466" y2="0.2"/>'
document.body.appendChild(cursor.svg)

state.mode.enter()

////////// action handler //////////
/** @param {MouseEvent} e */
function onDrawStart(e) {
    /** @type {SVGPolylineElement} */
    const polyline = document.createElementNS(NS_SVG, 'polyline');
    const points = polyline.points;
    polyline.setAttribute('stroke', state.color)
    polyline.setAttribute('stroke-width', state.lineWidth)
    
    let lastX = e.clientX, lastY = e.clientY;
    
    const point = svg.createSVGPoint()
    point.x = mouse.x
    point.y = mouse.y
    points.appendItem(point)
    svg.appendChild(polyline)
    
    /** @type {(e: MouseEvent) => void} */
    function onDraw(e) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (dx * dx + dy * dy < 20) return;
        lastX = e.clientX
        lastY = e.clientY
        
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
        point.x = mouse.x
        point.y = mouse.y
        points.appendItem(point)
    }
    
    document.addEventListener('mousemove', onDraw)
    
    document.addEventListener('newaction', () => {
        document.removeEventListener('mousemove', onDraw)
        if (points.length === 1) points.appendItem(points.getItem(0))
        commands.push(new DrawCommand(polyline))
    }, {once: true})
}

/** @param {MouseEvent} e */
function onEraseStart(e) {
    /** @type {Array<SVGElement>} */
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

/** @param {MouseEvent} e */
function onDragStart(e) {
    const fixX = mouse.x, fixY = mouse.y;
    const onDrag = e => {
        matrix.e = e.clientX + (bound.x - fixX) * matrix.a
        matrix.f = e.clientY + (bound.y - fixY) * matrix.d
    }
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => {
        document.removeEventListener('mousemove', onDrag);
    }, { once: true });
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

function saveSVG() {
    /** @type {SVGSVGElement} */
    const copy = svg.cloneNode(true)
    copy.removeAttribute('style')
    copy.style.backgroundColor = 'black'
    copy.transform.baseVal.clear()
    for (const hidden of copy.querySelectorAll('[display="none"]')) hidden.remove()
    const bbox = svg.getBBox()
    copy.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
    copy.width.baseVal.value = bbox.width
    copy.height.baseVal.value = bbox.height
    const a = document.createElement('a')
    a.download = 'image.svg'
    a.href = "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(new XMLSerializer().serializeToString(copy))
    if (DEBUG) console.log(a.href);
    a.click()
}

function loadSVG() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/svg+xml'
    input.onchange = e => {
        if (e.target.files[0].type !== 'image/svg+xml') return;
        const reader = new FileReader()
        const div = document.createElement('div')
        reader.onload = () => {
            div.innerHTML = reader.result
            svg.innerHTML = div.firstChild.innerHTML
            const tempBound = div.firstChild.viewBox.baseVal
            bound.x = tempBound.x - 1000
            bound.right = tempBound.x + tempBound.width + 1000
            bound.y = tempBound.y - 1000
            bound.bottom = tempBound.y + tempBound.height + 1000
            svg.width.baseVal.value = bound.width = bound.right - bound.x
            svg.height.baseVal.value = bound.height = bound.bottom - bound.y
            matrix.a = matrix.d = 1
            matrix.e = (window.innerWidth - bound.width) / 2 // center
            matrix.f = (window.innerHeight - bound.height) / 2 // center
        }
        reader.readAsText(e.target.files[0])
    }
    input.click()
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
    debug.style.backgroundColor = '#00000040';
    
    const anchorPoint = document.createElement('div');
    anchorPoint.style.backgroundColor = 'red';
    anchorPoint.style.position = 'fixed';
    anchorPoint.style.width = '10px';
    anchorPoint.style.height = '10px';
    anchorPoint.style.borderRadius = '50%';
    anchorPoint.style.translate = '-50% -50%';
    document.body.appendChild(anchorPoint);
    
    // const reverseMODE = Object.fromEntries(Object.entries(MODE).map(([k, v]) => [v, k]))
    // const reverseACTION = Object.fromEntries(Object.entries(ACTION).map(([k, v]) => [v, k]))
    
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
        `;
    }
    
    for (let type of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) {
        document.addEventListener(type, updateDebugInfo);
    }
}