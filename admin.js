/* =========================================================
   NAIJADEALS ADMIN.JS
========================================================= */

"use strict";


const API = "/api";


let adminToken =
    localStorage.getItem(
        "naijaDealsAdminToken"
    );


let currentAdmin = null;

let currentProducts = [];

let currentUsers = [];

let currentOrders = [];

let currentInspections = [];


/* =========================================================
   BASIC HELPERS
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function money(value) {

    return "₦" +
        Number(value || 0)
            .toLocaleString(
                "en-NG",
                {
                    maximumFractionDigits: 0
                }
            );

}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(
        "en-NG",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );

}


/* =========================================================
   API
========================================================= */

async function api(
    endpoint,
    options = {}
) {

    const headers = {

        ...(options.body
            ? {
                "Content-Type":
                    "application/json"
            }
            : {}),

        ...(options.headers || {})

    };


    if (adminToken) {

        headers.Authorization =
            "Bearer " +
            adminToken;

    }


    const response =
        await fetch(
            API + endpoint,
            {
                ...options,
                headers
            }
        );


    let data = {};

    try {

        data =
            await response.json();

    }

    catch {

        data = {};

    }


    if (!response.ok) {

        throw new Error(
            data.message ||
            "Request failed."
        );

    }


    return data;

}


/* =========================================================
   LOGIN
========================================================= */

async function loginAdmin() {

    const email =
        document
            .getElementById("adminEmail")
            ?.value
            .trim();

    const password =
        document
            .getElementById("adminPassword")
            ?.value;


    if (!email || !password) {

        showMessage(
            "Enter your admin email and password.",
            true
        );

        return;

    }


    try {

        const data =
            await api(
                "/login",
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            email,
                            password
                        })
                }
            );


        if (
            !data.user ||
            data.user.role !== "admin"
        ) {

            throw new Error(
                "This account is not an administrator."
            );

        }


        adminToken =
            data.token;


        currentAdmin =
            data.user;


        localStorage.setItem(
            "naijaDealsAdminToken",
            adminToken
        );


        showDashboard();


        await loadAll();

    }

    catch (error) {

        showMessage(
            error.message ||
            "Admin login failed.",
            true
        );

    }

}


/* =========================================================
   CHECK EXISTING ADMIN SESSION
========================================================= */

async function checkAdminSession() {

    if (!adminToken) {

        showLogin();

        return;

    }


    try {

        const data =
            await api(
                "/me"
            );


        if (
            !data.user ||
            data.user.role !== "admin"
        ) {

            throw new Error(
                "Not an administrator."
            );

        }


        currentAdmin =
            data.user;


        showDashboard();


        await loadAll();

    }

    catch {

        localStorage.removeItem(
            "naijaDealsAdminToken"
        );

        adminToken = null;

        showLogin();

    }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

    try {

        if (adminToken) {

            await api(
                "/logout",
                {
                    method: "POST"
                }
            );

        }

    }

    catch {

        // Ignore logout API errors.

    }


    localStorage.removeItem(
        "naijaDealsAdminToken"
    );


    adminToken = null;

    currentAdmin = null;


    showLogin();

}


/* =========================================================
   LOGIN / DASHBOARD
========================================================= */

function showLogin() {

    const login =
        document.getElementById(
            "adminLogin"
        );

    const dashboard =
        document.getElementById(
            "adminDashboard"
        );


    if (login) {

        login.style.display =
            "flex";

    }


    if (dashboard) {

        dashboard.style.display =
            "none";

    }

}


function showDashboard() {

    const login =
        document.getElementById(
            "adminLogin"
        );

    const dashboard =
        document.getElementById(
            "adminDashboard"
        );


    if (login) {

        login.style.display =
            "none";

    }


    if (dashboard) {

        dashboard.style.display =
            "block";

    }


    const adminName =
        document.getElementById(
            "adminName"
        );


    if (
        adminName &&
        currentAdmin
    ) {

        adminName.textContent =
            currentAdmin.name ||
            "Admin";

    }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    error = false
) {

    const element =
        document.getElementById(
            "adminMessage"
        );


    if (!element) {

        alert(message);

        return;

    }


    element.textContent =
        message;


    element.style.display =
        "block";


    element.style.background =
        error
            ? "#fee2e2"
            : "#dcfce7";


    element.style.color =
        error
            ? "#991b1b"
            : "#166534";


    setTimeout(() => {

        element.style.display =
            "none";

    }, 4000);

}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadAll() {

    try {

        await Promise.all([

            loadDashboard(),

            loadUsers(),

            loadProducts(),

            loadOrders(),

            loadInspections()

        ]);

    }

    catch (error) {

        showMessage(
            error.message,
            true
        );

    }

}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

    const data =
        await api(
            "/admin/dashboard"
        );


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
        money(stats.revenue)
    );


    setText(
        "inspectionCount",
        currentInspections.length
    );

}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

    const data =
        await api(
            "/admin/users"
        );


    currentUsers =
        data.users || [];


    renderUsers(
        currentUsers
    );

}


function renderUsers(users) {

    const tbody =
        document.getElementById(
            "usersTableBody"
        );


    if (!tbody) return;


    if (!users.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="6">
                    No users found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        users
            .map(user => `

                <tr>

                    <td>
                        ${escapeHtml(user.name)}
                    </td>

                    <td>
                        ${escapeHtml(user.email)}
                    </td>

                    <td>
                        ${escapeHtml(user.phone || "-")}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(user.role)}
                        </strong>
                    </td>

                    <td>
                        ${formatDate(user.createdAt)}
                    </td>

                    <td>
                        ${escapeHtml(user.id)}
                    </td>

                </tr>

            `)
            .join("");

}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

    const data =
        await api(
            "/admin/products"
        );


    currentProducts =
        data.products || [];


    renderProducts(
        currentProducts
    );

}


function renderProducts(products) {

    const tbody =
        document.getElementById(
            "productsTableBody"
        );


    if (!tbody) return;


    if (!products.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="8">
                    No products found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        products
            .map(product => `

                <tr>

                    <td>

                        <img
                            src="${escapeHtml(
                                product.image || ""
                            )}"
                            alt=""
                            style="
                                width:55px;
                                height:55px;
                                object-fit:cover;
                                border-radius:10px;
                                background:#eee;
                            "
                            onerror="
                                this.style.display='none'
                            "
                        >

                    </td>

                    <td>
                        ${escapeHtml(product.name)}
                    </td>

                    <td>
                        ${escapeHtml(product.category)}
                    </td>

                    <td>
                        ${money(product.price)}
                    </td>

                    <td>
                        ${product.stock}
                    </td>

                    <td>
                        ${escapeHtml(
                            product.location || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            product.sellerName || "Admin"
                        )}
                    </td>

                    <td>

                        <button
                            onclick="
                                editProduct(
                                    '${escapeHtml(product.id)}'
                                )
                            "
                        >
                            Edit
                        </button>

                        <button
                            onclick="
                                deleteProduct(
                                    '${escapeHtml(product.id)}'
                                )
                            "
                            style="
                                background:#dc2626;
                                color:white;
                            "
                        >
                            Delete
                        </button>

                    </td>

                </tr>

            `)
            .join("");

}


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function deleteProduct(id) {

    if (
        !confirm(
            "Delete this product?"
        )
    ) {

        return;

    }


    try {

        await api(
            "/admin/products/" +
            encodeURIComponent(id),
            {
                method: "DELETE"
            }
        );


        showMessage(
            "Product deleted."
        );


        await loadProducts();

        await loadDashboard();

    }

    catch (error) {

        showMessage(
            error.message,
            true
        );

    }

}


/* =========================================================
   EDIT PRODUCT
========================================================= */

async function editProduct(id) {

    const product =
        currentProducts.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!product) {

        return;

    }


    const name =
        prompt(
            "Product name:",
            product.name
        );


    if (name === null) return;


    const price =
        prompt(
            "Price:",
            product.price
        );


    if (price === null) return;


    const stock =
        prompt(
            "Stock:",
            product.stock
        );


    if (stock === null) return;


    try {

        await api(
            "/admin/products/" +
            encodeURIComponent(id),
            {
                method: "PUT",

                body:
                    JSON.stringify({

                        name,

                        price:
                            Number(price),

                        stock:
                            Number(stock)

                    })
            }
        );


        showMessage(
            "Product updated."
        );


        await loadProducts();

    }

    catch (error) {

        showMessage(
            error.message,
            true
        );

    }

}


/* =========================================================
   ORDERS
========================================================= */

async function loadOrders() {

    const data =
        await api(
            "/admin/orders"
        );


    currentOrders =
        data.orders || [];


    renderOrders(
        currentOrders
    );

}


function renderOrders(orders) {

    const tbody =
        document.getElementById(
            "ordersTableBody"
        );


    if (!tbody) return;


    if (!orders.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="8">
                    No orders found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        orders
            .map(order => `

                <tr>

                    <td>
                        ${escapeHtml(
                            order.orderNumber ||
                            order.id
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            order.customerName || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            order.customerPhone || "-"
                        )}
                    </td>

                    <td>
                        ${money(order.total)}
                    </td>

                    <td>
                        ${escapeHtml(
                            order.paymentStatus ||
                            "-"
                        )}
                    </td>

                    <td>

                        <select
                            onchange="
                                updateOrderStatus(
                                    '${escapeHtml(order.id)}',
                                    this.value
                                )
                            "
                        >

                            ${[
                                "Pending",
                                "Confirmed",
                                "Processing",
                                "Shipped",
                                "Delivered",
                                "Cancelled"
                            ]
                                .map(status => `

                                    <option
                                        value="${status}"
                                        ${
                                            order.status === status
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${status}
                                    </option>

                                `)
                                .join("")}

                        </select>

                    </td>

                    <td>
                        ${formatDate(order.createdAt)}
                    </td>

                    <td>
                        ${escapeHtml(
                            order.deliveryAddress ||
                            "-"
                        )}
                    </td>

                </tr>

            `)
            .join("");

}


/* =========================================================
   UPDATE ORDER
========================================================= */

async function updateOrderStatus(
    id,
    status
) {

    try {

        await api(
            "/admin/orders/" +
            encodeURIComponent(id),
            {
                method: "PUT",

                body:
                    JSON.stringify({
                        status
                    })
            }
        );


        showMessage(
            "Order status updated."
        );


        await loadOrders();

    }

    catch (error) {

        showMessage(
            error.message,
            true
        );

    }

}


/* =========================================================
   INSPECTION REQUESTS
========================================================= */

async function loadInspections() {

    const data =
        await api(
            "/admin/inspection-requests"
        );


    currentInspections =
        data.requests || [];


    renderInspections(
        currentInspections
    );


    setText(
        "inspectionCount",
        currentInspections.length
    );

}


function renderInspections(
    requests
) {

    const tbody =
        document.getElementById(
            "inspectionTableBody"
        );


    if (!tbody) return;


    if (!requests.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="10">

                    No inspection requests yet.

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        requests
            .map(request => `

                <tr>

                    <td>

                        <strong>
                            ${escapeHtml(
                                request.name
                            )}
                        </strong>

                        <br>

                        <small>
                            ${escapeHtml(
                                request.email || "-"
                            )}
                        </small>

                    </td>

                    <td>
                        ${escapeHtml(
                            request.phone
                        )}
                    </td>

                    <td>

                        <strong>
                            ${escapeHtml(
                                request.productName ||
                                "-"
                            )}
                        </strong>

                        <br>

                        <small>
                            ${escapeHtml(
                                request.category ||
                                "-"
                            )}
                        </small>

                    </td>

                    <td>

                        ${escapeHtml(
                            request.location ||
                            "-"
                        )}

                    </td>

                    <td>

                        ${escapeHtml(
                            request.date
                        )}

                    </td>

                    <td>

                        ${escapeHtml(
                            request.time
                        )}

                    </td>

                    <td>

                        <span
                            class="
                                status-badge
                                status-${escapeHtml(
                                    request.status
                                )}
                            "
                        >

                            ${escapeHtml(
                                request.status
                            )}

                        </span>

                    </td>

                    <td>

                        <select
                            onchange="
                                updateInspectionStatus(
                                    '${escapeHtml(
                                        request.id
                                    )}',
                                    this.value
                                )
                            "
                        >

                            <option
                                value="pending"
                                ${
                                    request.status === "pending"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Pending
                            </option>

                            <option
                                value="confirmed"
                                ${
                                    request.status === "confirmed"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Confirmed
                            </option>

                            <option
                                value="completed"
                                ${
                                    request.status === "completed"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Completed
                            </option>

                            <option
                                value="cancelled"
                                ${
                                    request.status === "cancelled"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Cancelled
                            </option>

                        </select>

                    </td>

                    <td>

                        <button
                            onclick="
                                viewInspection(
                                    '${escapeHtml(
                                        request.id
                                    )}'
                                )
                            "
                        >
                            View
                        </button>

                    </td>

                    <td>

                        ${formatDate(
                            request.createdAt
                        )}

                    </td>

                </tr>

            `)
            .join("");

}


/* =========================================================
   VIEW INSPECTION
========================================================= */

function viewInspection(id) {

    const request =
        currentInspections.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!request) {

        return;

    }


    const message = `

Customer:
${request.name}

Phone:
${request.phone}

Email:
${request.email || "-"}

Listing:
${request.productName || "-"}

Category:
${request.category || "-"}

Location:
${request.location || "-"}

Date:
${request.date}

Time:
${request.time}

Message:
${request.message || "-"}

Status:
${request.status}

Created:
${formatDate(request.createdAt)}

    `.trim();


    alert(message);

}


/* =========================================================
   UPDATE INSPECTION STATUS
========================================================= */

async function updateInspectionStatus(
    id,
    status
) {

    try {

        await api(
            "/admin/inspection-requests/" +
            encodeURIComponent(id),
            {
                method: "PUT",

                body:
                    JSON.stringify({
                        status
                    })
            }
        );


        showMessage(
            "Inspection status updated."
        );


        await loadInspections();

    }

    catch (error) {

        showMessage(
            error.message,
            true
        );

    }

}


/* =========================================================
   SEARCH TABLES
========================================================= */

function searchUsers(value) {

    const query =
        String(value || "")
            .toLowerCase()
            .trim();


    renderUsers(
        currentUsers.filter(
            user =>
                String(
                    user.name
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    user.email
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    user.phone
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    user.role
                )
                    .toLowerCase()
                    .includes(query)
        )
    );

}


function searchProducts(value) {

    const query =
        String(value || "")
            .toLowerCase()
            .trim();


    renderProducts(
        currentProducts.filter(
            product =>
                String(
                    product.name
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    product.category
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    product.location
                )
                    .toLowerCase()
                    .includes(query)
        )
    );

}


function searchInspections(value) {

    const query =
        String(value || "")
            .toLowerCase()
            .trim();


    renderInspections(
        currentInspections.filter(
            request =>
                String(
                    request.name
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    request.phone
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    request.productName
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    request.location
                )
                    .toLowerCase()
                    .includes(query)
        )
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function showSection(id) {

    document
        .querySelectorAll(
            ".admin-section"
        )
        .forEach(section => {

            section.style.display =
                "none";

        });


    const section =
        document.getElementById(id);


    if (section) {

        section.style.display =
            "block";

    }


    document
        .querySelectorAll(
            ".admin-nav button"
        )
        .forEach(button => {

            button.classList.remove(
                "active"
            );

        });


    const navButton =
        document.querySelector(
            `[data-section="${id}"]`
        );


    if (navButton) {

        navButton.classList.add(
            "active"
        );

    }

}


/* =========================================================
   REFRESH
========================================================= */

async function refreshAdmin() {

    try {

        await loadAll();

        showMessage(
            "Admin data refreshed."
        );

    }

    catch (error) {

        showMessage(
            error.message,
            true
        );

    }

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   STARTUP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAdminSession();

    }
);