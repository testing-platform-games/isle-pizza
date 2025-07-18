importScripts('/workbox/workbox-sw.js');

workbox.setConfig({
    modulePathPrefix: '/workbox/'
});

const { registerRoute } = workbox.routing;
const { StaleWhileRevalidate, CacheFirst, Strategy } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { RangeRequestsPlugin } = workbox.rangeRequests;

const coreAppFiles = [
    '/', '/index.html', '/cancel_off.webp', '/cancel_on.webp', '/cdspin.gif',
    '/configure_off.webp', '/configure_on.webp', '/favicon.png', '/favicon.svg',
    '/free_stuff_off.webp', '/free_stuff_on.webp', '/install.mp4', '/install_off.webp',
    '/install_on.webp', '/install.webm', '/island.webp', '/isle.js', '/isle.wasm',
    '/poster.pdf', '/read_me_off.webp', '/read_me_on.webp', '/run_game_off.webp',
    '/run_game_on.webp', '/shark.webp', '/uninstall_off.webp', '/uninstall_on.webp',
    'app.js', 'style.css', 'manifest.json'
];

const gameFiles = [
    "/LEGO/Scripts/CREDITS.SI", "/LEGO/Scripts/INTRO.SI", "/LEGO/Scripts/NOCD.SI", "/LEGO/Scripts/SNDANIM.SI",
    "/LEGO/Scripts/Act2/ACT2MAIN.SI", "/LEGO/Scripts/Act3/ACT3.SI", "/LEGO/Scripts/Build/COPTER.SI",
    "/LEGO/Scripts/Build/DUNECAR.SI", "/LEGO/Scripts/Build/JETSKI.SI", "/LEGO/Scripts/Build/RACECAR.SI",
    "/LEGO/Scripts/Garage/GARAGE.SI", "/LEGO/Scripts/Hospital/HOSPITAL.SI", "/LEGO/Scripts/Infocntr/ELEVBOTT.SI",
    "/LEGO/Scripts/Infocntr/HISTBOOK.SI", "/LEGO/Scripts/Infocntr/INFODOOR.SI", "/LEGO/Scripts/Infocntr/INFOMAIN.SI",
    "/LEGO/Scripts/Infocntr/INFOSCOR.SI", "/LEGO/Scripts/Infocntr/REGBOOK.SI", "/LEGO/Scripts/Isle/ISLE.SI",
    "/LEGO/Scripts/Isle/JUKEBOX.SI", "/LEGO/Scripts/Isle/JUKEBOXW.SI", "/LEGO/Scripts/Police/POLICE.SI",
    "/LEGO/Scripts/Race/CARRACE.SI", "/LEGO/Scripts/Race/CARRACER.SI", "/LEGO/Scripts/Race/JETRACE.SI",
    "/LEGO/Scripts/Race/JETRACER.SI", "/LEGO/data/WORLD.WDB"
];

const STATIC_CACHE_NAME = 'static-assets-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            return cache.addAll(coreAppFiles);
        })
    );
    self.skipWaiting();
});

registerRoute(
    ({ url }) => coreAppFiles.includes(url.pathname),
    new StaleWhileRevalidate({
        cacheName: STATIC_CACHE_NAME,
    })
);

const rangeRequestsPlugin = new RangeRequestsPlugin();
const normalizePathPlugin = {
    cacheKeyWillBeUsed: async ({ request }) => {
        const url = new URL(request.url);
        const normalizedPath = url.pathname.replace(/\/{2,}/g, '/');
        const normalizedUrl = url.origin + normalizedPath;
        if (request.url === normalizedUrl) {
            return request;
        }
        return new Request(normalizedUrl, {
            headers: request.headers, method: request.method,
            credentials: request.credentials, redirect: request.redirect,
            referrer: request.referrer, body: request.body,
        });
    },
};

class LegoCacheStrategy extends Strategy {
    async _handle(request, handler) {
        const cacheKeyRequest = await normalizePathPlugin.cacheKeyWillBeUsed({ request });
        const cachedResponse = await caches.match(cacheKeyRequest);

        if (cachedResponse) {
            return await rangeRequestsPlugin.cachedResponseWillBeUsed({
                request: cacheKeyRequest,
                cachedResponse: cachedResponse,
            });
        }

        return handler.fetch(request);
    }
}

registerRoute(
    ({ url }) => url.pathname.startsWith('/LEGO/'),
    new LegoCacheStrategy()
);

self.addEventListener('message', (event) => {
    if (event.data && event.data.action) {
        switch (event.data.action) {
            case 'install_language_pack':
                installLanguagePack(event.data.language, event.source);
                break;
            case 'uninstall_language_pack':
                uninstallLanguagePack(event.data.language, event.source);
                break;
            case 'check_cache_status':
                checkCacheStatus(event.data.language, event.source);
                break;
        }
    }
});

const getLanguageCacheName = (language) => `game-assets-${language}`;

async function installLanguagePack(language, client) {
    const THROTTLE_MS = 100;
    const cacheName = getLanguageCacheName(language);

    try {
        const fileMetadataPromises = gameFiles.map(fileUrl =>
            fetch(fileUrl, { method: 'HEAD', headers: { 'Accept-Language': language } })
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to HEAD ${fileUrl}`);
                    return { url: fileUrl, size: Number(response.headers.get('content-length')) || 0 };
                })
        );
        const fileMetadata = await Promise.all(fileMetadataPromises);
        const totalBytesToDownload = fileMetadata.reduce((sum, file) => sum + file.size, 0);
        let bytesDownloaded = 0;
        let lastProgressUpdate = 0;

        const cache = await caches.open(cacheName);

        for (const file of fileMetadata) {
            const request = new Request(file.url, { headers: { 'Accept-Language': language } });

            try {
                const response = await fetch(request);

                if (!response.ok || !response.body) {
                    throw new Error(`Failed to fetch ${file.url}`);
                }

                const [streamForCaching, streamForProgress] = response.body.tee();

                const responseToCache = new Response(streamForCaching, response);
                const cachePromise = cache.put(request, responseToCache);

                const reader = streamForProgress.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    bytesDownloaded += value.length;
                    const now = Date.now();

                    if (now - lastProgressUpdate > THROTTLE_MS) {
                        lastProgressUpdate = now;
                        client.postMessage({
                            action: 'install_progress',
                            progress: (bytesDownloaded / totalBytesToDownload) * 100,
                            language: language
                        });
                    }
                }

                await cachePromise;
            } catch (error) {
                console.error("Aborting installation due to a persistent error:", error);
                await caches.delete(cacheName);
                client.postMessage({ action: 'install_failed', language: language });
            }
        }

        client.postMessage({
            action: 'install_progress',
            progress: 100,
            language: language
        });
        client.postMessage({ action: 'install_complete', success: true, language: language });
    } catch (error) {
        console.error('Error during language pack installation:', error);
        client.postMessage({ action: 'install_failed', success: false, language: language, error: error.message });
    }
}

async function uninstallLanguagePack(language, client) {
    const cacheName = getLanguageCacheName(language);
    try {
        const deleted = await caches.delete(cacheName);
        if (deleted) {
            console.log(`Cache ${cacheName} deleted successfully.`);
        }
        client.postMessage({ action: 'uninstall_complete', success: deleted, language: language });
    } catch (error) {
        console.error('Error during language pack uninstallation:', error);
        client.postMessage({ action: 'uninstall_complete', success: false, language: language, error: error.message });
    }
}

async function checkCacheStatus(language, client) {
    const cacheName = getLanguageCacheName(language);
    const hasCache = await caches.has(cacheName);
    client.postMessage({ action: 'cache_status', exists: hasCache, language: language });
}

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName.startsWith('static-assets-') && cacheName !== STATIC_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
