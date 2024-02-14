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

const NS_SVG = 'http://www.w3.org/2000/svg'

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
        for (const element of this.elements) element.remove()
    }
    
    undo() {
        svg.append(...this.elements)
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


////////// animation //////////
const animation = {
    /** @type {number} */
    last: null,
    /** @type {FrameRequestCallback} */
    loop(now) {
        const dt = now - this.last
        
        mouse.svgX = bound.x + (mouse.clientX - matrix.e) / matrix.a;
        mouse.svgY = bound.y + (mouse.clientY - matrix.f) / matrix.d;
        
        let node = this.list.next
        while (node !== this.list) {
            node.handler(dt)
            node = node.next
        }
        
        this.last = now
        window.requestAnimationFrame(t => this.loop(t))
    },
    /**
     * @typedef {Object} ListenerNode
     * @property {(dt: number) => void} handler
     * @property {ListenerNode} previous
     * @property {ListenerNode} next
     * @property {() => void} remove
     */
    /** @type {{previous: ListenerNode, next: ListenerNode}} */
    list: {},
    add(/** @type {(dt: number) => void} */ handler) {
        /** @type {ListenerNode} */
        const node = {
            handler: handler,
            previous: this.list.previous,
            next: this.list,
            remove() {
                node.previous.next = node.next
                node.next.previous = node.previous
            }
        }
        node.previous.next = node.next.previous = node
        return node
    },
    start() {
        this.list.previous = this.list.next = this.list
        window.requestAnimationFrame(now => {   
            this.last = now;
            window.requestAnimationFrame((t) => this.loop(t))
        })
    },
}

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
cursor.pen.setAttribute('stroke', 'black')
cursor.pen.setAttribute('stroke-width', '0.002')
cursor.pen.cx.baseVal.value = 0.5
cursor.pen.cy.baseVal.value = 0.5
cursor.pen.r.baseVal.value = 0.499
cursor.eraser.setAttribute('transform', 'rotate(45, 0.5, 0.5) translate(0.5, 0.356)')
cursor.eraser.setAttribute('stroke', 'white')
cursor.eraser.setAttribute('stroke-width', '0.03')
cursor.eraser.setAttribute('fill', 'none')
cursor.eraser.innerHTML = '<rect width="0.466" height="0.288" rx="0.05"/><line x1="0.12" y1="0" x2="0.12" y2="0.288"/><line x1="0.12" y1="0.088" x2="0.466" y2="0.088"/><line x1="0.12" y1="0.2" x2="0.466" y2="0.2"/>'
document.body.appendChild(cursor.svg)


////////// status //////////
const state = {
    /** @type {Mode} */
    mode: null,
    busy: false,
    /** @type {ACTION} */
    action: ACTION.NOTHING,
    lineWidth: 3,
    color: 'white',
    
    /** @type {MODE} */
    shape: MODE.SHAPE_RECTANGLE,
}

/** @type {{clientX: number, clientY: number, svgX: number, svgY: number}} */
const mouse = {};
document.addEventListener('mousemove', /** @type {MouseEvent} */ e => {
    mouse.clientX = e.clientX
    mouse.clientY = e.clientY
    // screen coordinte => svg coordinate
    mouse.svgX = bound.x + (e.clientX - matrix.e) / matrix.a;
    mouse.svgY = bound.y + (e.clientY - matrix.f) / matrix.d;
    cursor.matrix.e = e.clientX
    cursor.matrix.f = e.clientY
})

/** @template K, V */
class TwoWayMap {
    #map; #rmap;
    /** @type {Map<K, V>} */ #deleted;
    
    /** @param {Iterable<[K, V]>} i */
    constructor(i) {
        this.#map = new Map(i)
        this.#rmap = new Map([...i].map(([k, v]) => [v, k]))
        this.#deleted = new Map();
    }
    
    get(/** @type {K} */ key) { return this.#map.get(key) }
    rget(/** @type {V} */ key) { return this.#rmap.get(key) }
    set(/** @type {K} */ key, /** @type {V} */ value) { this.#map.set(key, value); this.#rmap.set(value, key) }
    pause(/** @type {K} */ key) {
        this.#deleted.set(key, this.#map.get(key))
        this.#rmap.delete(this.#map.get(key));
        this.#map.delete(key);
    }
    resume(/** @type {K} */ key) {
        const value = this.#deleted.get(key)
        this.#map.set(key, value)
        this.#rmap.set(value, key)
        this.#deleted.delete(key)
    }
}

////////// mode //////////
class Mode {
    // 可以只用單向Map<code, listener>? 透過listener(e)的e.code得知按鍵?
    static codeMap = new TwoWayMap([
        [this.modePen, 'Digit1'],
        [this.modeEraser, 'Digit2'],
        [this.panUp, 'KeyW'],
        [this.panDown, 'KeyS'],
        [this.panLeft, 'KeyA'],
        [this.panRight, 'KeyD'],
        [this.zoomIn, 'KeyE'],
        [this.zoomOut, 'KeyQ'],
        [this.undo, 'KeyZ'],
        [this.redo, 'KeyX'],
        [this.load, 'KeyI'],
        [this.save, 'KeyO'],
        [this.changeWidth, 'KeyG'],
        [this.changeColor, 'KeyF'],
    ])
    
    /** 
     * @param {{
     *    enter: () => void,
     *    exit: () => void,
     *    onMouseLeftDown: (e: MouseEvent) => void
     * }}
     */
    constructor({enter, exit, onMouseLeftDown}) {
        /** @type {() => void} */ this.enter = enter;
        /** @type {() => void} */ this.exit = exit;
        /** @type {(e: MouseEvent) => void} */ this.onMouseLeftDown = onMouseLeftDown;
    }
    
    static setMode(mode) {
        if (state.busy || state.mode === mode) return;
        state.mode.exit()
        state.mode = mode
        state.mode.enter()
    }
    
    /** @param {KeyboardEvent} e */
    static modePen(e) { Mode.setMode(penMode) }
    
    /** @param {KeyboardEvent} e */
    static modeEraser(e) { Mode.setMode(eraserMode) }
    
    /**
     * @param {string} code - KeyboardEvent.code
     * @param {(dt: number) => void} translate - execute in animation loop
     */
    static pan(code, translate) {
        const handler = this.codeMap.rget(code)
        this.codeMap.pause(handler)
        const node = animation.add(translate)
        
        const end = e => {
            if (e.code !== code) return;
            node.remove()
            document.removeEventListener('keyup', end)
            this.codeMap.resume(handler)
        }
        
        document.addEventListener('keyup', end)
    }
    
    /** @param {KeyboardEvent} e */
    static panUp(e) { Mode.pan(e.code, dt => matrix.f += dt) }
    
    /** @param {KeyboardEvent} e */
    static panDown(e) { Mode.pan(e.code, dt => matrix.f -= dt) }
    
    /** @param {KeyboardEvent} e */
    static panLeft(e) { Mode.pan(e.code, dt => matrix.e += dt) }
    
    /** @param {KeyboardEvent} e */
    static panRight(e) { Mode.pan(e.code, dt => matrix.e -= dt) }
    
    /**
     * @param {string} code - KeyboardEvent.code
     * @param {1 | -1} direction - in: 1, out: -1
     */
    static zoom(code, direction) {
        const handler = this.codeMap.rget(code)
        this.codeMap.pause(handler)
        
        const node = animation.add(dt => {
            const newScale = matrix.a * 1.004 ** (direction * dt);
            if (newScale < 0.2 || newScale > 100) return;
            matrix.a = matrix.d = newScale;
            matrix.e = mouse.clientX + (bound.x - mouse.svgX) * matrix.a
            matrix.f = mouse.clientY + (bound.y - mouse.svgY) * matrix.d
        })
        
        const end = e => {
            if (e.code !== code) return;
            node.remove()
            document.removeEventListener('keyup', end)
            this.codeMap.resume(handler)
        }
        
        document.addEventListener('keyup', end)
    }
    
    /** @param {KeyboardEvent} e */
    static zoomIn(e) { Mode.zoom(e.code, 1) }
    
    /** @param {KeyboardEvent} e */
    static zoomOut(e) { Mode.zoom(e.code, -1) }
    
    /** @param {KeyboardEvent} e */
    static undo(e) { if (!state.busy) commands.undo() }
    
    /** @param {KeyboardEvent} e */
    static redo(e) { if (!state.busy) commands.redo() }
    
    /** @param {KeyboardEvent} e */
    static save(e) {
        if (state.busy) return;
        
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
    
    /** @param {KeyboardEvent} e */
    static load(e) {
        if (state.busy) return;
        
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
    
    /** @param {KeyboardEvent} e */
    static changeWidth(e) {
        
    }
    
    /** @param {KeyboardEvent} e */
    static changeColor(e) {
        
    }
}

const penMode = new Mode({
    enter() {
        cursor.pen.setAttribute('fill', `${state.color}`)
        cursor.matrix.a = cursor.matrix.d = state.lineWidth * matrix.a
        cursor.svg.appendChild(cursor.pen)
    },
    exit() {
        cursor.pen.remove()
    },
    /** @param {MouseEvent} e */
    onMouseLeftDown(e) {
        if (state.busy) return;
        state.busy = true
        
        /** @type {SVGPolylineElement} */
        const polyline = document.createElementNS(NS_SVG, 'polyline');
        const points = polyline.points;
        polyline.setAttribute('stroke', state.color)
        polyline.setAttribute('stroke-width', state.lineWidth)
        
        let lastX = mouse.svgX, lastY = mouse.svgY;
        
        const point = svg.createSVGPoint()
        point.x = mouse.svgX
        point.y = mouse.svgY
        points.appendItem(point)
        svg.appendChild(polyline)
        
        /** @type {(e: MouseEvent) => void} */
        function onDraw(e) {
            const dx = (mouse.svgX - lastX) * matrix.a;
            const dy = (mouse.svgY - lastY) * matrix.d;
            if (dx * dx + dy * dy < 20) return;
            lastX = mouse.svgX
            lastY = mouse.svgY
            
            if (mouse.svgX < bound.x) {
                bound.x = mouse.svgX - 500;
                svg.width.baseVal.value = bound.width = bound.right - bound.x
                matrix.e = mouse.clientX + (bound.x - mouse.svgX) * matrix.a
            } else if (mouse.svgX > bound.right) {
                bound.right = mouse.svgX + 500;
                svg.width.baseVal.value = bound.width = bound.right - bound.x
            }
            if (mouse.svgY < bound.y) {
                bound.y = mouse.svgY - 500;
                svg.height.baseVal.value = bound.height = bound.bottom - bound.y
                matrix.f = mouse.clientY + (bound.y - mouse.svgY) * matrix.d
            } else if (mouse.svgY > bound.bottom) {
                bound.bottom = mouse.svgY + 500;
                svg.height.baseVal.value = bound.height = bound.bottom - bound.y
            }
            
            const point = svg.createSVGPoint()
            point.x = mouse.svgX
            point.y = mouse.svgY
            points.appendItem(point)
        }
        
        document.addEventListener('mousemove', onDraw)
        const node = animation.add(onDraw)
        
        document.addEventListener('mouseup', function end(e) {
            if (e.button !== 0) return;
            document.removeEventListener('mousemove', onDraw)
            node.remove()
            document.removeEventListener('mouseup', end)
            if (points.length === 1) points.appendItem(points.getItem(0))
            commands.push(new DrawCommand(polyline))
            state.busy = false
        })
    },
})

const eraserMode = new Mode({
    enter() {
        cursor.matrix.a = cursor.matrix.d = 50
        cursor.svg.appendChild(cursor.eraser)
        
        Mode.codeMap.pause(Mode.changeWidth)
        Mode.codeMap.pause(Mode.changeColor)
    },
    exit() {
        Mode.codeMap.resume(Mode.changeColor)
        Mode.codeMap.resume(Mode.changeWidth)
        
        cursor.eraser.remove()
    },
    onMouseLeftDown(e) {
        if (state.busy) return;
        state.busy = true
        
        /** @type {Array<SVGElement>} */
        const elements = [];
        /** @param {MouseEvent} e */
        function onErase(e) {
            if (e.target.tagName !== 'polyline') return;
            elements.push(e.target)
            e.target.remove()
        }
        
        svg.addEventListener('mouseover', onErase)
        
        document.addEventListener('mouseup', function end(e) {
            if (e.button !== 0) return;
            svg.removeEventListener('mouseover', onErase)
            document.removeEventListener('mouseup', end)
            if (elements.length) commands.push(new EraseCommand(elements))
            state.busy = false
        })
    },
})



////////// main //////////
document.addEventListener('keydown', e => Mode.codeMap.rget(e.code)?.(e))
document.addEventListener('mousedown', e => e.button === 0 && state.mode.onMouseLeftDown(e))
window.addEventListener('beforeunload', e => { if (DEBUG) return; e.preventDefault(); return ''; })
state.mode = penMode
state.mode.enter()
animation.start()











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
    
    function updateDebugInfo() {
        anchorPoint.style.left = `${matrix.e - bound.x * matrix.a}px`;
        anchorPoint.style.top = `${matrix.f - bound.y * matrix.d}px`;
        debug.innerHTML = `
            mouse.svgX: ${mouse.svgX?.toFixed(2)}<br>
            mouse.svgY: ${mouse.svgY?.toFixed(2)}<br>
            mouse.clientX: ${mouse.clientX?.toFixed(2)}<br>
            mouse.clientY: ${mouse.clientY?.toFixed(2)}<br>
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
    
    animation.add(updateDebugInfo)
}