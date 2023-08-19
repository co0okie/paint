const canvas = new (function () {
    this.element = document.getElementById('main');
    this.element.width = 0;
    this.element.height = 0;
    
    this.context = this.element.getContext('2d');
    this.context.lineWidth = 3;
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.strokeStyle = 'white';
    
    // relative to screen
    this.originPoint = {x: 0, y: 0};
    // relative to originPoint
    this.bound = undefined;
    
    this.command = [];
    this.draw = function ([path, bound]) {
        // screen coordinte => origin coordinate
        path = path.map(([x, y]) => [x - this.originPoint.x, y - this.originPoint.y]);
        bound.left -= this.originPoint.x;
        bound.right -= this.originPoint.x;
        bound.top -= this.originPoint.y;
        bound.bottom -= this.originPoint.y;
        
        // first draw
        if (this.bound === undefined) {
            this.bound = bound;
            
            let lineWidth = this.context.lineWidth;
            let lineCap = this.context.lineCap;
            let lineJoin = this.context.lineJoin;
            let strokeStyle = this.context.strokeStyle;
            
            this.element.width = bound.right - bound.left;
            this.element.height = bound.bottom - bound.top;
            this.element.style.left = `${this.originPoint.x + bound.left}px`;
            this.element.style.top = `${this.originPoint.y + bound.top}px`;
            
            this.context.lineWidth = lineWidth;
            this.context.lineCap = lineCap;
            this.context.lineJoin = lineJoin;
            this.context.strokeStyle = strokeStyle;
            
            this.context.translate(-bound.left, -bound.top);
        }
        // out of bounds
        else if (bound.left < this.bound.left || bound.right > this.bound.right ||
                 bound.top < this.bound.top || bound.bottom > this.bound.bottom) {
            bound.left = Math.min(this.bound.left, bound.left);
            bound.right = Math.max(this.bound.right, bound.right);
            bound.top = Math.min(this.bound.top, bound.top);
            bound.bottom = Math.max(this.bound.bottom, bound.bottom);
            
            let newCanvas = document.createElement('canvas');
            newCanvas.width = bound.right - bound.left;
            newCanvas.height = bound.bottom - bound.top;
            newCanvas.id = this.element.id;
            newCanvas.style.left = `${this.originPoint.x + bound.left}px`;
            newCanvas.style.top = `${this.originPoint.y + bound.top}px`;
            
            let newContext = newCanvas.getContext('2d');
            newContext.lineWidth = this.context.lineWidth;
            newContext.lineCap = this.context.lineCap;
            newContext.lineJoin = this.context.lineJoin;
            newContext.strokeStyle = this.context.strokeStyle;
            newContext.translate(-bound.left, -bound.top);
            newContext.drawImage(canvas.element, this.bound.left, this.bound.top);
            
            this.bound = bound;
            canvas.element.replaceWith(newCanvas);
            this.element = newCanvas;
            this.context = newContext;
        }
        
        this.context.beginPath();
        this.context.moveTo(...path[0]);
        for (point of path) this.context.lineTo(...point);
        this.context.stroke();
        
        this.command.push(path)
    }
    this.translate = function (dx, dy) {
        this.originPoint.x += dx;
        this.originPoint.y += dy;
        if (this.bound !== undefined) {
            this.element.style.left = `${this.originPoint.x + this.bound.left}px`;
            this.element.style.top = `${this.originPoint.y + this.bound.top}px`;
        }
    }
})()

{ // add old mouse position in mousemove event
    let oldEvent = {};
    document.addEventListener('mousemove', e => {
        e.oldClientX = oldEvent.clientX;
        e.oldClientY = oldEvent.clientY;
        oldEvent = e;
    }, true)
}

// cast 'newaction' event if click, scroll or press any key
for (type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'wheel']) {
    document.addEventListener(type, e => document.dispatchEvent(new CustomEvent('newaction')));
}

// action shunt
document.addEventListener('mousedown', e => {
    switch (e.button) {
        case 0:
            onDrawStart(e);
            break;
        case 1:
            onDragStart(e);
            break;
    }
})

function onDrawStart(e) {
    const screenCanvas = document.createElement('canvas');
    document.body.appendChild(screenCanvas);
    screenCanvas.style.position = 'fixed'
    // screenCanvas.style.backgroundColor = '#ffffff33'
    screenCanvas.style.height = '100%';
    screenCanvas.style.width = '100%';
    screenCanvas.width = screenCanvas.offsetWidth;
    screenCanvas.height = screenCanvas.offsetHeight;
    
    const screenContext = screenCanvas.getContext('2d');
    screenContext.lineWidth = canvas.context.lineWidth;
    screenContext.strokeStyle = canvas.context.strokeStyle;
    screenContext.lineCap = 'round';
    screenContext.lineJoin = 'round';
    
    const bound = {left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY}
    const path = [[e.clientX, e.clientY]];
    function onDraw(e) {
        screenContext.beginPath();
        screenContext.moveTo(e.oldClientX, e.oldClientY);
        screenContext.lineTo(e.clientX, e.clientY);
        screenContext.stroke();
        
        if (e.clientX < bound.left) bound.left = e.clientX;
        else if (e.clientX > bound.right) bound.right = e.clientX;
        if (e.clientY < bound.top) bound.top = e.clientY;
        else if (e.clientY > bound.bottom) bound.bottom = e.clientY;
        
        path.push([e.clientX, e.clientY]);
    }
    document.addEventListener('mousemove', onDraw)
    
    document.addEventListener('newaction', e => {
        canvas.draw([path, bound]);
        screenCanvas.remove();
        document.removeEventListener('mousemove', onDraw);
    }, { once: true });
}

function onDragStart(e) {
    const onDrag = e => canvas.translate(e.clientX - e.oldClientX, e.clientY - e.oldClientY);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('newaction', e => document.removeEventListener('mousemove', onDrag));
}

{ // debug
    const debugInfo = document.getElementById('debug');
    
    const originPoint = document.createElement('div');
    originPoint.style.backgroundColor = 'red';
    originPoint.style.position = 'fixed';
    originPoint.style.width = '20px';
    originPoint.style.height = '20px';
    originPoint.style.borderRadius = '50%';
    document.body.appendChild(originPoint);
    
    function updateDebugInfo(e) {
        originPoint.style.left = `${canvas.originPoint.x}px`;
        originPoint.style.top = `${canvas.originPoint.y}px`;
        debugInfo.innerHTML = `
            pageX: ${e.pageX}<br>
            pageY: ${e.pageY}<br>
            clientX: ${e.clientX}<br>
            clientY: ${e.clientY}<br>
            transform: ${canvas.element.style.transform}<br>
            canvas.offsetWidth: ${canvas.element.offsetWidth}<br>
            canvas.offsetHeight: ${canvas.element.offsetHeight}<br>
            window.innerWidth: ${window.innerWidth}<br>
            window.innerHeight: ${window.innerHeight}<br>
            command.stack.length: ${canvas.command.length}<br>
        `;
    }
    
    document.addEventListener('mousemove', updateDebugInfo);
    document.addEventListener('mousedown', updateDebugInfo);
    document.addEventListener('mouseup', updateDebugInfo);
    document.addEventListener('wheel', updateDebugInfo);
}