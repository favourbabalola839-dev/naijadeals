const API = window.location.origin;

let adminToken = localStorage.getItem("naijadeals_admin_token") || "";
let currentProducts = [];
let currentUsers = [];
let currentOrders = [];
let currentInspections = [];


// ============================================================
// BASIC HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMoney(value) {
    const number = Number(value || 0);

    return "₦" + number.toLocaleString("en-NG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function showMessage(message, type = "info") {
    let box = $("adminMessage");

    if (!box) {
        box = document.createElement("div");
        box.id = "adminMessage";

        box.style.position = "fixed";
        box.style.top = "20px";
        box.style.right = "20px";
        box.style.zIndex = "99999";
        box.style.maxWidth = "380px";
        box.style.padding = "14px 18px";
        box.style.borderRadius = "10px";
        box.style.fontSize = "14px";
        box.style.fontWeight = "600";
        box.style.boxShadow = "0 8px 25px rgba(0,0,0,.15)";

        document.body.appendChild(box);
    }

    box.textContent = message;

    if (type === "success") {
        box.style.background = "#dcfce7";
        box.style.color = "#166534";
    } else if (type === "error") {
        box.style.background = "#fee2e2";
        box.style.color = "#991b1b";
    } else {
        box.style.background = "#e0f2fe";
        box.style.color = "#075985";
    }

    box.style.display = "block";

    clearTimeout(window.adminMessageTimer);

    window.adminMessageTimer = setTimeout(() => {
        box.style.display = "none";
    }, 4000);
}


// ============================================================
// API REQUEST
// ============================================================

async function apiRequest(url, options = {}) {
    const requestOptions = {
        ...options,
        headers: {
            ...(options.headers || {})
        }
    };

    if (!requestOptions.headers["Content-Type"] &&
        requestOptions.body &&
        typeof requestOptions.body === "string") {
        requestOptions.headers["Content-Type"] = "application/json";
    }

    if (adminToken) {
        requestOptions.headers["Authorization"] =
            `Bearer ${adminToken}`;
    }

    try {
        const response = await fetch(`${API}${url}`, requestOptions);

        let data = {};

        const contentType =
            response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();

            try {
                data = JSON.parse(text);
            } catch {
                data = {
                    success: response.ok,
                    message: text
                };
            }
        }

        if (response.status === 401 || response.status === 403) {
            if (url !== "/api/login") {
                adminToken = "";
                localStorage.removeItem("naijadeals_admin_token");

                showLogin();

                throw new Error(
                    data.message || "Your admin session has expired."
                );
            }
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed (${response.status})`
            );
        }

        return data;

    } catch (error) {
        if (
            error instanceof TypeError &&
            error.message.toLowerCase().includes("fetch")
        ) {
            throw new Error(
                "Could not connect to the server. Please check your internet connection or Render deployment."
            );
        }

        throw error;
    }
}


// ============================================================
// LOGIN
// ============================================================

async function loginAdmin() {
    const emailInput = $("adminEmail");
    const passwordInput = $("adminPassword");

    if (!emailInput || !passwordInput) {
        showMessage(
            "Admin login fields were not found.",
            "error"
        );
        return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email) {
        showMessage("Please enter your admin email.", "error");
        emailInput.focus();
        return;
    }

    if (!password) {
        showMessage("Please enter your admin password.", "error");
        passwordInput.focus();
        return;
    }

    const button =
        document.querySelector("#adminLogin button[type='submit']") ||
        document.querySelector("#adminLogin button");

    const originalText = button ? button.textContent : "";

    if (button) {
        button.disabled = true;
        button.textContent = "Logging in...";
    }

    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });

        if (!data.success) {
            throw new Error(
                data.message || "Invalid email or password."
            );
        }

        if (!data.user) {
            throw new Error(
                "The server did not return an admin user."
            );
        }

        if (data.user.role !== "admin") {
            throw new Error(
                "This account does not have administrator access."
            );
        }

        if (!data.token) {
            throw new Error(
                "The server did not return a login token."
            );
        }

        adminToken = data.token;

        localStorage.setItem(
            "naijadeals_admin_token",
            adminToken
        );

        localStorage.setItem(
            "naijadeals_admin_user",
            JSON.stringify(data.user)
        );

        showMessage(
            "Admin login successful.",
            "success"
        );

        showDashboard(data.user);

        await loadDashboard();

    } catch (error) {
        console.error("Admin login error:", error);

        showMessage(
            error.message || "Login failed.",
            "error"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || "Login";
        }
    }
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutAdmin() {
    try {
        if (adminToken) {
            await apiRequest("/api/logout", {
                method: "POST"
            });
        }
    } catch (error) {
        console.warn("Logout request failed:", error);
    }

    adminToken = "";

    localStorage.removeItem(
        "naijadeals_admin_token"
    );

    localStorage.removeItem(
        "naijadeals_admin_user"
    );

    showLogin();

    showMessage(
        "You have been logged out.",
        "success"
    );
}


// ============================================================
// SESSION CHECK
// ============================================================

async function checkAdminSession() {
    if (!adminToken) {
        showLogin();
        return;
    }

    try {
        const data = await apiRequest("/api/me");

        if (
            !data ||
            !data.user ||
            data.user.role !== "admin"
        ) {
            throw new Error("Admin access required.");
        }

        localStorage.setItem(
            "naijadeals_admin_user",
            JSON.stringify(data.user)
        );

        showDashboard(data.user);

        await loadDashboard();

    } catch (error) {
        console.warn(
            "Admin session check failed:",
            error
        );

        adminToken = "";

        localStorage.removeItem(
            "naijadeals_admin_token"
        );

        localStorage.removeItem(
            "naijadeals_admin_user"
        );

        showLogin();
    }
}


// ============================================================
// SHOW LOGIN / DASHBOARD
// ============================================================

function showLogin() {
    const login = $("adminLogin");
    const dashboard = $("adminDashboard");

    if (login) {
        login.style.display = "flex";
    }

    if (dashboard) {
        dashboard.style.display = "none";
    }
}

function showDashboard(user = null) {
    const login = $("adminLogin");
    const dashboard = $("adminDashboard");

    if (login) {
        login.style.display = "none";
    }

    if (dashboard) {
        dashboard.style.display = "block";
    }

    const nameElement = $("adminName");

    if (nameElement) {
        const adminName =
            user?.name ||
            user?.email ||
            "Administrator";

        nameElement.textContent = adminName;
    }
}


// ============================================================
// REFRESH ADMIN
// ============================================================

async function refreshAdmin() {
    if (!adminToken) {
        showLogin();
        return;
    }

    try {
        await loadDashboard();

        const activeSection =
            document.querySelector(
                ".admin-section.active"
            );

        if (activeSection) {
            const sectionId =
                activeSection.id;

            if (sectionId === "usersSection") {
                await loadUsers();
            }

            if (sectionId === "productsSection") {
                await loadProducts();
            }

            if (sectionId === "ordersSection") {
                await loadOrders();
            }

            if (sectionId === "inspectionsSection") {
                await loadInspections();
            }
        }

        showMessage(
            "Admin data refreshed.",
            "success"
        );

    } catch (error) {
        console.error(error);

        showMessage(
            error.message || "Refresh failed.",
            "error"
        );
    }
}


// ============================================================
// SECTION NAVIGATION
// ============================================================

function showSection(sectionName) {
    const sections = document.querySelectorAll(
        ".admin-section"
    );

    sections.forEach(section => {
        section.classList.remove("active");

        section.style.display = "none";
    });

    const target =
        $(`${sectionName}Section`) ||
        $(`${sectionName}-section`) ||
        $(sectionName);

    if (target) {
        target.classList.add("active");
        target.style.display = "block";
    }

    const navLinks = document.querySelectorAll(
        "[data-section]"
    );

    navLinks.forEach(link => {
        link.classList.remove("active");

        if (
            link.dataset.section === sectionName
        ) {
            link.classList.add("active");
        }
    });

    if (sectionName === "dashboard") {
        loadDashboard();
    }

    if (sectionName === "users") {
        loadUsers();
    }

    if (sectionName === "products") {
        loadProducts();
    }

    if (sectionName === "orders") {
        loadOrders();
    }

    if (sectionName === "inspections") {
        loadInspections();
    }
}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
    try {
        const data = await apiRequest(
            "/api/admin/dashboard"
        );

        const dashboard =
            data.dashboard ||
            data.data ||
            data;

        setStat(
            [
                "totalUsers",
                "usersCount",
                "dashboardUsers"
            ],
            dashboard.totalUsers ??
            dashboard.users ??
            dashboard.userCount ??
            0
        );

        setStat(
            [
                "totalProducts",
                "productsCount",
                "dashboardProducts"
            ],
            dashboard.totalProducts ??
            dashboard.products ??
            dashboard.productCount ??
            0
        );

        setStat(
            [
                "totalOrders",
                "ordersCount",
                "dashboardOrders"
            ],
            dashboard.totalOrders ??
            dashboard.orders ??
            dashboard.orderCount ??
            0
        );

        setStat(
            [
                "totalInspections",
                "inspectionsCount",
                "dashboardInspections"
            ],
            dashboard.totalInspections ??
            dashboard.inspections ??
            dashboard.inspectionCount ??
            0
        );

        setStat(
            [
                "totalRevenue",
                "revenueCount",
                "dashboardRevenue"
            ],
            formatMoney(
                dashboard.totalRevenue ??
                dashboard.revenue ??
                0
            )
        );

        setStat(
            [
                "pendingOrders",
                "pendingOrdersCount"
            ],
            dashboard.pendingOrders ??
            0
        );

        return data;

    } catch (error) {
        console.error(
            "Dashboard error:",
            error
        );

        showMessage(
            error.message ||
            "Could not load dashboard.",
            "error"
        );

        throw error;
    }
}

function setStat(ids, value) {
    for (const id of ids) {
        const element = $(id);

        if (element) {
            element.textContent = value;
            return;
        }
    }
}


// ============================================================
// USERS
// ============================================================

async function loadUsers() {
    try {
        const data = await apiRequest(
            "/api/admin/users"
        );

        currentUsers =
            data.users ||
            data.data ||
            (Array.isArray(data) ? data : []);

        renderUsers(currentUsers);

        return currentUsers;

    } catch (error) {
        console.error(
            "Users error:",
            error
        );

        showMessage(
            error.message ||
            "Could not load users.",
            "error"
        );

        throw error;
    }
}

function renderUsers(users) {
    const container =
        $("usersList") ||
        $("usersTableBody") ||
        $("adminUsers");

    if (!container) {
        return;
    }

    if (!users.length) {
        container.innerHTML = `
            <div class="empty-state">
                No users found.
            </div>
        `;
        return;
    }

    const rows = users.map(user => `
        <tr>
            <td>${escapeHtml(user.name || "-")}</td>
            <td>${escapeHtml(user.email || "-")}</td>
            <td>${escapeHtml(user.phone || "-")}</td>
            <td>${escapeHtml(user.role || "user")}</td>
            <td>${formatDate(user.createdAt)}</td>
        </tr>
    `).join("");

    if (container.tagName === "TBODY") {
        container.innerHTML = rows;
    } else {
        container.innerHTML = `
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function searchUsers() {
    const input =
        $("userSearch") ||
        $("searchUsers");

    if (!input) {
        return;
    }

    const search =
        input.value.trim().toLowerCase();

    if (!search) {
        renderUsers(currentUsers);
        return;
    }

    const filtered = currentUsers.filter(user => {
        return [
            user.name,
            user.email,
            user.phone,
            user.role
        ]
            .filter(Boolean)
            .some(value =>
                String(value)
                    .toLowerCase()
                    .includes(search)
            );
    });

    renderUsers(filtered);
}


// ============================================================
// PRODUCTS
// ============================================================

async function loadProducts() {
    try {
        const data = await apiRequest(
            "/api/admin/products"
        );

        currentProducts =
            data.products ||
            data.data ||
            (Array.isArray(data) ? data : []);

        renderProducts(currentProducts);

        return currentProducts;

    } catch (error) {
        console.error(
            "Products error:",
            error
        );

        showMessage(
            error.message ||
            "Could not load products.",
            "error"
        );

        throw error;
    }
}

function renderProducts(products) {
    const container =
        $("productsList") ||
        $("productsTableBody") ||
        $("adminProducts");

    if (!container) {
        return;
    }

    if (!products.length) {
        container.innerHTML = `
            <div class="empty-state">
                No products/listings found.
            </div>
        `;
        return;
    }

    const rows = products.map(product => {
        const image =
            product.image ||
            (Array.isArray(product.images)
                ? product.images[0]
                : "");

        return `
            <tr>
                <td>
                    ${
                        image
                            ? `<img
                                src="${escapeHtml(image)}"
                                alt="${escapeHtml(product.name || "Product")}"
                                style="width:60px;height:60px;object-fit:cover;border-radius:8px;"
                                onerror="this.style.display='none'"
                              >`
                            : "-"
                    }
                </td>

                <td>
                    <strong>
                        ${escapeHtml(product.name || "-")}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(product.category || "-")}
                </td>

                <td>
                    ${formatMoney(product.price)}
                </td>

                <td>
                    ${escapeHtml(
                        String(
                            product.stock ??
                            product.quantity ??
                            0
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        product.location || "-"
                    )}
                </td>

                <td>
                    <button
                        type="button"
                        onclick="editProduct('${escapeHtml(product.id)}')"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        onclick="deleteProduct('${escapeHtml(product.id)}')"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (container.tagName === "TBODY") {
        container.innerHTML = rows;
    } else {
        container.innerHTML = `
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Location</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
}


// ============================================================
// ADD PRODUCT
// ============================================================

async function addProduct(event) {
    if (event) {
        event.preventDefault();
    }

    const getValue = (...ids) => {
        for (const id of ids) {
            const element = $(id);

            if (element) {
                return element.value.trim();
            }
        }

        return "";
    };

    const name = getValue(
        "productName",
        "newProductName"
    );

    const category = getValue(
        "productCategory",
        "newProductCategory"
    );

    const price = getValue(
        "productPrice",
        "newProductPrice"
    );

    const stock = getValue(
        "productStock",
        "newProductStock"
    );

    const description = getValue(
        "productDescription",
        "newProductDescription"
    );

    const image = getValue(
        "productImage",
        "newProductImage"
    );

    const location = getValue(
        "productLocation",
        "newProductLocation"
    );

    if (!name) {
        showMessage(
            "Please enter the product name.",
            "error"
        );
        return;
    }

    if (!category) {
        showMessage(
            "Please select a category.",
            "error"
        );
        return;
    }

    if (!price) {
        showMessage(
            "Please enter the price.",
            "error"
        );
        return;
    }

    const product = {
        name,
        category,
        price: Number(price),
        stock: Number(stock || 0),
        description,
        image,
        images: image ? [image] : [],
        location,
        listingType: "product"
    };

    try {
        const data = await apiRequest(
            "/api/admin/products",
            {
                method: "POST",
                body: JSON.stringify(product)
            }
        );

        showMessage(
            data.message ||
            "Product added successfully.",
            "success"
        );

        clearProductForm();

        await loadProducts();
        await loadDashboard();

    } catch (error) {
        console.error(
            "Add product error:",
            error
        );

        showMessage(
            error.message ||
            "Could not add product.",
            "error"
        );
    }
}

function clearProductForm() {
    const ids = [
        "productName",
        "newProductName",
        "productCategory",
        "newProductCategory",
        "productPrice",
        "newProductPrice",
        "productStock",
        "newProductStock",
        "productDescription",
        "newProductDescription",
        "productImage",
        "newProductImage",
        "productLocation",
        "newProductLocation"
    ];

    ids.forEach(id => {
        const element = $(id);

        if (element) {
            element.value = "";
        }
    });
}


// ============================================================
// EDIT PRODUCT
// ============================================================

async function editProduct(productId) {
    const product =
        currentProducts.find(
            item => String(item.id) === String(productId)
        );

    if (!product) {
        showMessage(
            "Product not found.",
            "error"
        );
        return;
    }

    const name = prompt(
        "Product name:",
        product.name || ""
    );

    if (name === null) {
        return;
    }

    const price = prompt(
        "Price:",
        product.price || 0
    );

    if (price === null) {
        return;
    }

    const stock = prompt(
        "Stock:",
        product.stock ??
        product.quantity ??
        0
    );

    if (stock === null) {
        return;
    }

    const description = prompt(
        "Description:",
        product.description || ""
    );

    if (description === null) {
        return;
    }

    const location = prompt(
        "Location:",
        product.location || ""
    );

    if (location === null) {
        return;
    }

    const image = prompt(
        "Image URL:",
        product.image ||
        (Array.isArray(product.images)
            ? product.images[0] || ""
            : "")
    );

    if (image === null) {
        return;
    }

    const updatedProduct = {
        ...product,
        name: name.trim(),
        price: Number(price),
        stock: Number(stock),
        description: description.trim(),
        location: location.trim(),
        image: image.trim(),
        images: image.trim()
            ? [image.trim()]
            : []
    };

    delete updatedProduct.id;
    delete updatedProduct._id;

    try {
        const data = await apiRequest(
            `/api/admin/products/${encodeURIComponent(productId)}`,
            {
                method: "PUT",
                body: JSON.stringify(updatedProduct)
            }
        );

        showMessage(
            data.message ||
            "Product updated successfully.",
            "success"
        );

        await loadProducts();

    } catch (error) {
        console.error(
            "Edit product error:",
            error
        );

        showMessage(
            error.message ||
            "Could not update product.",
            "error"
        );
    }
}


// ============================================================
// DELETE PRODUCT
// ============================================================

async function deleteProduct(productId) {
    const product =
        currentProducts.find(
            item => String(item.id) === String(productId)
        );

    const productName =
        product?.name || "this product";

    const confirmed = confirm(
        `Are you sure you want to delete "${productName}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const data = await apiRequest(
            `/api/admin/products/${encodeURIComponent(productId)}`,
            {
                method: "DELETE"
            }
        );

        showMessage(
            data.message ||
            "Product deleted successfully.",
            "success"
        );

        await loadProducts();
        await loadDashboard();

    } catch (error) {
        console.error(
            "Delete product error:",
            error
        );

        showMessage(
            error.message ||
            "Could not delete product.",
            "error"
        );
    }
}


// ============================================================
// ORDERS
// ============================================================

async function loadOrders() {
    try {
        const data = await apiRequest(
            "/api/admin/orders"
        );

        currentOrders =
            data.orders ||
            data.data ||
            (Array.isArray(data) ? data : []);

        renderOrders(currentOrders);

        return currentOrders;

    } catch (error) {
        console.error(
            "Orders error:",
            error
        );

        showMessage(
            error.message ||
            "Could not load orders.",
            "error"
        );

        throw error;
    }
}

function renderOrders(orders) {
    const container =
        $("ordersList") ||
        $("ordersTableBody") ||
        $("adminOrders");

    if (!container) {
        return;
    }

    if (!orders.length) {
        container.innerHTML = `
            <div class="empty-state">
                No orders found.
            </div>
        `;
        return;
    }

    const rows = orders.map(order => {
        const customer =
            order.customerName ||
            order.name ||
            order.userName ||
            order.customer?.name ||
            "-";

        const email =
            order.customerEmail ||
            order.email ||
            order.userEmail ||
            order.customer?.email ||
            "-";

        const amount =
            order.total ??
            order.totalAmount ??
            order.amount ??
            0;

        const status =
            order.status ||
            "pending";

        return `
            <tr>
                <td>
                    ${escapeHtml(
                        order.id ||
                        order._id ||
                        "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(customer)}
                </td>

                <td>
                    ${escapeHtml(email)}
                </td>

                <td>
                    ${formatMoney(amount)}
                </td>

                <td>
                    <select
                        onchange="updateOrderStatus('${escapeHtml(
                            order.id ||
                            order._id ||
                            ""
                        )}', this.value)"
                    >
                        ${orderStatusOptions(status)}
                    </select>
                </td>

                <td>
                    ${formatDate(
                        order.createdAt ||
                        order.date
                    )}
                </td>
            </tr>
        `;
    }).join("");

    if (container.tagName === "TBODY") {
        container.innerHTML = rows;
    } else {
        container.innerHTML = `
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Email</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function orderStatusOptions(current) {
    const statuses = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled"
    ];

    return statuses.map(status => `
        <option
            value="${status}"
            ${status === current ? "selected" : ""}
        >
            ${status.charAt(0).toUpperCase() + status.slice(1)}
        </option>
    `).join("");
}

async function updateOrderStatus(orderId, status) {
    if (!orderId) {
        showMessage(
            "Order ID is missing.",
            "error"
        );
        return;
    }

    try {
        const data = await apiRequest(
            `/api/admin/orders/${encodeURIComponent(orderId)}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    status
                })
            }
        );

        showMessage(
            data.message ||
            "Order status updated.",
            "success"
        );

        await loadOrders();

    } catch (error) {
        console.error(
            "Order status error:",
            error
        );

        showMessage(
            error.message ||
            "Could not update order.",
            "error"
        );
    }
}


// ============================================================
// INSPECTIONS
// ============================================================

async function loadInspections() {
    try {
        let data;

        const possibleRoutes = [
            "/api/admin/inspections",
            "/api/admin/inspection-requests"
        ];

        let lastError = null;

        for (const route of possibleRoutes) {
            try {
                data = await apiRequest(route);
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!data) {
            throw lastError ||
                new Error(
                    "Could not load inspections."
                );
        }

        currentInspections =
            data.inspections ||
            data.requests ||
            data.data ||
            (Array.isArray(data) ? data : []);

        renderInspections(
            currentInspections
        );

        return currentInspections;

    } catch (error) {
        console.error(
            "Inspections error:",
            error
        );

        showMessage(
            error.message ||
            "Could not load inspection requests.",
            "error"
        );

        throw error;
    }
}

function renderInspections(inspections) {
    const container =
        $("inspectionsList") ||
        $("inspectionsTableBody") ||
        $("adminInspections");

    if (!container) {
        return;
    }

    if (!inspections.length) {
        container.innerHTML = `
            <div class="empty-state">
                No inspection requests found.
            </div>
        `;
        return;
    }

    const rows = inspections.map(item => {
        const customer =
            item.customerName ||
            item.name ||
            item.userName ||
            item.customer?.name ||
            "-";

        const phone =
            item.phone ||
            item.customerPhone ||
            item.customer?.phone ||
            "-";

        const product =
            item.productName ||
            item.listingName ||
            item.product?.name ||
            "-";

        const status =
            item.status ||
            "pending";

        return `
            <tr>
                <td>
                    ${escapeHtml(customer)}
                </td>

                <td>
                    ${escapeHtml(phone)}
                </td>

                <td>
                    ${escapeHtml(product)}
                </td>

                <td>
                    ${escapeHtml(status)}
                </td>

                <td>
                    ${formatDate(
                        item.createdAt ||
                        item.date
                    )}
                </td>
            </tr>
        `;
    }).join("");

    if (container.tagName === "TBODY") {
        container.innerHTML = rows;
    } else {
        container.innerHTML = `
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Product</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
}


// ============================================================
// FORM SUBMISSION
// ============================================================

function setupForms() {
    const loginForm =
        document.querySelector(
            "#adminLogin form"
        );

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            function (event) {
                event.preventDefault();
                loginAdmin();
            }
        );
    }

    const productForm =
        $("productForm") ||
        $("addProductForm");

    if (productForm) {
        productForm.addEventListener(
            "submit",
            function (event) {
                addProduct(event);
            }
        );
    }

    const userSearch =
        $("userSearch") ||
        $("searchUsers");

    if (userSearch) {
        userSearch.addEventListener(
            "input",
            searchUsers
        );
    }
}


// ============================================================
// NAVIGATION SETUP
// ============================================================

function setupNavigation() {
    document.querySelectorAll(
        "[data-section]"
    ).forEach(link => {
        link.addEventListener(
            "click",
            function (event) {
                event.preventDefault();

                showSection(
                    this.dataset.section
                );
            }
        );
    });
}


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.checkAdminSession = checkAdminSession;
window.refreshAdmin = refreshAdmin;
window.showSection = showSection;

window.loadDashboard = loadDashboard;
window.loadUsers = loadUsers;
window.searchUsers = searchUsers;

window.loadProducts = loadProducts;
window.addProduct = addProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

window.loadOrders = loadOrders;
window.updateOrderStatus = updateOrderStatus;

window.loadInspections = loadInspections;


// ============================================================
// START ADMIN PAGE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {
        setupForms();
        setupNavigation();

        checkAdminSession();
    }
);