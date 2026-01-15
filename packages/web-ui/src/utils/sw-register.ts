/**
 * Service worker registration utility for offline asset caching
 */

export type ServiceWorkerMessageType = "SKIP_WAITING" | "CLEAR_CACHE";

export interface ServiceWorkerMessage {
	type: ServiceWorkerMessageType;
}

export interface ServiceWorkerResponse {
	success: boolean;
}

/**
 * Register the service worker for asset caching
 * @returns ServiceWorkerRegistration or null if not supported/failed
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if ("serviceWorker" in navigator) {
		try {
			const registration = await navigator.serviceWorker.register("/sw.js");

			// Handle updates
			registration.addEventListener("updatefound", () => {
				const newWorker = registration.installing;
				if (newWorker) {
					newWorker.addEventListener("statechange", () => {
						if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
							// New version available
							console.log("[ServiceWorker] New version available");
						}
					});
				}
			});

			console.log("[ServiceWorker] Registered successfully");
			return registration;
		} catch (error) {
			console.warn("[ServiceWorker] Registration failed:", error);
			return null;
		}
	}
	console.warn("[ServiceWorker] Not supported in this browser");
	return null;
}

/**
 * Unregister the service worker
 * @returns true if unregistered or never registered
 */
export async function unregisterServiceWorker(): Promise<boolean> {
	if ("serviceWorker" in navigator) {
		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister()));
			console.log("[ServiceWorker] Unregistered successfully");
			return true;
		} catch (error) {
			console.warn("[ServiceWorker] Unregistration failed:", error);
			return false;
		}
	}
	return true;
}

/**
 * Check if a service worker is active
 * @returns true if a service worker is controlling the page
 */
export function isServiceWorkerActive(): boolean {
	return "serviceWorker" in navigator && navigator.serviceWorker.controller !== null;
}

/**
 * Send a message to the active service worker
 * @param message The message to send
 * @returns Promise resolving when the message is handled
 */
export async function sendMessageToServiceWorker(message: ServiceWorkerMessage): Promise<ServiceWorkerResponse | null> {
	if (!isServiceWorkerActive()) {
		console.warn("[ServiceWorker] No active service worker");
		return null;
	}

	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (event) => {
			resolve(event.data as ServiceWorkerResponse);
		};

		navigator.serviceWorker.controller?.postMessage(message, [channel.port2]);

		// Timeout after 5 seconds
		setTimeout(() => {
			resolve({ success: false });
		}, 5000);
	});
}

/**
 * Force the waiting service worker to become active
 * @returns true if skip waiting was triggered
 */
export async function activateWaitingServiceWorker(): Promise<boolean> {
	if (!("serviceWorker" in navigator)) {
		return false;
	}

	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration || !registration.waiting) {
		console.log("[ServiceWorker] No waiting service worker");
		return false;
	}

	const response = await sendMessageToServiceWorker({ type: "SKIP_WAITING" });
	return response?.success ?? false;
}

/**
 * Clear all caches
 * @returns true if cache was cleared
 */
export async function clearServiceWorkerCache(): Promise<boolean> {
	const response = await sendMessageToServiceWorker({ type: "CLEAR_CACHE" });
	return response?.success ?? false;
}
