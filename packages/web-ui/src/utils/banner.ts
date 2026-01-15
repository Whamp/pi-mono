import type { Banner, BannerOptions } from "../components/Banner.js";

let bannerContainer: HTMLElement | null = null;
const banners: Map<string, Banner> = new Map();

function ensureContainer(): HTMLElement {
	if (!bannerContainer || !document.body.contains(bannerContainer)) {
		bannerContainer = document.createElement("div");
		bannerContainer.id = "pi-banner-container";
		bannerContainer.className = "fixed top-0 left-0 right-0 z-40";
		document.body.appendChild(bannerContainer);
	}
	return bannerContainer;
}

export function showBanner(options: BannerOptions): string {
	const container = ensureContainer();

	// Check for existing banner with same ID (deduplication)
	if (options.id) {
		const existingBanner = banners.get(options.id);
		if (existingBanner) {
			// Update existing banner
			existingBanner.message = options.message;
			existingBanner.variant = options.variant ?? "info";
			existingBanner.actionLabel = options.actionLabel ?? "";
			existingBanner.onAction = options.onAction;
			existingBanner.onDismiss = options.onDismiss;
			return options.id;
		}
	}

	const banner = document.createElement("pi-banner") as Banner;
	banner.message = options.message;
	banner.variant = options.variant ?? "info";
	banner.actionLabel = options.actionLabel ?? "";
	banner.onAction = options.onAction;

	const id = options.id ?? crypto.randomUUID();

	const dismissHandler = options.onDismiss;
	banner.onDismiss = () => {
		if (container.contains(banner)) {
			container.removeChild(banner);
		}
		banners.delete(id);
		if (dismissHandler) {
			dismissHandler();
		}
	};

	banners.set(id, banner);
	container.appendChild(banner);

	return id;
}

export function dismissBanner(id: string): void {
	const banner = banners.get(id);
	banner?.onDismiss?.();
}

export function dismissAllBanners(): void {
	for (const banner of banners.values()) {
		if (banner.onDismiss) {
			banner.onDismiss();
		}
	}
}
