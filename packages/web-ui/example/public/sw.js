const CACHE_NAME = 'pi-web-ui-v1';

// Assets to cache on install
const STATIC_ASSETS = [
	'/',
	'/index.html',
	// Bundles will be added dynamically by the build process
];

// Cache patterns for different asset types
const ASSET_PATTERNS = {
	// Cache-first: static assets that rarely change
	cacheFirst: [
		/\.(js|css|woff|woff2|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i,
	],
	// Network-first: API calls and dynamic content
	networkFirst: [
		/^\/api\//,
		/^\/socket\//,
	],
};

/**
 * Determine if a request should use cache-first or network-first strategy
 */
function getStrategy(request) {
	const url = new URL(request.url);

	for (const pattern of ASSET_PATTERNS.networkFirst) {
		if (pattern.test(url.pathname)) {
			return 'network-first';
		}
	}

	for (const pattern of ASSET_PATTERNS.cacheFirst) {
		if (pattern.test(url.pathname)) {
			return 'cache-first';
		}
	}

	// Default to network-first for unknown resources
	return 'network-first';
}

/**
 * Cache-first strategy: serve from cache, fall back to network
 */
async function cacheFirst(request) {
	const cache = await caches.open(CACHE_NAME);
	const cachedResponse = await cache.match(request);

	if (cachedResponse) {
		return cachedResponse;
	}

	const networkResponse = await fetch(request);
	cache.put(request, networkResponse.clone());
	return networkResponse;
}

/**
 * Network-first strategy: try network, fall back to cache
 */
async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME);

	try {
		const networkResponse = await fetch(request);

		// Cache successful responses
		if (networkResponse && networkResponse.status === 200) {
			cache.put(request, networkResponse.clone());
		}

		return networkResponse;
	} catch (error) {
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

/**
 * Install event: precache static assets
 */
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(STATIC_ASSETS))
			.then(() => self.skipWaiting())
	);
});

/**
 * Activate event: clean up old caches
 */
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

/**
 * Fetch event: handle requests based on strategy
 */
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip chrome-extension and other non-http requests
	if (!event.request.url.startsWith('http')) {
		return;
	}

	const strategy = getStrategy(event.request);

	if (strategy === 'cache-first') {
		event.respondWith(cacheFirst(event.request));
	} else {
		event.respondWith(networkFirst(event.request));
	}
});

/**
 * Message event: handle messages from clients
 */
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
	if (event.data && event.data.type === 'CLEAR_CACHE') {
		event.waitUntil(
			caches.delete(CACHE_NAME).then(() => {
				event.ports[0].postMessage({ success: true });
			})
		);
	}
});
