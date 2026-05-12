const API = {
    // URL permanen untuk fallback jika localStorage kosong (misal di mode Incognito)
    DEFAULT_URL: 'https://script.google.com/macros/s/AKfycbzRqlbA-bEW6VbFkGxiPZ0zECBNsEyBxmuevJTvhaE0DnI6_WWDtxbA9NFSP40hfJlP/exec',

    getUrl: () => {
        // 1. Cek parameter URL (?api=...)
        const urlParams = new URLSearchParams(window.location.search);
        const paramUrl = urlParams.get('api');
        if (paramUrl) {
            localStorage.setItem('gas_api_url', paramUrl); // Sinkron ke local storage
            return paramUrl;
        }

        // 2. Fallback ke localStorage (untuk mode normal)
        const storedUrl = localStorage.getItem('gas_api_url');
        if (storedUrl) return storedUrl;

        // 3. Fallback terakhir ke URL hardcoded (untuk Incognito/Baru)
        return API.DEFAULT_URL;
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
            // Hanya tampilkan alert untuk aksi yang bukan background fetch
            if (action !== 'getStudentExtras') {
                alert('Terjadi kesalahan saat menghubungi API: ' + error.message);
            }
            return null;
        }
    }
};
