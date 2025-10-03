// utils/touchEvents.ts

// A variable to track the last touched element to ensure all synthetic events
// in a single gesture are dispatched on the same target.
let lastTouchTarget: EventTarget | null = null;

/**
 * Creates and dispatches a synthetic mouse event derived from a touch event.
 * @param {TouchEvent} touchEvent The original touch event.
 * @param {string} eventName The name of the mouse event to dispatch (e.g., 'mousedown').
 */
function dispatchMouseEvent(touchEvent: TouchEvent, eventName: string) {
    const touch = touchEvent.changedTouches[0];
    if (!touch) return;

    // Use the element that was initially touched for all subsequent events in the gesture.
    const target = lastTouchTarget || touch.target;
    if (!target) return;

    const mouseEvent = new MouseEvent(eventName, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        ctrlKey: touchEvent.ctrlKey,
        altKey: touchEvent.altKey,
        shiftKey: touchEvent.shiftKey,
        metaKey: touchEvent.metaKey,
        button: 0, // Main button (left mouse button)
        buttons: 1,
        relatedTarget: null,
    });

    target.dispatchEvent(mouseEvent);
}

function handleTouchStart(e: TouchEvent) {
    // Store the initial target to ensure consistent event dispatching for the gesture.
    if (e.touches.length === 1) {
        lastTouchTarget = e.touches[0].target;
        dispatchMouseEvent(e, 'mousedown');
    }
}

function handleTouchMove(e: TouchEvent) {
    // This function intentionally does NOT call preventDefault(), allowing native
    // browser scrolling to work. Specific components opt-out of scrolling using
    // the 'touch-action: none' CSS property.
    if (e.touches.length === 1) {
        dispatchMouseEvent(e, 'mousemove');
    }
}

function handleTouchEnd(e: TouchEvent) {
    dispatchMouseEvent(e, 'mouseup');
    // Clean up the target after the gesture ends.
    lastTouchTarget = null;
}

function handleTouchCancel(e: TouchEvent) {
    dispatchMouseEvent(e, 'mouseup'); // Treat cancel as releasing the mouse.
    lastTouchTarget = null;
}

/**
 * Initializes the touch-to-mouse event bridge.
 * This should be called once when the application starts.
 */
export function initTouchEventBridge() {
    // Check if the bridge is already initialized to prevent duplicate listeners.
    if ((window as any).__touchEventBridgeInitialized) {
        return;
    }

    // All listeners are now passive, allowing the browser to handle scrolling
    // unless an element explicitly opts out with `touch-action: none`.
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    
    (window as any).__touchEventBridgeInitialized = true;
}