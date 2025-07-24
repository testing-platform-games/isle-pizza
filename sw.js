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
    '/free_stuff_off.webp', '/free_stuff_on.webp', '/install_off.webp', '/install_on.webp',
    '/island.webp', '/isle.js', '/isle.wasm', '/poster.pdf', '/read_me_off.webp',
    '/read_me_on.webp', '/run_game_off.webp', '/run_game_on.webp', '/shark.webp',
    '/uninstall_off.webp', '/uninstall_on.webp', '/app.js', '/style.css', '/manifest.json',
    '/install.webp', '/install.mp3', '/downloader.js'
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

const textureFiles = [
    "/LEGO/textures/beach.gif.bmp", "/LEGO/textures/doctor.gif.bmp", "/LEGO/textures/infochst.gif.bmp",
    "/LEGO/textures/o.gif.bmp", "/LEGO/textures/relrel01.gif.bmp", "/LEGO/textures/rockx.gif.bmp",
    "/LEGO/textures/water2x.gif.bmp", "/LEGO/textures/bowtie.gif.bmp", "/LEGO/textures/e.gif.bmp",
    "/LEGO/textures/jfrnt.gif.bmp", "/LEGO/textures/papachst.gif.bmp", "/LEGO/textures/road1way.gif.bmp",
    "/LEGO/textures/sandredx.gif.bmp", "/LEGO/textures/w_curve.gif.bmp", "/LEGO/textures/brela_01.gif.bmp",
    "/LEGO/textures/flowers.gif.bmp", "/LEGO/textures/l6.gif.bmp", "/LEGO/textures/pebblesx.gif.bmp",
    "/LEGO/textures/road3wa2.gif.bmp", "/LEGO/textures/se_curve.gif.bmp", "/LEGO/textures/wnbars.gif.bmp",
    "/LEGO/textures/bth1chst.gif.bmp", "/LEGO/textures/fruit.gif.bmp", "/LEGO/textures/l.gif.bmp",
    "/LEGO/textures/pizcurve.gif.bmp", "/LEGO/textures/road3wa3.gif.bmp", "/LEGO/textures/shftchst.gif.bmp",
    "/LEGO/textures/bth2chst.gif.bmp", "/LEGO/textures/gasroad.gif.bmp", "/LEGO/textures/mamachst.gif.bmp",
    "/LEGO/textures/polbar01.gif.bmp", "/LEGO/textures/road3way.gif.bmp", "/LEGO/textures/tightcrv.gif.bmp",
    "/LEGO/textures/cheker01.gif.bmp", "/LEGO/textures/g.gif.bmp", "/LEGO/textures/mech.gif.bmp",
    "/LEGO/textures/polkadot.gif.bmp", "/LEGO/textures/road4way.gif.bmp", "/LEGO/textures/unkchst.gif.bmp",
    "/LEGO/textures/construct.gif.bmp", "/LEGO/textures/grassx.gif.bmp", "/LEGO/textures/nwcurve.gif.bmp",
    "/LEGO/textures/redskul.gif.bmp", "/LEGO/textures/roadstr8.gif.bmp", "/LEGO/textures/vest.gif.bmp"
];

const STATIC_CACHE_NAME = 'static-assets-v1';

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

const getLanguageCacheName = (language) => `game-assets-${language}`;

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

async function checkCacheStatus(language, hdTextures, client) {
    const cacheName = getLanguageCacheName(language);
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const cachedUrls = requests.map(req => new URL(req.url).pathname);
    let requiredFiles = gameFiles;
    if (hdTextures) {
        requiredFiles = requiredFiles.concat(textureFiles);
    }
    const missingFiles = requiredFiles.filter(file => !cachedUrls.includes(file));

    client.postMessage({
        action: 'cache_status',
        isInstalled: missingFiles.length === 0,
        missingFiles: missingFiles,
        language: language
    });
}

registerRoute(
    ({ url }) => coreAppFiles.includes(url.pathname),
    new StaleWhileRevalidate({
        cacheName: STATIC_CACHE_NAME,
    })
);

registerRoute(
    ({ url }) => url.pathname.startsWith('/LEGO/'),
    new LegoCacheStrategy()
);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            return cache.addAll(coreAppFiles);
        })
    );
    self.skipWaiting();
});

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
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.action) {
        switch (event.data.action) {
            case 'uninstall_language_pack':
                uninstallLanguagePack(event.data.language, event.source);
                break;
            case 'check_cache_status':
                checkCacheStatus(event.data.language, event.data.hdTextures, event.source);
                break;
        }
    }
});
