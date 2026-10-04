```javascript
// NaijaDeals Admin Dashboard
// Connects to the same server that serves admin.html

const API = window.location.origin;

let adminToken = localStorage.getItem("naijadeals_admin_token") || "";

let adminProducts = [];
let adminUsers = [];
let adminOrders = [];
let adminInspections = [];

// ===============================
// HELPERS
// ===============================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMoney(value) {
    const number = Number(value || 0);
    return "₦" + number.toLocaleString("en-NG");
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-NG");
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function showMessage(message, type = "success") {
    const box = document.getElementById("adminMessage");

    if (!box) {
        alert(message);
        return;
    }

    box.textContent = message;
    box.style.display = "block";

    if (type === "error") {
        box.style.background = "#fee2e2";
        box.style.color = "#991b1b";
        box.style.border = "1px solid #fecaca";
    } else {
        box.style.background = "#dcfce7";
        box.style.color = "#166534";
        box.style.border = "1px solid #bbf7d0";
    }

    setTimeout(() => {
        box.style.display = "none";
    }, 5000);
}


// ===============================
// API REQUEST
// ===============================

async function apiRequest(url, options = {}) {

    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
    };

    if (adminToken) {
        headers["Authorization"] = "Bearer " + adminToken;
    }

    try {

        console.log("NaijaDeals API:", API + url);

        const response = await fetch(API + url, {
            ...options,
            headers
        });

        let data = {};

        const text = await response.text();

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = {
                    message: text
                };
            }
        }

        console.log("API response:", response.status, data);

        if (!response.ok) {

            if (response.status === 401 || response.status === 403) {

                if (url !== "/api/login") {
                    adminToken = "";

                    localStorage.removeItem(
                        "naijadeals_admin_token"
                    );

                    localStorage.removeItem(
                        "naijadeals_admin_user"
                    );
                }
            }

            throw new Error(
                data.message ||
                data.error ||
                `Server returned ${response.status}`
            );
        }

        return data;

    } catch (error) {

        console.error("API ERROR:", error);

        if (
            error instanceof TypeError &&
            error.message.includes("fetch")
        ) {
            throw new Error(
                "Cannot connect to the NaijaDeals server. Make sure the website is running."
            );
        }

        throw error;
    }
}


// ===============================
// ADMIN LOGIN
// ===============================

async function loginAdmin() {

    const emailInput =
        document.getElementById("adminEmail");

    const passwordInput =
        document.getElementById("adminPassword");

    const email =
        emailInput
            ? emailInput.value.trim()
            : "";

    const password =
        passwordInput
            ? passwordInput.value
            : "";

    if (!email) {
        showMessage(
            "Please enter your admin email.",
            "error"
        );
        return;
    }

    if (!password) {
        showMessage(
            "Please enter your admin password.",
            "error"
        );
        return;
    }

    const button =
        document.querySelector(".login-btn");

    if (button) {
        button.disabled = true;
        button.textContent = "⏳ Logging in...";
    }

    try {

        const data = await apiRequest(
            "/api/login",
            {
                method: "POST",

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );

        if (!data.success) {

            throw new Error(
                data.message ||
                "Login failed."
            );
        }

        if (!data.token) {

            throw new Error(
                "The server did not return a login token."
            );
        }

        if (
            !data.user ||
            data.user.role !== "admin"
        ) {

            throw new Error(
                "This account does not have administrator access."
            );
        }

        // Save login
        adminToken = data.token;

        localStorage.setItem(
            "naijadeals_admin_token",
            adminToken
        );

        localStorage.setItem(
            "naijadeals_admin_user",
            JSON.stringify(data.user)
        );

        // Show dashboard
        showAdminDashboard();

        // Display admin name
        setText(
            "adminName",
            data.user.name || "Admin"
        );

        // Load dashboard
        await refreshAdmin();

        showMessage(
            "Login successful. Welcome to NaijaDeals Admin."
        );

    } catch (error) {

        console.error(
            "ADMIN LOGIN ERROR:",
            error
        );

        showMessage(
            error.message ||
            "Unable to login to the admin dashboard.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "🔐 Login to Admin";
        }
    }
}


// ===============================
// LOGOUT
// ===============================

async function logoutAdmin(callServer = true) {

    try {

        if (callServer && adminToken) {

            await apiRequest(
                "/api/logout",
                {
                    method: "POST"
                }
            );
        }

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );
    }

    adminToken = "";

    localStorage.removeItem(
        "naijadeals_admin_token"
    );

    localStorage.removeItem(
        "naijadeals_admin_user"
    );

    const dashboard =
        document.getElementById("adminDashboard");

    const login =
        document.getElementById("adminLogin");

    if (dashboard) {
        dashboard.style.display = "none";
    }

    if (login) {
        login.style.display = "flex";
    }
}


// ===============================
// SHOW DASHBOARD
// ===============================

function showAdminDashboard() {

    const dashboard =
        document.getElementById("adminDashboard");

    const login =
        document.getElementById("adminLogin");

    if (login) {
        login.style.display = "none";
    }

    if (dashboard) {
        dashboard.style.display = "block";
    }
}


// ===============================
// CHECK SESSION
// ===============================

async function checkAdminSession() {

    if (!adminToken) {
        return false;
    }

    try {

        const data =
            await apiRequest("/api/me");

        if (
            data.success &&
            data.user &&
            data.user.role === "admin"
        ) {

            localStorage.setItem(
                "naijadeals_admin_user",
                JSON.stringify(data.user)
            );

            setText(
                "adminName",
                data.user.name || "Admin"
            );

            showAdminDashboard();

            return true;
        }

    } catch (error) {

        console.warn(
            "Session check failed:",
            error
        );
    }

    logoutAdmin(false);

    return false;
}


// ===============================
// DASHBOARD
// ===============================

async function refreshAdmin() {

    try {

        await Promise.all([
            loadDashboard(),
            loadUsers(),
            loadProducts(),
            loadOrders(),
            loadInspections()
        ]);

    } catch (error) {

        console.error(
            "Dashboard refresh error:",
            error
        );

        showMessage(
            error.message ||
            "Could not load the admin dashboard.",
            "error"
        );
    }
}


async function loadDashboard() {

    const data =
        await apiRequest(
            "/api/admin/dashboard"
        );

    if (!data.success) {
        return;
    }

    const stats =
        data.stats || {};

    setText(
        "statUsers",
        stats.users || 0
    );

    setText(
        "statSellers",
        stats.sellers || 0
    );

    setText(
        "statCustomers",
        stats.customers || 0
    );

    setText(
        "statProducts",
        stats.products || 0
    );

    setText(
        "statOrders",
        stats.orders || 0
    );

    setText(
        "statRevenue",
        formatMoney(stats.revenue || 0)
    );

    setText(
        "userCount",
        stats.users || 0
    );

    setText(
        "productCount",
        stats.products || 0
    );

    setText(
        "orderCount",
        stats.orders || 0
    );
}


// ===============================
// SECTIONS
// ===============================

function showSection(sectionId) {

    document
        .querySelectorAll(".admin-section")
        .forEach(section => {

            section.style.display = "none";

        });

    const section =
        document.getElementById(sectionId);

    if (section) {
        section.style.display = "block";
    }

    document
        .querySelectorAll(".admin-nav button")
        .forEach(button => {

            button.classList.remove("active");

            if (
                button.dataset.section ===
                sectionId
            ) {
                button.classList.add("active");
            }

        });
}


// ===============================
// USERS
// ===============================

async function loadUsers() {

    const data =
        await apiRequest(
            "/api/admin/users"
        );

    adminUsers =
        Array.isArray(data.users)
            ? data.users
            : [];

    renderUsers(adminUsers);

    setText(
        "userCount",
        adminUsers.length
    );
}


function renderUsers(users) {

    const tbody =
        document.getElementById(
            "usersTableBody"
        );

    if (!tbody) return;

    if (!users.length) {

        tbody.innerHTML =
            `<tr>
                <td colspan="7">
                    No users found.
                </td>
            </tr>`;

        return;
    }

    tbody.innerHTML =
        users.map(user => `

            <tr>

                <td>
                    ${escapeHTML(user.name || "-")}
                </td>

                <td>
                    ${escapeHTML(user.email || "-")}
                </td>

                <td>
                    ${escapeHTML(user.phone || "-")}
                </td>

                <td>
                    ${escapeHTML(user.role || "-")}
                </td>

                <td>
                    ${formatDate(user.createdAt)}
                </td>

            </tr>

        `).join("");
}


function searchUsers(value) {

    const query =
        String(value || "")
            .trim()
            .toLowerCase();

    if (!query) {

        renderUsers(adminUsers);

        return;
    }

    const filtered =
        adminUsers.filter(user => {

            const text = [
                user.name,
                user.email,
                user.phone,
                user.role
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return text.includes(query);
        });

    renderUsers(filtered);
}


// ===============================
// PRODUCTS
// ===============================

async function loadProducts() {

    const data =
        await apiRequest(
            "/api/admin/products"
        );

    adminProducts =
        Array.isArray(data.products)
            ? data.products
            : [];

    renderProducts(adminProducts);

    setText(
        "productCount",
        adminProducts.length
    );
}


function renderProducts(products) {

    const tbody =
        document.getElementById(
            "productsTableBody"
        );

    if (!tbody) return;

    if (!products.length) {

        tbody.innerHTML =
            `<tr>
                <td colspan="8">
                    No products found.
                </td>
            </tr>`;

        return;
    }

   