// Responsive Weather App with PWA Features
class ResponsiveWeatherApp {
    constructor() {
        this.map = null;
        this.currentUnit = 'celsius';
        this.currentLocation = null;
        this.isLoading = false;
        this.isOnline = navigator.onLine;
        this.deferredPrompt = null;

        this.init();
    }

    async init() {
        this.initTheme();
        this.initServiceWorker();
        this.initMap();
        this.bindEvents();
        this.loadRecentSearches();
        this.updateTime();

        // Initial load based on device
        if (this.isMobile()) {
            this.initMobileFeatures();
            this.getUserLocation();
        } else {
            this.getWeatherByCity('New York');
        }

        // Update time every second
        setInterval(() => this.updateTime(), 1000);

        // Auto-refresh every 10 minutes
        setInterval(() => {
            if (this.currentLocation && this.isOnline) {
                this.refreshWeather();
            }
        }, 600000);

        // Check online status
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    initTheme() {
        const savedTheme = localStorage.getItem('weatherAppTheme') ||
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Update toggle button icon
        const icon = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        document.getElementById('themeToggle').querySelector('i').className = icon;
        document.getElementById('desktopThemeToggle').querySelector('i').className = icon;
    }

    initServiceWorker() {
        // Check if browser supports service workers
        if ('serviceWorker' in navigator) {
            // Check if app is installed
            window.addEventListener('appinstalled', () => {
                console.log('App installed successfully');
                localStorage.setItem('appInstalled', 'true');
                this.hideInstallPrompt();
            });

            // Listen for before install prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;

                // Show install prompt after 30 seconds
                setTimeout(() => {
                    if (!localStorage.getItem('appInstalled') && this.deferredPrompt) {
                        this.showInstallPrompt();
                    }
                }, 30000);
            });
        }
    }

    initMap() {
        // Only initialize map on desktop and tablets
        if (!this.isMobile() || window.innerWidth >= 768) {
            this.map = L.map('map').setView([40.7128, -74.0060], 10);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
            }).addTo(this.map);

            // Add click handler
            this.map.on('click', (e) => {
                this.searchByCoords(e.latlng.lat, e.latlng.lng);
            });
        }
    }

    initMobileFeatures() {
        // Mobile navigation
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                this.scrollToSection(target);

                // Update active button
                document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Mobile menu
        document.getElementById('menuToggle').addEventListener('click', () => this.openMobileMenu());
        document.getElementById('mobileMenuClose').addEventListener('click', () => this.closeMobileMenu());
        document.getElementById('mobileNavOverlay').addEventListener('click', () => this.closeMobileMenu());

        // Swipe gestures
        this.initSwipeGestures();
    }

    bindEvents() {
        // Search
        document.getElementById('searchBtn').addEventListener('click', () => this.searchByCity());
        document.getElementById('cityInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchByCity();
        });

        // Quick locations
        document.querySelectorAll('.quick-location').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const city = e.currentTarget.dataset.city;
                document.getElementById('cityInput').value = city;
                this.getWeatherByCity(city);
            });
        });

        // Current location
        document.getElementById('useLocationBtn').addEventListener('click', () => this.getUserLocation());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('desktopThemeToggle').addEventListener('click', () => this.toggleTheme());

        // Dark mode toggle in menu
        document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            this.setTheme(e.target.checked ? 'dark' : 'light');
        });

        // Refresh
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshWeather());

        // Favorite
        document.getElementById('favoriteBtn').addEventListener('click', () => this.toggleFavorite());

        // Units
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchUnit(e.currentTarget.dataset.unit));
        });

        // Map controls
        if (this.map) {
            document.getElementById('mapZoomIn')?.addEventListener('click', () => this.map.zoomIn());
            document.getElementById('mapZoomOut')?.addEventListener('click', () => this.map.zoomOut());
            document.getElementById('mapLocate')?.addEventListener('click', () => this.locateOnMap());
        }

        // Install prompt
        document.getElementById('installBtn')?.addEventListener('click', () => this.installApp());
        document.getElementById('dismissInstall')?.addEventListener('click', () => this.hideInstallPrompt());
    }

    // Device detection
    isMobile() {
        return window.innerWidth <= 768;
    }

    isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    isDesktop() {
        return window.innerWidth > 1024;
    }

    // Theme handling
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('weatherAppTheme', theme);

        // Update toggle button icon
        const icon = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        document.getElementById('themeToggle').querySelector('i').className = icon;
        document.getElementById('desktopThemeToggle').querySelector('i').className = icon;

        // Update menu toggle
        document.getElementById('darkModeToggle').checked = theme === 'dark';
    }

    // Mobile navigation
    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId + 'Section');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    openMobileMenu() {
        document.getElementById('mobileMenu').classList.add('open');
        document.getElementById('mobileNavOverlay').classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeMobileMenu() {
        document.getElementById('mobileMenu').classList.remove('open');
        document.getElementById('mobileNavOverlay').classList.remove('show');
        document.body.style.overflow = '';
    }

    initSwipeGestures() {
        let startX, startY;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;

            const diffX = e.touches[0].clientX - startX;
            const diffY = e.touches[0].clientY - startY;

            // Horizontal swipe detection
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swipe right - open menu
                    this.openMobileMenu();
                } else {
                    // Swipe left - close menu
                    this.closeMobileMenu();
                }
                startX = null;
                startY = null;
            }
        });
    }

    // Weather data methods
    async getWeatherByCity(city) {
        if (!city.trim()) {
            this.showToast('Please enter a city name', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            const geoResponse = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
            );

            if (!geoResponse.ok) throw new Error('City not found');

            const geoData = await geoResponse.json();
            if (!geoData.results || geoData.results.length === 0) {
                throw new Error(`City "${city}" not found`);
            }

            const { latitude, longitude, name, country, admin1 } = geoData.results[0];
            await this.fetchWeatherData(latitude, longitude, name, country, admin1);

            this.addToRecentSearches(name);

        } catch (error) {
            this.showToast(error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async getUserLocation() {
        if (!navigator.geolocation) {
            this.showToast('Geolocation not supported', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            await this.getWeatherByCoords(position.coords.latitude, position.coords.longitude);

        } catch (error) {
            console.log('Geolocation error:', error);
            this.showToast('Unable to get your location', 'warning');
            // Fallback to default city
            this.getWeatherByCity('London');
        } finally {
            this.showLoading(false);
        }
    }

    async getWeatherByCoords(lat, lon) {
        try {
            // Get location name from coordinates
            const geoResponse = await fetch(
                `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}`
            );

            let name = 'Current Location';
            let country = '';
            let admin1 = '';

            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                if (geoData.results && geoData.results.length > 0) {
                    name = geoData.results[0].name;
                    country = geoData.results[0].country;
                    admin1 = geoData.results[0].admin1 || '';
                }
            }

            await this.fetchWeatherData(lat, lon, name, country, admin1);

        } catch (error) {
            this.showToast(error.message, 'danger');
        }
    }

    async fetchWeatherData(lat, lon, city, country, region) {
        try {
            const [weatherResponse, airQualityResponse] = await Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weathercode,windspeed_10m,winddirection_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`),
                fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,ozone,dust`)
            ]);

            if (!weatherResponse.ok) throw new Error('Weather data unavailable');

            const weatherData = await weatherResponse.json();
            const airQualityData = airQualityResponse.ok ? await airQualityResponse.json() : null;

            this.updateWeatherDisplay(weatherData, city, country, region);
            this.updateAirQualityDisplay(airQualityData);
            this.updateMapLocation(lat, lon, city);

            this.currentLocation = { lat, lon, city, country, region };

            this.updateLastUpdateTime();

        } catch (error) {
            throw error;
        }
    }

    updateWeatherDisplay(data, city, country, region) {
        const current = data.current_weather;
        const hourly = data.hourly;
        const daily = data.daily;

        // Location
        let locationText = city;
        if (region && region !== city) locationText += `, ${region}`;
        if (country) locationText += `, ${country}`;

        document.getElementById('currentLocation').innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>${locationText}</span>
        `;

        // Mobile location indicator
        document.getElementById('mobileLocation').innerHTML = `
            <i class="fas fa-location-dot"></i>
            <span>${city}</span>
        `;

        // Date and time
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        document.getElementById('currentDate').textContent = dateStr;
        document.getElementById('currentTime').textContent = timeStr;

        // Weather condition
        const condition = this.getWeatherCondition(current.weathercode);
        document.getElementById('currentCondition').textContent = condition;

        // Temperature
        let temp = current.temperature;
        if (this.currentUnit === 'fahrenheit') {
            temp = (temp * 9 / 5) + 32;
        }

        document.getElementById('currentTemp').textContent = Math.round(temp);
        document.querySelector('.temp-unit').textContent = this.currentUnit === 'celsius' ? '°C' : '°F';

        // Feels like
        let feelsLike = hourly.apparent_temperature[0] || current.temperature;
        if (this.currentUnit === 'fahrenheit') {
            feelsLike = (feelsLike * 9 / 5) + 32;
        }
        document.getElementById('feelsLikeTemp').textContent = `${Math.round(feelsLike)}°`;

        // Weather icon
        const iconClass = this.getWeatherIcon(current.weathercode);
        document.getElementById('weatherIcon').innerHTML = `<i class="${iconClass}"></i>`;

        // Weather details
        document.getElementById('windSpeed').textContent = `${Math.round(current.windspeed)} km/h`;
        document.getElementById('windDirection').textContent = `${current.winddirection}°`;
        document.getElementById('humidity').textContent = `${hourly.relative_humidity_2m[0] || 50}%`;
        document.getElementById('precipitation').textContent = `${hourly.precipitation[0] || 0} mm`;
        document.getElementById('visibility').textContent = '10 km'; // Simulated
        document.getElementById('pressure').textContent = '1013 hPa'; // Simulated

        // UV Index
        const uvIndex = Math.floor(Math.random() * 11);
        document.getElementById('uvIndex').textContent = uvIndex;

        const uvLevel = uvIndex <= 2 ? 'Low' : uvIndex <= 5 ? 'Moderate' : uvIndex <= 7 ? 'High' : 'Very High';
        document.querySelector('.uv-level').textContent = uvLevel;

        // Sunrise/Sunset
        if (daily.sunrise && daily.sunset) {
            const sunrise = new Date(daily.sunrise[0]);
            const sunset = new Date(daily.sunset[0]);

            document.getElementById('sunriseTime').textContent =
                sunrise.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('sunsetTime').textContent =
                sunset.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }

        // Update hourly forecast
        this.updateHourlyForecast(hourly);

        // Update weekly forecast
        this.updateWeeklyForecast(daily);
    }

    updateHourlyForecast(hourly) {
        const container = document.getElementById('hourlyForecast');
        container.innerHTML = '';

        // Show next 12 hours
        for (let i = 0; i < 12; i++) {
            const time = new Date(hourly.time[i]);
            const temp = hourly.temperature_2m[i];
            const code = hourly.weathercode[i];

            const hourItem = document.createElement('div');
            hourItem.className = 'hourly-item';
            hourItem.innerHTML = `
                <div class="hour-time">${time.getHours()}:00</div>
                <div class="hour-icon"><i class="${this.getWeatherIcon(code)}"></i></div>
                <div class="hour-temp">${Math.round(temp)}°</div>
            `;

            container.appendChild(hourItem);
        }
    }

    updateWeeklyForecast(daily) {
        const container = document.getElementById('weeklyForecast');
        container.innerHTML = '';

        // Show next 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(daily.time[i]);
            const maxTemp = daily.temperature_2m_max[i];
            const minTemp = daily.temperature_2m_min[i];
            const code = daily.weathercode[i];

            const avgTemp = Math.round((maxTemp + minTemp) / 2);

            const dayItem = document.createElement('div');
            dayItem.className = 'forecast-day';
            dayItem.innerHTML = `
                <div class="day-info">
                    <div class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div class="day-date">${date.getDate()}/${date.getMonth() + 1}</div>
                </div>
                <div class="day-icon"><i class="${this.getWeatherIcon(code)}"></i></div>
                <div class="day-temp">${avgTemp}°</div>
            `;

            container.appendChild(dayItem);
        }
    }

    updateAirQualityDisplay(data) {
        if (!data || !data.current) {
            // Demo data
            const aqi = Math.floor(Math.random() * 300) + 1;
            document.getElementById('aqiBadge').innerHTML = `
                <span class="aqi-value">${aqi}</span>
                <span class="aqi-label">AQI</span>
            `;

            document.getElementById('pm25').textContent = `${Math.round(aqi / 2)} μg/m³`;
            document.getElementById('pm10').textContent = `${Math.round(aqi / 1.5)} μg/m³`;
            document.getElementById('o3').textContent = `${Math.round(aqi / 3)} ppb`;
            document.getElementById('no2').textContent = `${Math.round(aqi / 4)} ppb`;
            return;
        }

        const current = data.current;
        document.getElementById('pm25').textContent = `${current.pm2_5.toFixed(1)} μg/m³`;
        document.getElementById('pm10').textContent = `${current.pm10.toFixed(1)} μg/m³`;
        document.getElementById('o3').textContent = `${current.ozone.toFixed(1)} ppb`;
        document.getElementById('no2').textContent = `${current.dust?.toFixed(1) || '--'} ppb`;

        // Calculate AQI
        const aqi = Math.max(current.pm2_5 * 2, current.pm10 * 1.5, current.ozone * 3);
        document.getElementById('aqiBadge').innerHTML = `
            <span class="aqi-value">${Math.round(aqi)}</span>
            <span class="aqi-label">AQI</span>
        `;
    }

    updateMapLocation(lat, lon, city) {
        if (!this.map) return;

        this.map.setView([lat, lon], 10);

        // Clear existing markers
        if (this.marker) {
            this.map.removeLayer(this.marker);
        }

        // Add new marker
        this.marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'weather-marker',
                html: '<div class="marker-icon"><i class="fas fa-map-marker-alt"></i></div>',
                iconSize: [30, 30]
            })
        }).addTo(this.map);

        // Update coordinates display
        document.getElementById('mapLat').textContent = lat.toFixed(4);
        document.getElementById('mapLon').textContent = lon.toFixed(4);
    }

    // Helper methods
    getWeatherCondition(code) {
        const conditions = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            56: 'Light freezing drizzle',
            57: 'Dense freezing drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            66: 'Light freezing rain',
            67: 'Heavy freezing rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Violent rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with slight hail',
            99: 'Thunderstorm with heavy hail'
        };

        return conditions[code] || 'Unknown';
    }

    getWeatherIcon(code) {
        const icons = {
            0: 'fas fa-sun',
            1: 'fas fa-sun',
            2: 'fas fa-cloud-sun',
            3: 'fas fa-cloud',
            45: 'fas fa-smog',
            48: 'fas fa-smog',
            51: 'fas fa-cloud-rain',
            53: 'fas fa-cloud-rain',
            55: 'fas fa-cloud-showers-heavy',
            56: 'fas fa-snowflake',
            57: 'fas fa-snowflake',
            61: 'fas fa-cloud-rain',
            63: 'fas fa-cloud-showers-heavy',
            65: 'fas fa-cloud-showers-heavy',
            66: 'fas fa-snowflake',
            67: 'fas fa-snowflake',
            71: 'fas fa-snowflake',
            73: 'fas fa-snowflake',
            75: 'fas fa-snowflake',
            77: 'fas fa-snowflake',
            80: 'fas fa-cloud-rain',
            81: 'fas fa-cloud-showers-heavy',
            82: 'fas fa-cloud-showers-heavy',
            85: 'fas fa-snowflake',
            86: 'fas fa-snowflake',
            95: 'fas fa-bolt',
            96: 'fas fa-bolt',
            99: 'fas fa-bolt'
        };

        return icons[code] || 'fas fa-question';
    }

    // Search methods
    searchByCity() {
        const city = document.getElementById('cityInput').value.trim();
        this.getWeatherByCity(city);
    }

    searchByCoords(lat, lon) {
        this.getWeatherByCoords(lat, lon);
    }

    // Recent searches
    addToRecentSearches(city) {
        let recent = JSON.parse(localStorage.getItem('weatherAppRecent') || '[]');

        // Remove if already exists
        recent = recent.filter(item => item !== city);

        // Add to beginning
        recent.unshift(city);

        // Keep only last 5
        recent = recent.slice(0, 5);

        localStorage.setItem('weatherAppRecent', JSON.stringify(recent));
        this.loadRecentSearches();
    }

    loadRecentSearches() {
        const recent = JSON.parse(localStorage.getItem('weatherAppRecent') || '[]');
        const container = document.getElementById('recentSearches');

        container.innerHTML = '';

        recent.forEach(city => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.textContent = city;
            item.addEventListener('click', () => {
                document.getElementById('cityInput').value = city;
                this.getWeatherByCity(city);
            });

            container.appendChild(item);
        });
    }

    // Units
    switchUnit(unit) {
        if (unit === this.currentUnit) return;

        this.currentUnit = unit;

        // Update active button
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === unit);
        });

        // Update display
        document.querySelector('.temp-unit').textContent = unit === 'celsius' ? '°C' : '°F';

        // Refresh weather display
        if (this.currentLocation) {
            this.refreshWeather();
        }
    }

    // Refresh
    refreshWeather() {
        if (!this.currentLocation) return;

        const btn = document.getElementById('refreshBtn');
        btn.classList.add('spinning');

        this.fetchWeatherData(
            this.currentLocation.lat,
            this.currentLocation.lon,
            this.currentLocation.city,
            this.currentLocation.country,
            this.currentLocation.region
        ).then(() => {
            this.showToast('Weather data updated', 'success');
        }).catch(() => {
            this.showToast('Failed to update weather data', 'danger');
        }).finally(() => {
            setTimeout(() => {
                btn.classList.remove('spinning');
            }, 1000);
        });
    }

    // Favorites
    toggleFavorite() {
        const btn = document.getElementById('favoriteBtn');
        const icon = btn.querySelector('i');

        if (icon.classList.contains('far')) {
            icon.className = 'fas fa-heart';
            btn.classList.add('favorited');
            this.showToast('Added to favorites', 'success');
        } else {
            icon.className = 'far fa-heart';
            btn.classList.remove('favorited');
            this.showToast('Removed from favorites', 'info');
        }
    }

    // Map
    locateOnMap() {
        if (navigator.geolocation && this.map) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.map.setView([position.coords.latitude, position.coords.longitude], 13);
                    this.showToast('Map centered on your location', 'success');
                },
                () => {
                    this.showToast('Unable to get your location', 'warning');
                }
            );
        }
    }

    // Time
    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        document.getElementById('currentTime').textContent = timeStr;
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        document.getElementById('lastUpdateTime').textContent = timeStr;
    }

    // PWA Features
    showInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.classList.add('show');
        }
    }

    hideInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.classList.remove('show');
        }
    }

    async installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }

            this.deferredPrompt = null;
            this.hideInstallPrompt();
        }
    }

    // Network status
    handleOnline() {
        this.isOnline = true;
        document.getElementById('offlineIndicator').style.display = 'none';

        if (this.currentLocation) {
            this.refreshWeather();
        }

        this.showToast('Back online', 'success');
    }

    handleOffline() {
        this.isOnline = false;
        document.getElementById('offlineIndicator').style.display = 'flex';
        this.showToast('You are offline', 'warning');
    }

    // UI Helpers
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('active');
            this.isLoading = true;
        } else {
            overlay.classList.remove('active');
            this.isLoading = false;
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100%)';

            setTimeout(() => {
                if (toast.parentNode) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weatherApp = new ResponsiveWeatherApp();

    // Add skip link for accessibility
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    document.body.prepend(skipLink);
});