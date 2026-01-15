import type { Toast, ToastVariant } from "../components/Toast.js";

export interface ToastOptions {
	message: string;
	variant?: ToastVariant;
	duration?: number; // ms, default 3000
}

let toastContainer: HTMLElement | null = null;
const toasts: Map<string, Toast> = new Map();

function ensureContainer(): HTMLElement {
	if (!toastContainer || !document.body.contains(toastContainer)) {
		toastContainer = document.createElement("div");
		toastContainer.id = "pi-toast-container";
		toastContainer.className =
			"fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center gap-2 p-4 pointer-events-none";
		document.body.appendChild(toastContainer);
	}
	return toastContainer;
}

export function showToast(options: ToastOptions | string): void {
	const opts = typeof options === "string" ? { message: options } : options;
	const container = ensureContainer();

	const toast = document.createElement("pi-toast") as Toast;
	toast.message = opts.message;
	toast.variant = opts.variant ?? "info";
	toast.duration = opts.duration ?? 3000;
	toast.visible = false;
	toast.className = "pointer-events-auto";

	const id = crypto.randomUUID();
	toasts.set(id, toast);

	toast.onClose = () => {
		toast.visible = false;
		setTimeout(() => {
			if (container.contains(toast)) {
				container.removeChild(toast);
			}
			toasts.delete(id);
		}, 300);
	};

	container.appendChild(toast);

	// Trigger animation on next frame
	requestAnimationFrame(() => {
		toast.visible = true;
	});
}

export function dismissAllToasts(): void {
	for (const toast of toasts.values()) {
		if (toast.onClose) {
			toast.onClose();
		}
	}
}
