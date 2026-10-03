/* =========================================================
   NAIJADEALS ADMIN PANEL
   ========================================================= */

const API = "/api";

let currentSection = "dashboard";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function $(id) {
    return document.getElementById(id);
}

async function api(url, options = {}) {
    const response = await fetch(API + url, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || "API request failed");
    }

    return data;
}

function showMessage(message, type = "error") {
    let box = $("adminMessage");

    if (!box) {
        box = document.createElement("div");
        box.id = "adminMessage";
        box.style.position = "fixed";
        box.style.top = "20px";
        box.style.right = "20px";
        box.style.zIndex = "99999";
        box.style.padding = "14px 18px";
        box.style.borderRadius = "10px";
        box.style.fontWeight = "600";
        box.style.boxShadow = "0 8px 25px rgba(0,0,0,.15)";
        document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.background =
        type === "success" ? "#16a34a" : "#dc2626";
    box.style.color = "#fff";

    setTimeout(() => {
        box.remove();
    }, 3500);
}

/* ---------------------------------------------------------
   Login
--------------------------------------------------------- */

async function loginAdmin(event) {
    if (event) event.preventDefault();

    const emailInput =
        $("adminEmail") ||
        $("email") ||
        document.querySelector(
            'input[type="email"], input[placeholder*="email" i], input[placeholder*="username" i]'
        );

    const passwordInput =
        $("adminPassword") ||
        $("password") ||
        document.querySelector('input[type="password"]');

    if (!emailInput || !passwordInput) {
        showMessage("Login form fields were not found.");
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Please enter your email/username and password.");
        return;
    }

    try {
        const result = await api("/admin/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });

        showMessage(
            result.message || "Admin login successful!",
            "success"
        );

        setTimeout(() => {
            showAdminPanel();
        }, 500);

    } catch (error) {
        console.error("Admin login error:", error);
        showMessage(error.message || "Admin login failed.");
    }
}

/* ---------------------------------------------------------
   Check existing session
--------------------------------------------------------- */

async function checkAdminSession() {
    try {
        const result = await api("/admin/session");

        if (
            result &&
            (
                result.authenticated === true ||
                result.loggedIn === true ||
                result.user ||
                result.admin
            )
        ) {
            showAdminPanel();
            return true;
        }
    } catch (error) {
        console.log("No active admin session.");
    }

    showLoginPanel();
    return false;
}

/* ---------------------------------------------------------
   Show / hide login and admin panel
--------------------------------------------------------- */

function findLoginContainer() {
    return (
        $("loginPage") ||
        $("loginScreen") ||
        $("adminLogin") ||
        document.querySelector(".login-page") ||
        document.querySelector(".login-screen") ||
        document.querySelector(".login-container")
    );
}

function findAdminContainer() {
    return (
        $("adminPanel") ||
        $("dashboardPage") ||
        $("adminDashboard") ||
        document.querySelector(".admin-panel") ||
        document.querySelector(".dashboard")
    );
}

function showLoginPanel() {
    const login = findLoginContainer();
    const admin = findAdminContainer();

    if (login) login.style.display = "";
    if (admin) admin.style.display = "none";
}

function showAdminPanel() {
    const login = findLoginContainer();
    const admin = findAdminContainer();

    if (login) login.style.display = "none";
    if (admin) admin.style.display = "";

    loadDashboard();
}

/* ---------------------------------------------------------
   Dashboard
--------------------------------------------------------- */

async function loadDashboard() {
    currentSection = "dashboard";

    try {
        const result = await api("/admin/dashboard");

        const data = result.dashboard || result.data || result;

        updateNumber(
            ["productCount", "productsCount", "totalProducts"],
            data.products ?? data.productCount ?? data.totalProducts ?? 0
        );

        updateNumber(
            ["orderCount", "ordersCount", "totalOrders"],
            data.orders ?? data.orderCount ?? data.totalOrders ?? 0
        );

        updateNumber(
            ["customerCount", "customersCount", "totalCustomers"],
            data.customers ?? data.customerCount ?? data.totalCustomers ?? 0
        );

        updateNumber(
            ["sellerCount", "sellersCount", "totalSellers"],
            data.sellers ?? data.sellerCount ?? data.totalSellers ?? 0
        );

        renderRecentProducts(
            data.recentProducts ||
            data.products ||
            []
        );

    } catch (error) {
        console.error(error);
        showMessage("Could not load dashboard data.");
    }
}

function updateNumber(ids, value) {
    for (const id of ids) {
        const el = $(id);
        if (el) {
            el.textContent = value;
            return;
        }
    }
}

/* ---------------------------------------------------------
   Products
--------------------------------------------------------- */

async function loadProducts() {
    currentSection = "products";

    try {
        const result = await api("/admin/products");

        const products =
            Array.isArray(result)
                ? result
                : result.products || result.data || [];

        renderProducts(products);

    } catch (error) {
        console.error(error);
        showMessage("Could not load products.");
    }
}

function renderProducts(products) {
    const tableBody =
        $("productsTableBody") ||
        $("productTableBody") ||
        document.querySelector("#productsTable tbody");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!products.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:25px;">
                    No products found.
                </td>
            </tr>
        `;
        return;
    }

    products.forEach(product => {
        const tr = document.createElement("tr");

        const image = product.image || product.images?.[0] || "";

        tr.innerHTML = `
            <td>
                ${
                    image
                        ? `<img src="${escapeHtml(image)}"
                               style="width:55px;height:55px;object-fit:cover;border-radius:8px;">`
                        : "📦"
                }
            </td>

            <td>${escapeHtml(product.name || "Unnamed product")}</td>

            <td>${escapeHtml(product.category || "-")}</td>

            <td>₦${formatMoney(product.price || 0)}</td>

            <td>${product.stock ?? 0}</td>

            <td>
                ${
                    product.status === "inactive"
                        ? "Inactive"
                        : "Active"
                }
            </td>

            <td>
                <button onclick="editProduct('${product.id}')">
                    Edit
                </button>

                <button
                    onclick="deleteProduct('${product.id}')"
                    style="color:#dc2626;"
                >
                    Delete
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;

    try {
        await api(`/admin/products/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });

        showMessage("Product deleted.", "success");
        loadProducts();

    } catch (error) {
        showMessage(error.message || "Could not delete product.");
    }
}

async function editProduct(id) {
    try {
        const result = await api(`/products/${encodeURIComponent(id)}`);

        const product = result.product || result;

        const name = prompt(
            "Product name:",
            product.name || ""
        );

        if (name === null) return;

        const price = prompt(
            "Price:",
            product.price || 0
        );

        if (price === null) return;

        const stock = prompt(
            "Stock:",
            product.stock || 0
        );

        if (stock === null) return;

        await api(`/admin/products/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({
                ...product,
                name,
                price: Number(price),
                stock: Number(stock)
            })
        });

        showMessage("Product updated successfully.", "success");
        loadProducts();

    } catch (error) {
        showMessage(error.message || "Could not update product.");
    }
}

/* ---------------------------------------------------------
   Add Product
--------------------------------------------------------- */

function openAddProduct() {
    const modal =
        $("addProductModal") ||
        $("productModal") ||
        $("addProduct");

    if (modal) {
        modal.style.display = "flex";
        return;
    }

    showMessage("Add Product form is already on the page.");
}

function closeAddProduct() {
    const modal =
        $("addProductModal") ||
        $("productModal") ||
        $("addProduct");

    if (modal) {
        modal.style.display = "none";
    }
}

async function saveProduct(event) {
    if (event) event.preventDefault();

    const name =
        getValue(["productName", "name"]);

    const category =
        getValue(["productCategory", "category"]);

    const price =
        getValue(["productPrice", "price"]);

    const stock =
        getValue(["productStock", "stock"]);

    const image =
        getValue(["productImage", "image"]);

    const description =
        getValue(["productDescription", "description"]);

    if (!name) {
        showMessage("Enter a product name.");
        return;
    }

    if (!price) {
        showMessage("Enter a product price.");
        return;
    }

    try {
        await api("/admin/products", {
            method: "POST",
            body: JSON.stringify({
                name,
                category,
                price: Number(price),
                stock: Number(stock || 0),
                image,
                description
            })
        });

        showMessage("Product added successfully!", "success");

        closeAddProduct();
        clearProductForm();
        loadProducts();

    } catch (error) {
        showMessage(error.message || "Could not add product.");
    }
}

function clearProductForm() {
    [
        "productName",
        "productCategory",
        "productPrice",
        "productStock",
        "productImage",
        "productDescription"
    ].forEach(id => {
        const el = $(id);
        if (el) el.value = "";
    });
}

/* ---------------------------------------------------------
   Orders
--------------------------------------------------------- */

async function loadOrders() {
    currentSection = "orders";

    try {
        const result = await api("/admin/orders");

        const orders =
            Array.isArray(result)
                ? result
                : result.orders || result.data || [];

        renderOrders(orders);

    } catch (error) {
        console.error(error);
        showMessage("Could not load orders.");
    }
}

function renderOrders(orders) {
    const container =
        $("ordersList") ||
        $("ordersTableBody") ||
        document.querySelector("#ordersTable tbody");

    if (!container) return;

    container.innerHTML = "";

    if (!orders.length) {
        container.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:25px;">
                    No orders found.
                </td>
            </tr>
        `;
        return;
    }

    orders.forEach(order => {
        const customer =
            order.customerName ||
            order.userName ||
            order.customer?.name ||
            "Customer";

        const status =
            order.status || "pending";

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(order.id || "-")}</td>
            <td>${escapeHtml(customer)}</td>
            <td>₦${formatMoney(order.total || order.amount || 0)}</td>
            <td>${escapeHtml(status)}</td>
            <td>
                <select
                    onchange="updateOrderStatus('${order.id}', this.value)"
                >
                    <option value="pending" ${status === "pending" ? "selected" : ""}>
                        Pending
                    </option>
                    <option value="processing" ${status === "processing" ? "selected" : ""}>
                        Processing
                    </option>
                    <option value="shipped" ${status === "shipped" ? "selected" : ""}>
                        Shipped
                    </option>
                    <option value="delivered" ${status === "delivered" ? "selected" : ""}>
                        Delivered
                    </option>
                    <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>
                        Cancelled
                    </option>
                </select>
            </td>
        `;

        container.appendChild(tr);
    });
}

async function updateOrderStatus(id, status) {
    try {
        await api(`/admin/orders/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status })
        });

        showMessage("Order status updated.", "success");

    } catch (error) {
        showMessage(error.message || "Could not update order.");
    }
}

/* ---------------------------------------------------------
   Customers
--------------------------------------------------------- */

async function loadCustomers() {
    currentSection = "customers";

    try {
        const result = await api("/admin/users");

        const users =
            Array.isArray(result)
                ? result
                : result.users || result.data || [];

        const customers = users.filter(
            user => user.role !== "admin" && user.role !== "seller"
        );

        renderUsers(
            customers,
            "customersTableBody",
            "customerTableBody",
            "customersTable"
        );

    } catch (error) {
        console.error(error);
        showMessage("Could not load customers.");
    }
}

/* ---------------------------------------------------------
   Sellers
--------------------------------------------------------- */

async function loadSellers() {
    currentSection = "sellers";

    try {
        const result = await api("/admin/users");

        const users =
            Array.isArray(result)
                ? result
                : result.users || result.data || [];

        const sellers = users.filter(
            user => user.role === "seller"
        );

        renderUsers(
            sellers,
            "sellersTableBody",
            "sellerTableBody",
            "sellersTable"
        );

    } catch (error) {
        console.error(error);
        showMessage("Could not load sellers.");
    }
}

function renderUsers(users, id1, id2, tableId) {
    const container =
        $(id1) ||
        $(id2) ||
        document.querySelector(`#${tableId} tbody`);

    if (!container) return;

    container.innerHTML = "";

    if (!users.length) {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;padding:25px;">
                    No users found.
                </td>
            </tr>
        `;
        return;
    }

    users.forEach(user => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(user.name || "-")}</td>
            <td>${escapeHtml(user.email || "-")}</td>
            <td>${escapeHtml(user.phone || "-")}</td>
            <td>${escapeHtml(user.role || "customer")}</td>
            <td>
                ${
                    user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "-"
                }
            </td>
        `;

        container.appendChild(tr);
    });
}

/* ---------------------------------------------------------
   Navigation
--------------------------------------------------------- */

function showSection(section) {
    document.querySelectorAll("[data-section]").forEach(el => {
        el.style.display =
            el.dataset.section === section
                ? ""
                : "none";
    });

    const sections = [
        "dashboard",
        "products",
        "orders",
        "customers",
        "sellers"
    ];

    sections.forEach(name => {
        const el =
            $(name + "Section") ||
            $(name + "Page");

        if (el) {
            el.style.display =
                name === section ? "" : "none";
        }
    });

    if (section === "dashboard") loadDashboard();
    if (section === "products") loadProducts();
    if (section === "orders") loadOrders();
    if (section === "customers") loadCustomers();
    if (section === "sellers") loadSellers();

    currentSection = section;
}

/* ---------------------------------------------------------
   Logout
--------------------------------------------------------- */

async function logoutAdmin() {
    try {
        await api("/admin/logout", {
            method: "POST"
        });
    } catch (error) {
        console.log(error);
    }

    showLoginPanel();
    showMessage("Logged out.", "success");
}

/* ---------------------------------------------------------
   Search
--------------------------------------------------------- */

function setupSearch() {
    const productSearch =
        $("productSearch") ||
        document.querySelector('input[placeholder*="Search products" i]');

    if (productSearch) {
        productSearch.addEventListener("input", () => {
            const term =
                productSearch.value.toLowerCase().trim();

            document
                .querySelectorAll(
                    "#productsTable tbody tr, #productsTableBody tr"
                )
                .forEach(row => {
                    row.style.display =
                        row.textContent
                            .toLowerCase()
                            .includes(term)
                            ? ""
                            : "none";
                });
        });
    }

    const customerSearch =
        $("customerSearch") ||
        document.querySelector('input[placeholder*="Search customers" i]');

    if (customerSearch) {
        customerSearch.addEventListener("input", () => {
            const term =
                customerSearch.value.toLowerCase().trim();

            document
                .querySelectorAll(
                    "#customersTable tbody tr, #customersTableBody tr"
                )
                .forEach(row => {
                    row.style.display =
                        row.textContent
                            .toLowerCase()
                            .includes(term)
                            ? ""
                            : "none";
                });
        });
    }

    const orderSearch =
        $("orderSearch") ||
        document.querySelector('input[placeholder*="Search order" i]');

    if (orderSearch) {
        orderSearch.addEventListener("input", () => {
            const term =
                orderSearch.value.toLowerCase().trim();

            document
                .querySelectorAll(
                    "#ordersTable tbody tr, #ordersTableBody tr"
                )
                .forEach(row => {
                    row.style.display =
                        row.textContent
                            .toLowerCase()
                            .includes(term)
                            ? ""
                            : "none";
                });
        });
    }

    const sellerSearch =
        $("sellerSearch") ||
        document.querySelector('input[placeholder*="Search sellers" i]');

    if (sellerSearch) {
        sellerSearch.addEventListener("input", () => {
            const term =
                sellerSearch.value.toLowerCase().trim();

            document
                .querySelectorAll(
                    "#sellersTable tbody tr, #sellersTableBody tr"
                )
                .forEach(row => {
                    row.style.display =
                        row.textContent
                            .toLowerCase()
                            .includes(term)
                            ? ""
                            : "none";
                });
        });
    }
}

/* ---------------------------------------------------------
   Recent Products
--------------------------------------------------------- */

function renderRecentProducts(products) {
    const container =
        $("recentProductsBody") ||
        $("recentProducts") ||
        document.querySelector("#recentProductsTable tbody");

    if (!container || !Array.isArray(products)) return;

    container.innerHTML = "";

    products.slice(0, 10).forEach(product => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(product.name || "-")}</td>
            <td>${escapeHtml(product.category || "-")}</td>
            <td>₦${formatMoney(product.price || 0)}</td>
            <td>${product.stock ?? 0}</td>
        `;

        container.appendChild(tr);
    });
}

/* ---------------------------------------------------------
   Utility
--------------------------------------------------------- */

function getValue(ids) {
    for (const id of ids) {
        const el = $(id);
        if (el) return el.value.trim();
    }

    return "";
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-NG");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ---------------------------------------------------------
   Global functions
--------------------------------------------------------- */

window.loginAdmin = loginAdmin;
window.checkAdminSession = checkAdminSession;
window.showAdminPanel = showAdminPanel;
window.showLoginPanel = showLoginPanel;

window.loadDashboard = loadDashboard;
window.loadProducts = loadProducts;
window.loadOrders = loadOrders;
window.loadCustomers = loadCustomers;
window.loadSellers = loadSellers;

window.showSection = showSection;

window.deleteProduct = deleteProduct;
window.editProduct = editProduct;

window.openAddProduct = openAddProduct;
window.closeAddProduct = closeAddProduct;
window.saveProduct = saveProduct;

window.updateOrderStatus = updateOrderStatus;

window.logoutAdmin = logoutAdmin;

/* ---------------------------------------------------------
   Start
--------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {

    setupSearch();

    const loginForm =
        $("loginForm") ||
        document.querySelector("form");

    if (loginForm) {
        loginForm.addEventListener("submit", loginAdmin);
    }

    const loginButton =
        $("loginButton") ||
        document.querySelector(
            'button[type="submit"]'
        );

    if (loginButton) {
        loginButton.addEventListener("click", loginAdmin);
    }

    const addProductForm =
        $("addProductForm") ||
        document.querySelector(
            "#addProductModal form, #productModal form"
        );

    if (addProductForm) {
        addProductForm.addEventListener(
            "submit",
            saveProduct
        );
    }

    checkAdminSession();
});