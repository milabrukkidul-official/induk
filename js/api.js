const API = {
    getUrl: () => {
        // 1. Check URL parameters first (e.g. ?api=...)
        const urlParams = new URLSearchParams(window.location.search);
        const paramUrl = urlParams.get('api');
        if (paramUrl) {
            localStorage.setItem('gas_api_url', paramUrl); // Sync to local storage
            return paramUrl;
        }
        // 2. Fallback to localStorage
        return localStorage.getItem('gas_api_url') || '';
    },
    setUrl: (url) => localStorage.setItem('gas_api_url', url),

    async request(action, params = {}, data = null) {
        const url = this.getUrl();
        if (!url) {
            alert('Silakan atur URL API GAS terlebih dahulu di pengaturan.');
            return null;
        }

        const queryParams = new URLSearchParams({ action, ...params }).toString();
        const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryParams}`;

        const options = {
            method: data ? 'POST' : 'GET',
            mode: 'cors', // Crucial for GAS
        };

        if (data) {
            options.body = JSON.stringify({ action, ...data });
        }

        try {
            const response = await fetch(fullUrl, options);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert('Terjadi kesalahan saat menghubungi API: ' + error.message);
            return null;
        }
    }
};
