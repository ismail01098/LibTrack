// ==========================================
// LIBTRACK - AUTHENTICATION HELPER
// ==========================================

const API_URL = "http://127.0.0.1:5000";

// Get saved JWT token
function getToken() {
    return localStorage.getItem("token") || "";
}

// Get saved logged-in user
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("user")) || null;
    } catch (error) {
        console.error("Unable to read saved user:", error);
        return null;
    }
}

// Check whether the user is logged in
function isLoggedIn() {
    return Boolean(getToken());
}

// Save login information
function saveAuth(token, user) {
    localStorage.setItem("token", token || "");
    localStorage.setItem("authToken", token || "");
    localStorage.setItem("user", JSON.stringify(user || {}));
}

// Clear login information
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    window.location.href = "login.html";
}

// Headers for authenticated API requests
function authHeaders() {
    const token = getToken();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// Protect a normal student page
function requireStudent() {
    const token = getToken();
    const user = getCurrentUser();

    if (!token || !user) {
        window.location.href = "login.html";
        return false;
    }

    const role = String(user.role || "student").toLowerCase();

    if (role === "admin") {
        window.location.href = "admin.html";
        return false;
    }

    return true;
}

// Protect an admin page
function requireAdmin() {
    const token = getToken();
    const user = getCurrentUser();

    if (!token || !user) {
        window.location.href = "login.html";
        return false;
    }

    const role = String(user.role || "").toLowerCase();

    if (role !== "admin") {
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Prevent logged-in users from opening the login page again
function redirectIfLoggedIn() {
    const token = getToken();
    const user = getCurrentUser();

    if (!token || !user) {
        return;
    }

    const role = String(user.role || "student").toLowerCase();

    if (role === "admin") {
        window.location.href = "admin.html";
    } else {
        window.location.href = "index.html";
    }
}