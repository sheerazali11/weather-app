// Service Worker for WeatherSphere PWA
const CACHE_NAME = 'weathersphere-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event with cache-first strategy
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API requests (they should always be fresh)
    if (event.request.url.includes('open-meteo.com')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache successful API responses for 5 minutes
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseClone);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For static assets, use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-weather-data') {
        event.waitUntil(syncWeatherData());
    }
});

async function syncWeatherData() {
    // Get stored locations
    const recentLocations = await getStoredLocations();

    // Fetch weather for each location
    for (const location of recentLocations) {
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true`
            );

            if (response.ok) {
                const data = await response.json();

                // Store in IndexedDB
                await storeWeatherData(location.id, data);

                // Send notification if there are weather alerts
                if (data.alerts && data.alerts.length > 0) {
                    self.registration.showNotification('Weather Alert', {
                        body: `Alert for ${location.name}`,
                        icon: '/icons/icon-192.png',
                        tag: 'weather-alert'
                    });
                }
            }
        } catch (error) {
            console.log('Failed to sync weather for:', location.name, error);
        }
    }
}

// Helper functions for IndexedDB
async function getStoredLocations() {
    return new Promise((resolve) => {
        const request = indexedDB.open('WeatherSphereDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('locations')) {
                db.createObjectStore('locations', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('weatherData')) {
                db.createObjectStore('weatherData', { keyPath: 'locationId' });
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['locations'], 'readonly');
            const store = transaction.objectStore('locations');
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                resolve(getAllRequest.result);
            };

            getAllRequest.onerror = () => {
                resolve([]);
            };
        };

        request.onerror = () => {
            resolve([]);
        };
    });
}

async function storeWeatherData(locationId, data) {
    return new Promise((resolve) => {
        const request = indexedDB.open('WeatherSphereDB', 1);

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['weatherData'], 'readwrite');
            const store = transaction.objectStore('weatherData');

            const weatherData = {
                locationId: locationId,
                data: data,
                timestamp: Date.now()
            };

            const putRequest = store.put(weatherData);

            putRequest.onsuccess = () => {
                resolve(true);
            };

            putRequest.onerror = () => {
                resolve(false);
            };
        };

        request.onerror = () => {
            resolve(false);
        };
    });
}

// Push notifications
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || 'Weather update available',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'weather-update',
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'WeatherSphere', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});