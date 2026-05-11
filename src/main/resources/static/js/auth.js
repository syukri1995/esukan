/**
 * API base: set window.ESUKAN_API_BASE before this script (e.g. Vercel → backend URL).
 */
function esukanApiBase() {
    return typeof window.ESUKAN_API_BASE === 'string' ? window.ESUKAN_API_BASE.replace(/\/$/, '') : '';
}

function esukanTokenKey() {
    return 'esukan_token';
}

function getEsukanToken() {
    return sessionStorage.getItem(esukanTokenKey());
}

function setEsukanToken(token) {
    if (token) {
        sessionStorage.setItem(esukanTokenKey(), token);
    } else {
        sessionStorage.removeItem(esukanTokenKey());
    }
}

function authFetch(path, options = {}) {
    const url = esukanApiBase() + path;
    const headers = new Headers(options.headers || {});
    const token = getEsukanToken();
    if (token) {
        headers.set('Authorization', 'Bearer ' + token);
    }
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
}

function logoutEsukan() {
    setEsukanToken(null);
    window.location.href = '/login.html';
}
