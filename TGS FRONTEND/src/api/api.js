import axios from 'axios';


// Use the current origin if deployed on the same server, or an environment variable
const BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;


const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let toastHandler = null;
api.setErrorHandler = (handler) => {
    toastHandler = handler;
};

api.interceptors.request.use((config) => {
    try {
        const storedUser = sessionStorage.getItem('tgs_user');
        if (storedUser && storedUser !== 'undefined') {
            const user = JSON.parse(storedUser);
            if (user && user.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
            if (user && user.active_position_id) {
                config.headers['X-Active-Position-Id'] = user.active_position_id;
            }
        }
    } catch (error) {
        console.error("Error parsing user from sessionStorage:", error);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use((response) => {
    // 1. Check if the response is actually JSON if we expect data
    const contentType = response.headers['content-type'] || '';
    if (response.config.url.includes('/api/') && contentType.includes('text/html')) {
        const msg = 'Server returned HTML instead of JSON. The backend might be offline or misconfigured.';
        if (toastHandler) toastHandler(msg, 'error');
        const error = new Error(msg);
        error.code = 'ERR_NOT_JSON';
        return Promise.reject(error);
    }
    return response;
}, (error) => {
    // Handle specific status codes
    if (error.response) {
        if ((error.response.status === 401 || error.response.status === 403)) {
            if (!error.config.url.includes('/auth/login')) {
                console.warn("Session expired or unauthorized. Logging out...");
                sessionStorage.removeItem('tgs_user');
                const pathParts = window.location.pathname.split('/');
                const isSubpath = pathParts.length > 2 && pathParts[1] !== 'login';
                const baseAppPath = isSubpath ? `/${pathParts[1]}` : '';
                
                if (window.location.pathname !== `${baseAppPath}/` && window.location.pathname !== `${baseAppPath}/login`) {
                    window.location.href = `${baseAppPath}/`;
                }
            }
        }
    } else if (error.request) {
        // The request was made but no response was received
        const msg = "Network Error: Backend server is unreachable.";
        console.error(msg);
        if (toastHandler) toastHandler(msg, 'error');
    }
    return Promise.reject(error);
});

export default api;
