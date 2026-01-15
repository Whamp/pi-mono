/**
 * Swipe gesture detection utilities for touch devices.
 */

export interface SwipeOptions {
	/** Minimum distance in pixels to trigger a swipe (default: 50px) */
	threshold?: number;
	/** Edge detection zone width in pixels (default: 20px) */
	edgeWidth?: number;
	/** Direction of swipe to detect */
	direction: "left" | "right" | "up" | "down";
	/** Callback when swipe is detected */
	onSwipe: () => void;
	/** Only trigger if swipe started from this edge */
	fromEdge?: "left" | "right" | "top" | "bottom";
}

export interface SwipeHandler {
	/** Attach the handler to an element */
	attach(element: HTMLElement): void;
	/** Detach the handler and clean up event listeners */
	detach(): void;
}

/**
 * Creates a swipe gesture handler that can be attached to an element.
 *
 * @example
 * ```ts
 * const handler = createSwipeHandler({
 *   direction: 'right',
 *   fromEdge: 'left',
 *   onSwipe: () => openSidebar()
 * });
 * handler.attach(document.body);
 * // Later: handler.detach();
 * ```
 */
export function createSwipeHandler(options: SwipeOptions): SwipeHandler {
	const threshold = options.threshold ?? 50;
	const edgeWidth = options.edgeWidth ?? 20;

	let startX = 0;
	let startY = 0;
	let isValidStart = false;
	let element: HTMLElement | null = null;

	const onTouchStart = (e: TouchEvent) => {
		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;

		// Check if started from required edge
		if (options.fromEdge) {
			switch (options.fromEdge) {
				case "left":
					isValidStart = startX <= edgeWidth;
					break;
				case "right":
					isValidStart = startX >= window.innerWidth - edgeWidth;
					break;
				case "top":
					isValidStart = startY <= edgeWidth;
					break;
				case "bottom":
					isValidStart = startY >= window.innerHeight - edgeWidth;
					break;
			}
		} else {
			isValidStart = true;
		}
	};

	const onTouchEnd = (e: TouchEvent) => {
		if (!isValidStart) return;

		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - startX;
		const deltaY = touch.clientY - startY;

		// Ensure the primary direction matches (horizontal vs vertical)
		const isHorizontal = options.direction === "left" || options.direction === "right";
		const isVertical = options.direction === "up" || options.direction === "down";

		if (isHorizontal && Math.abs(deltaY) > Math.abs(deltaX)) return;
		if (isVertical && Math.abs(deltaX) > Math.abs(deltaY)) return;

		// Check if swipe meets threshold in the correct direction
		switch (options.direction) {
			case "right":
				if (deltaX >= threshold) options.onSwipe();
				break;
			case "left":
				if (deltaX <= -threshold) options.onSwipe();
				break;
			case "down":
				if (deltaY >= threshold) options.onSwipe();
				break;
			case "up":
				if (deltaY <= -threshold) options.onSwipe();
				break;
		}
	};

	return {
		attach(el: HTMLElement) {
			element = el;
			element.addEventListener("touchstart", onTouchStart, { passive: true });
			element.addEventListener("touchend", onTouchEnd, { passive: true });
		},
		detach() {
			if (element) {
				element.removeEventListener("touchstart", onTouchStart);
				element.removeEventListener("touchend", onTouchEnd);
				element = null;
			}
		},
	};
}
