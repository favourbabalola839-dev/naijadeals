const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   BASIC APP SETUP
========================================================= */

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Serve index.html, admin.html, seller.html, etc.
app.use(express.static(__dirname));

/* =========================================================
   DATA FILES
========================================================= */

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultValue = []) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    }
}

ensureFile(USERS_FILE, []);
ensureFile(PRODUCTS_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(SESSIONS_FILE, []);

function readJSON(file) {
    try {
        const data = fs.readFileSync(file, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Could not read:", file, error.message);
        return [];
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =========================================================
   HELPERS
========================================================= */

function makeId(prefix = "id") {
    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        crypto.randomBytes(4).toString("hex")
    );
}

function cleanText(value, maxLength = 500) {
    if (value === undefined || value === null) return "";
    return String(value).trim().slice(0, maxLength);
}

function cleanNumber(value, fallback = 0) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
}

function makeMapUrl(location) {
    if (!location) return "";

    return (
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(location)
    );
}

function normalizeImages(body = {}) {
    let images = [];

    if (Array.isArray(body.images)) {
        images = body.images
            .map((image) => cleanText(image, 1000))
            .filter(Boolean);
    }

    const mainImage = cleanText(body.image, 1000);

    if (mainImage && !images.includes(mainImage)) {
        images.unshift(mainImage);
    }

    return images.slice(0, 10);
}

function getListingType(category) {
    if (category === "Cars") {
        return "car";
    }

    if (category === "Houses & Property") {
        return "property";
    }

    return "product";
}

function normalizeProduct(product = {}) {
    const category = cleanText(product.category, 100);

    const images = normalizeImages(product);

    const location = cleanText(product.location, 300);

    return {
        ...product,

        id: product.id || makeId("prod"),

        name: cleanText(product.name, 200),

        category,

        price: cleanNumber(product.price),

        stock: Math.max(0, Math.floor(cleanNumber(product.stock, 0))),

        description: cleanText(product.description, 2000),

        image: images[0] || "",

        images,

        location,

        mapUrl: location ? makeMapUrl(location) : "",

        listingType: getListingType(category),

        sellerId: product.sellerId || "",

        sellerName: product.sellerName || "",

        // Car fields
        make: cleanText(product.make, 100),
        model: cleanText(product.model, 100),
        year: cleanNumber(product.year, 0),
        mileage: cleanNumber(product.mileage, 0),
        transmission: cleanText(product.transmission, 100),
        fuelType: cleanText(product.fuelType, 100),

        // Property fields
        propertyType: cleanText(product.propertyType, 100),
        bedrooms: cleanNumber(product.bedrooms, 0),
        bathrooms: cleanNumber(product.bathrooms, 0),
        parking: cleanNumber(product.parking, 0),
        size: cleanText(product.size, 100),

        // Useful marketplace flags
        condition: cleanText(product.condition, 100),

        isDemo: Boolean(product.isDemo),

        createdAt: product.createdAt || new Date().toISOString(),

        updatedAt: new Date().toISOString()
    };
}

function cleanUser(user) {
    if (!user) return null;

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        createdAt: user.createdAt
    };
}

/* =========================================================
   AUTHENTICATION
========================================================= */

function getTokenFromRequest(req) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    return header.substring(7).trim();
}

function getCurrentUser(req) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return null;
    }

    const sessions = readJSON(SESSIONS_FILE);

    const session = sessions.find(
        (item) => item.token === token
    );

    if (!session) {
        return null;
    }

    const users = readJSON(USERS_FILE);

    return users.find(
        (user) => user.id === session.userId
    ) || null;
}

function requireLogin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    if (user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    req.user = user;
    next();
}

function requireSeller(req, res, next) {
    const user = getCurrentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    if (user.role !== "seller" && user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Seller access required."
        });
    }

    req.user = user;
    next();
}

/* =========================================================
   DEFAULT ADMIN
========================================================= */

async function ensureAdmin() {
    const users = readJSON(USERS_FILE);

    const existingAdmin = users.find(
        (user) =>
            user.email === "favourbabalola839@gmail.com" ||
            user.role === "admin"
    );

    if (existingAdmin) {
        return;
    }

    const passwordHash = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "Admin12345",
        10
    );

    const admin = {
        id: "admin001",
        name: "phablo",
        email: "favourbabalola839@gmail.com",
        passwordHash,
        phone: "",
        role: "admin",
        createdAt: new Date().toISOString()
    };

    users.push(admin);

    writeJSON(USERS_FILE, users);

    console.log("Default admin created.");
}

/* =========================================================
   PRODUCT IMAGE FALLBACKS
========================================================= */

const CATEGORY_IMAGES = {
    Phones:
        "https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=900",

    Electronics:
        "https://images.pexels.com/photos/325153/pexels-photo-325153.jpeg?auto=compress&cs=tinysrgb&w=900",

    Power:
        "https://images.pexels.com/photos/356036/pexels-photo-356036.jpeg?auto=compress&cs=tinysrgb&w=900",

    Fashion:
        "https://images.pexels.com/photos/994523/pexels-photo-994523.jpeg?auto=compress&cs=tinysrgb&w=900",

    Beauty:
        "https://images.pexels.com/photos/2113855/pexels-photo-2113855.jpeg?auto=compress&cs=tinysrgb&w=900",

    Food:
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",

    "Home & Kitchen":
        "https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=900",

    "Baby & Kids":
        "https://images.pexels.com/photos/3933025/pexels-photo-3933025.jpeg?auto=compress&cs=tinysrgb&w=900",

    Auto:
        "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=900",

    Tools:
        "https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=900",

    "Sports & Fitness":
        "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=900",

    "School & Office":
        "https://images.pexels.com/photos/1592786/pexels-photo-1592786.jpeg?auto=compress&cs=tinysrgb&w=900",

    Gifts:
        "https://images.pexels.com/photos/1304473/pexels-photo-1304473.jpeg?auto=compress&cs=tinysrgb&w=900",

    Cars:
        "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=900",

    "Houses & Property":
        "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=900"
};

/* =========================================================
   EXISTING PRODUCT MIGRATION
========================================================= */

function upgradeExistingProducts() {
    const products = readJSON(PRODUCTS_FILE);

    if (!Array.isArray(products) || products.length === 0) {
        return;
    }

    let changed = false;

    const upgraded = products.map((product) => {
        const item = normalizeProduct(product);

        if (!item.image && CATEGORY_IMAGES[item.category]) {
            item.image = CATEGORY_IMAGES[item.category];
            item.images = [item.image];
            changed = true;
        }

        if (!item.images || item.images.length === 0) {
            item.images = item.image ? [item.image] : [];
            changed = true;
        }

        if (!item.listingType) {
            item.listingType = getListingType(item.category);
            changed = true;
        }

        return item;
    });

    if (changed) {
        writeJSON(PRODUCTS_FILE, upgraded);
        console.log("Existing products upgraded.");
    }
}

/* =========================================================
   DEMO CARS / PROPERTY
========================================================= */

function addDemoListings() {
    let products = readJSON(PRODUCTS_FILE);

    if (!Array.isArray(products)) {
        products = [];
    }

    const hasCars = products.some(
        (product) => product.category === "Cars"
    );

    const hasProperty = products.some(
        (product) => product.category === "Houses & Property"
    );

    if (!hasCars) {
        products.push(
            normalizeProduct({
                id: "demo_car_001",
                name: "Toyota Camry 2020",
                category: "Cars",
                price: 18500000,
                stock: 1,
                emoji: "🚗",
                description:
                    "Sample car listing. Actual sellers can replace this with their own vehicle photos and details.",
                image: CATEGORY_IMAGES.Cars,
                images: [CATEGORY_IMAGES.Cars],
                location: "Lekki Phase 1, Lagos",
                make: "Toyota",
                model: "Camry",
                year: 2020,
                mileage: 58000,
                transmission: "Automatic",
                fuelType: "Petrol",
                condition: "Used",
                sellerName: "NaijaDeals Sample Seller",
                isDemo: true
            })
        );

        products.push(
            normalizeProduct({
                id: "demo_car_002",
                name: "Lexus RX 350 2019",
                category: "Cars",
                price: 28500000,
                stock: 1,
                emoji: "🚙",
                description:
                    "Sample car listing. Seller-owned vehicle photos can be added from the seller dashboard.",
                image: CATEGORY_IMAGES.Cars,
                images: [CATEGORY_IMAGES.Cars],
                location: "Wuse 2, Abuja",
                make: "Lexus",
                model: "RX 350",
                year: 2019,
                mileage: 64000,
                transmission: "Automatic",
                fuelType: "Petrol",
                condition: "Used",
                sellerName: "NaijaDeals Sample Seller",
                isDemo: true
            })
        );
    }

    if (!hasProperty) {
        products.push(
            normalizeProduct({
                id: "demo_property_001",
                name: "Modern 4 Bedroom Detached Duplex",
                category: "Houses & Property",
                price: 85000000,
                stock: 1,
                emoji: "🏠",
                description:
                    "Sample property listing for demonstration. Real sellers should provide the exact property location and their own photographs.",
                image: CATEGORY_IMAGES["Houses & Property"],
                images: [CATEGORY_IMAGES["Houses & Property"]],
                location: "Lekki Phase 1, Lagos",
                propertyType: "Detached Duplex",
                bedrooms: 4,
                bathrooms: 5,
                parking: 3,
                size: "450 sqm",
                condition: "New",
                sellerName: "NaijaDeals Sample Seller",
                isDemo: true
            })
        );

        products.push(
            normalizeProduct({
                id: "demo_property_002",
                name: "3 Bedroom Apartment",
                category: "Houses & Property",
                price: 55000000,
                stock: 1,
                emoji: "🏢",
                description:
                    "Sample property listing. Real property listings should be supplied by sellers with accurate location information.",
                image: CATEGORY_IMAGES["Houses & Property"],
                images: [CATEGORY_IMAGES["Houses & Property"]],
                location: "Ikeja GRA, Lagos",
                propertyType: "Apartment",
                bedrooms: 3,
                bathrooms: 4,
                parking: 2,
                size: "220 sqm",
                condition: "New",
                sellerName: "NaijaDeals Sample Seller",
                isDemo: true
            })
        );
    }

    writeJSON(
        PRODUCTS_FILE,
        products.map(normalizeProduct)
    );
}

/* =========================================================
   AUTH ROUTES
========================================================= */

app.post("/api/register", async (req, res) => {
    try {
        const users = readJSON(USERS_FILE);

        const name = cleanText(req.body.name, 100);
        const email = cleanText(req.body.email, 200).toLowerCase();
        const phone = cleanText(req.body.phone, 50);
        const password = String(req.body.password || "");
        const requestedRole = cleanText(req.body.role, 30).toLowerCase();

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters."
            });
        }

        const exists = users.find(
            (user) => user.email.toLowerCase() === email
        );

        if (exists) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        let role = "customer";

        if (requestedRole === "seller") {
            role = "seller";
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = {
            id: makeId("user"),
            name,
            email,
            phone,
            passwordHash,
            role,
            createdAt: new Date().toISOString()
        };

        users.push(user);

        writeJSON(USERS_FILE, users);

        return res.json({
            success: true,
            message: "Account created successfully.",
            user: cleanUser(user)
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const users = readJSON(USERS_FILE);

        const email = cleanText(req.body.email, 200).toLowerCase();
        const password = String(req.body.password || "");

        const user = users.find(
            (item) => item.email.toLowerCase() === email
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = crypto.randomBytes(32).toString("hex");

        const sessions = readJSON(SESSIONS_FILE);

        sessions.push({
            id: makeId("session"),
            token,
            userId: user.id,
            createdAt: new Date().toISOString()
        });

        writeJSON(SESSIONS_FILE, sessions);

        return res.json({
            success: true,
            message: "Login successful.",
            token,
            user: cleanUser(user)
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

app.post("/api/logout", requireLogin, (req, res) => {
    const token = getTokenFromRequest(req);

    let sessions = readJSON(SESSIONS_FILE);

    sessions = sessions.filter(
        (session) => session.token !== token
    );

    writeJSON(SESSIONS_FILE, sessions);

    res.json({
        success: true,
        message: "Logged out."
    });
});

app.get("/api/me", requireLogin, (req, res) => {
    res.json({
        success: true,
        user: cleanUser(req.user)
    });
});

/* =========================================================
   PUBLIC PRODUCTS
========================================================= */

app.get("/api/products", (req, res) => {
    try {
        let products = readJSON(PRODUCTS_FILE);

        const search = cleanText(req.query.search, 200).toLowerCase();
        const category = cleanText(req.query.category, 100);

        if (search) {
            products = products.filter((product) => {
                const text = [
                    product.name,
                    product.category,
                    product.description,
                    product.location,
                    product.make,
                    product.model,
                    product.propertyType
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return text.includes(search);
            });
        }

        if (category && category !== "All") {
            products = products.filter(
                (product) => product.category === category
            );
        }

        products = products.map(normalizeProduct);

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not load products."
        });
    }
});

app.get("/api/products/:id", (req, res) => {
    const products = readJSON(PRODUCTS_FILE);

    const product = products.find(
        (item) => item.id === req.params.id
    );

    if (!product) {
        return res.status(404).json({
            success: false,
            message: "Product not found."
        });
    }

    res.json({
        success: true,
        product: normalizeProduct(product)
    });
});

/* =========================================================
   CUSTOMER ORDERS
========================================================= */

app.post("/api/orders", requireLogin, (req, res) => {
    try {
        const products = readJSON(PRODUCTS_FILE);
        const orders = readJSON(ORDERS_FILE);

        const incomingItems = Array.isArray(req.body.items)
            ? req.body.items
            : [];

        if (incomingItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });
        }

        const finalItems = [];

        for (const incoming of incomingItems) {
            const product = products.find(
                (item) => item.id === incoming.productId
            );

            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: "A product in your cart no longer exists."
                });
            }

            const quantity = Math.max(
                1,
                Math.floor(cleanNumber(incoming.quantity, 1))
            );

            if (product.stock < quantity) {
                return res.status(400).json({
                    success: false,
                    message:
                        product.name +
                        " does not have enough stock."
                });
            }

            product.stock -= quantity;

            finalItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity,
                category: product.category,
                image: product.image || "",
                sellerId: product.sellerId || "",
                sellerName: product.sellerName || ""
            });
        }

        const subtotal = finalItems.reduce(
            (total, item) =>
                total + item.price * item.quantity,
            0
        );

        const deliveryFee = cleanNumber(
            req.body.deliveryFee,
            0
        );

        const total = subtotal + deliveryFee;

        const order = {
            id: makeId("order"),
            orderNumber:
                "ND-" +
                Date.now().toString().slice(-8),

            userId: req.user.id,

            customerName: req.user.name,

            customerEmail: req.user.email,

            customerPhone:
                cleanText(req.body.customerPhone, 50) ||
                req.user.phone ||
                "",

            deliveryAddress:
                cleanText(req.body.deliveryAddress, 500),

            city:
                cleanText(req.body.city, 100),

            state:
                cleanText(req.body.state, 100),

            items: finalItems,

            subtotal,

            deliveryFee,

            total,

            status: "Pending",

            paymentStatus: "Pending",

            paymentMethod:
                cleanText(req.body.paymentMethod, 100) ||
                "Not selected",

            createdAt: new Date().toISOString(),

            updatedAt: new Date().toISOString()
        };

        orders.unshift(order);

        writeJSON(PRODUCTS_FILE, products);
        writeJSON(ORDERS_FILE, orders);

        res.json({
            success: true,
            message: "Order placed successfully.",
            order
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not place order."
        });
    }
});

app.get("/api/orders", requireLogin, (req, res) => {
    const orders = readJSON(ORDERS_FILE);

    const userOrders = orders.filter(
        (order) => order.userId === req.user.id
    );

    res.json({
        success: true,
        count: userOrders.length,
        orders: userOrders
    });
});

app.get("/api/orders/:id", requireLogin, (req, res) => {
    const orders = readJSON(ORDERS_FILE);

    const order = orders.find(
        (item) =>
            item.id === req.params.id &&
            item.userId === req.user.id
    );

    if (!order) {
        return res.status(404).json({
            success: false,
            message: "Order not found."
        });
    }

    res.json({
        success: true,
        order
    });
});

/* =========================================================
   PROFILE
========================================================= */

app.put("/api/profile", requireLogin, (req, res) => {
    const users = readJSON(USERS_FILE);

    const index = users.findIndex(
        (user) => user.id === req.user.id
    );

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "User not found."
        });
    }

    users[index].name =
        cleanText(req.body.name, 100) ||
        users[index].name;

    users[index].phone =
        cleanText(req.body.phone, 50);

    writeJSON(USERS_FILE, users);

    res.json({
        success: true,
        message: "Profile updated.",
        user: cleanUser(users[index])
    });
});

/* =========================================================
   SELLER DASHBOARD
========================================================= */

app.get("/api/seller/dashboard", requireSeller, (req, res) => {
    const products = readJSON(PRODUCTS_FILE);
    const orders = readJSON(ORDERS_FILE);

    const sellerProducts = products
        .filter(
            (product) =>
                product.sellerId === req.user.id
        )
        .map(normalizeProduct);

    const sellerOrders = [];

    for (const order of orders) {
        const sellerItems = order.items.filter(
            (item) =>
                item.sellerId === req.user.id
        );

        if (sellerItems.length > 0) {
            sellerOrders.push({
                ...order,
                items: sellerItems
            });
        }
    }

    const sales = sellerOrders.reduce(
        (sum, order) =>
            sum +
            order.items.reduce(
                (itemSum, item) =>
                    itemSum +
                    item.price * item.quantity,
                0
            ),
        0
    );

    res.json({
        success: true,

        stats: {
            products: sellerProducts.length,
            orders: sellerOrders.length,
            sales
        },

        products: sellerProducts,

        orders: sellerOrders
    });
});

app.get("/api/seller/products", requireSeller, (req, res) => {
    const products = readJSON(PRODUCTS_FILE);

    const sellerProducts = products
        .filter(
            (product) =>
                product.sellerId === req.user.id
        )
        .map(normalizeProduct);

    res.json({
        success: true,
        count: sellerProducts.length,
        products: sellerProducts
    });
});

app.post("/api/seller/products", requireSeller, (req, res) => {
    try {
        const products = readJSON(PRODUCTS_FILE);

        const category =
            cleanText(req.body.category, 100) ||
            "Other";

        const images = normalizeImages(req.body);

        const product = normalizeProduct({
            id: makeId("prod"),

            name:
                cleanText(req.body.name, 200) ||
                "Untitled Listing",

            category,

            price: cleanNumber(req.body.price, 0),

            stock: Math.max(
                0,
                Math.floor(
                    cleanNumber(req.body.stock, 1)
                )
            ),

            description:
                cleanText(req.body.description, 2000),

            image: images[0] || "",

            images,

            location:
                cleanText(req.body.location, 300),

            sellerId: req.user.id,

            sellerName: req.user.name,

            make:
                cleanText(req.body.make, 100),

            model:
                cleanText(req.body.model, 100),

            year:
                cleanNumber(req.body.year, 0),

            mileage:
                cleanNumber(req.body.mileage, 0),

            transmission:
                cleanText(req.body.transmission, 100),

            fuelType:
                cleanText(req.body.fuelType, 100),

            condition:
                cleanText(req.body.condition, 100),

            propertyType:
                cleanText(req.body.propertyType, 100),

            bedrooms:
                cleanNumber(req.body.bedrooms, 0),

            bathrooms:
                cleanNumber(req.body.bathrooms, 0),

            parking:
                cleanNumber(req.body.parking, 0),

            size:
                cleanText(req.body.size, 100),

            isDemo: false,

            createdAt:
                new Date().toISOString()
        });

        products.unshift(product);

        writeJSON(PRODUCTS_FILE, products);

        res.json({
            success: true,
            message: "Listing published successfully.",
            product
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not create listing."
        });
    }
});

app.put(
    "/api/seller/products/:id",
    requireSeller,
    (req, res) => {
        const products = readJSON(PRODUCTS_FILE);

        const index = products.findIndex(
            (product) =>
                product.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: "Listing not found."
            });
        }

        const product = products[index];

        if (
            product.sellerId !== req.user.id &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only edit your own listings."
            });
        }

        const body = req.body;

        const images = normalizeImages({
            image:
                body.image !== undefined
                    ? body.image
                    : product.image,

            images:
                body.images !== undefined
                    ? body.images
                    : product.images
        });

        const updated = normalizeProduct({
            ...product,

            name:
                body.name !== undefined
                    ? body.name
                    : product.name,

            category:
                body.category !== undefined
                    ? body.category
                    : product.category,

            price:
                body.price !== undefined
                    ? body.price
                    : product.price,

            stock:
                body.stock !== undefined
                    ? body.stock
                    : product.stock,

            description:
                body.description !== undefined
                    ? body.description
                    : product.description,

            image:
                images[0] || product.image || "",

            images,

            location:
                body.location !== undefined
                    ? body.location
                    : product.location,

            make:
                body.make !== undefined
                    ? body.make
                    : product.make,

            model:
                body.model !== undefined
                    ? body.model
                    : product.model,

            year:
                body.year !== undefined
                    ? body.year
                    : product.year,

            mileage:
                body.mileage !== undefined
                    ? body.mileage
                    : product.mileage,

            transmission:
                body.transmission !== undefined
                    ? body.transmission
                    : product.transmission,

            fuelType:
                body.fuelType !== undefined
                    ? body.fuelType
                    : product.fuelType,

            condition:
                body.condition !== undefined
                    ? body.condition
                    : product.condition,

            propertyType:
                body.propertyType !== undefined
                    ? body.propertyType
                    : product.propertyType,

            bedrooms:
                body.bedrooms !== undefined
                    ? body.bedrooms
                    : product.bedrooms,

            bathrooms:
                body.bathrooms !== undefined
                    ? body.bathrooms
                    : product.bathrooms,

            parking:
                body.parking !== undefined
                    ? body.parking
                    : product.parking,

            size:
                body.size !== undefined
                    ? body.size
                    : product.size,

            sellerId: product.sellerId,

            sellerName: product.sellerName,

            isDemo: product.isDemo
        });

        products[index] = updated;

        writeJSON(PRODUCTS_FILE, products);

        res.json({
            success: true,
            message: "Listing updated successfully.",
            product: updated
        });
    }
);

app.delete(
    "/api/seller/products/:id",
    requireSeller,
    (req, res) => {
        const products = readJSON(PRODUCTS_FILE);

        const product = products.find(
            (item) =>
                item.id === req.params.id
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Listing not found."
            });
        }

        if (
            product.sellerId !== req.user.id &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only delete your own listings."
            });
        }

        const filtered = products.filter(
            (item) =>
                item.id !== req.params.id
        );

        writeJSON(PRODUCTS_FILE, filtered);

        res.json({
            success: true,
            message: "Listing deleted."
        });
    }
);

/* =========================================================
   SELLER ORDERS
========================================================= */

app.get("/api/seller/orders", requireSeller, (req, res) => {
    const orders = readJSON(ORDERS_FILE);

    const sellerOrders = [];

    for (const order of orders) {
        const sellerItems = order.items.filter(
            (item) =>
                item.sellerId === req.user.id
        );

        if (sellerItems.length > 0) {
            sellerOrders.push({
                ...order,
                items: sellerItems
            });
        }
    }

    res.json({
        success: true,
        count: sellerOrders.length,
        orders: sellerOrders
    });
});

app.put(
    "/api/seller/orders/:id",
    requireSeller,
    (req, res) => {
        const orders = readJSON(ORDERS_FILE);

        const index = orders.findIndex(
            (order) =>
                order.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        const order = orders[index];

        const belongsToSeller = order.items.some(
            (item) =>
                item.sellerId === req.user.id
        );

        if (
            !belongsToSeller &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot update this order."
            });
        }

        const allowedStatuses = [
            "Pending",
            "Confirmed",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        const status = cleanText(
            req.body.status,
            50
        );

        if (
            status &&
            allowedStatuses.includes(status)
        ) {
            order.status = status;
        }

        if (req.body.paymentStatus) {
            order.paymentStatus =
                cleanText(
                    req.body.paymentStatus,
                    50
                );
        }

        order.updatedAt =
            new Date().toISOString();

        orders[index] = order;

        writeJSON(ORDERS_FILE, orders);

        res.json({
            success: true,
            message: "Order updated.",
            order
        });
    }
);

/* =========================================================
   ADMIN - USERS
========================================================= */

app.get("/api/admin/users", requireAdmin, (req, res) => {
    const users = readJSON(USERS_FILE);

    res.json({
        success: true,
        count: users.length,
        users: users.map(cleanUser)
    });
});

/* =========================================================
   ADMIN - ORDERS
========================================================= */

app.get("/api/admin/orders", requireAdmin, (req, res) => {
    const orders = readJSON(ORDERS_FILE);

    res.json({
        success: true,
        count: orders.length,
        orders
    });
});

app.put(
    "/api/admin/orders/:id",
    requireAdmin,
    (req, res) => {
        const orders = readJSON(ORDERS_FILE);

        const index = orders.findIndex(
            (order) =>
                order.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        const allowedStatuses = [
            "Pending",
            "Confirmed",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        if (
            req.body.status &&
            allowedStatuses.includes(
                req.body.status
            )
        ) {
            orders[index].status =
                req.body.status;
        }

        if (req.body.paymentStatus) {
            orders[index].paymentStatus =
                cleanText(
                    req.body.paymentStatus,
                    50
                );
        }

        orders[index].updatedAt =
            new Date().toISOString();

        writeJSON(ORDERS_FILE, orders);

        res.json({
            success: true,
            message: "Order updated.",
            order: orders[index]
        });
    }
);

/* =========================================================
   ADMIN - PRODUCTS
========================================================= */

app.get("/api/admin/products", requireAdmin, (req, res) => {
    const products = readJSON(PRODUCTS_FILE);

    res.json({
        success: true,
        count: products.length,
        products: products.map(normalizeProduct)
    });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
    try {
        const products = readJSON(PRODUCTS_FILE);

        const images = normalizeImages(req.body);

        const product = normalizeProduct({
            id: makeId("prod"),

            name:
                cleanText(req.body.name, 200) ||
                "New Product",

            category:
                cleanText(req.body.category, 100),

            price:
                cleanNumber(req.body.price, 0),

            stock:
                Math.max(
                    0,
                    Math.floor(
                        cleanNumber(req.body.stock, 0)
                    )
                ),

            description:
                cleanText(req.body.description, 2000),

            image:
                images[0] || "",

            images,

            location:
                cleanText(req.body.location, 300),

            make:
                cleanText(req.body.make, 100),

            model:
                cleanText(req.body.model, 100),

            year:
                cleanNumber(req.body.year, 0),

            mileage:
                cleanNumber(req.body.mileage, 0),

            transmission:
                cleanText(req.body.transmission, 100),

            fuelType:
                cleanText(req.body.fuelType, 100),

            condition:
                cleanText(req.body.condition, 100),

            propertyType:
                cleanText(req.body.propertyType, 100),

            bedrooms:
                cleanNumber(req.body.bedrooms, 0),

            bathrooms:
                cleanNumber(req.body.bathrooms, 0),

            parking:
                cleanNumber(req.body.parking, 0),

            size:
                cleanText(req.body.size, 100),

            sellerId:
                cleanText(req.body.sellerId, 100),

            sellerName:
                cleanText(req.body.sellerName, 100),

            isDemo:
                Boolean(req.body.isDemo)
        });

        products.unshift(product);

        writeJSON(PRODUCTS_FILE, products);

        res.json({
            success: true,
            message: "Product created.",
            product
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not create product."
        });
    }
});

app.put(
    "/api/admin/products/:id",
    requireAdmin,
    (req, res) => {
        const products = readJSON(PRODUCTS_FILE);

        const index = products.findIndex(
            (product) =>
                product.id === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const oldProduct = products[index];

        const images = normalizeImages({
            image:
                req.body.image !== undefined
                    ? req.body.image
                    : oldProduct.image,

            images:
                req.body.images !== undefined
                    ? req.body.images
                    : oldProduct.images
        });

        const updated = normalizeProduct({
            ...oldProduct,

            name:
                req.body.name !== undefined
                    ? req.body.name
                    : oldProduct.name,

            category:
                req.body.category !== undefined
                    ? req.body.category
                    : oldProduct.category,

            price:
                req.body.price !== undefined
                    ? req.body.price
                    : oldProduct.price,

            stock:
                req.body.stock !== undefined
                    ? req.body.stock
                    : oldProduct.stock,

            description:
                req.body.description !== undefined
                    ? req.body.description
                    : oldProduct.description,

            image:
                images[0] || oldProduct.image || "",

            images,

            location:
                req.body.location !== undefined
                    ? req.body.location
                    : oldProduct.location,

            make:
                req.body.make !== undefined
                    ? req.body.make
                    : oldProduct.make,

            model:
                req.body.model !== undefined
                    ? req.body.model
                    : oldProduct.model,

            year:
                req.body.year !== undefined
                    ? req.body.year
                    : oldProduct.year,

            mileage:
                req.body.mileage !== undefined
                    ? req.body.mileage
                    : oldProduct.mileage,

            transmission:
                req.body.transmission !== undefined
                    ? req.body.transmission
                    : oldProduct.transmission,

            fuelType:
                req.body.fuelType !== undefined
                    ? req.body.fuelType
                    : oldProduct.fuelType,

            condition:
                req.body.condition !== undefined
                    ? req.body.condition
                    : oldProduct.condition,

            propertyType:
                req.body.propertyType !== undefined
                    ? req.body.propertyType
                    : oldProduct.propertyType,

            bedrooms:
                req.body.bedrooms !== undefined
                    ? req.body.bedrooms
                    : oldProduct.bedrooms,

            bathrooms:
                req.body.bathrooms !== undefined
                    ? req.body.bathrooms
                    : oldProduct.bathrooms,

            parking:
                req.body.parking !== undefined
                    ? req.body.parking
                    : oldProduct.parking,

            size:
                req.body.size !== undefined
                    ? req.body.size
                    : oldProduct.size,

            sellerId:
                req.body.sellerId !== undefined
                    ? req.body.sellerId
                    : oldProduct.sellerId,

            sellerName:
                req.body.sellerName !== undefined
                    ? req.body.sellerName
                    : oldProduct.sellerName,

            isDemo:
                req.body.isDemo !== undefined
                    ? Boolean(req.body.isDemo)
                    : oldProduct.isDemo
        });

        products[index] = updated;

        writeJSON(PRODUCTS_FILE, products);

        res.json({
            success: true,
            message: "Product updated.",
            product: updated
        });
    }
);

app.delete(
    "/api/admin/products/:id",
    requireAdmin,
    (req, res) => {
        const products = readJSON(PRODUCTS_FILE);

        const exists = products.some(
            (product) =>
                product.id === req.params.id
        );

        if (!exists) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const filtered = products.filter(
            (product) =>
                product.id !== req.params.id
        );

        writeJSON(PRODUCTS_FILE, filtered);

        res.json({
            success: true,
            message: "Product deleted."
        });
    }
);

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

app.get(
    "/api/admin/dashboard",
    requireAdmin,
    (req, res) => {
        const users = readJSON(USERS_FILE);
        const products = readJSON(PRODUCTS_FILE);
        const orders = readJSON(ORDERS_FILE);

        const sellers = users.filter(
            (user) => user.role === "seller"
        );

        const customers = users.filter(
            (user) => user.role === "customer"
        );

        const revenue = orders
            .filter(
                (order) =>
                    order.status !== "Cancelled"
            )
            .reduce(
                (sum, order) =>
                    sum + cleanNumber(order.total),
                0
            );

        res.json({
            success: true,

            stats: {
                users: users.length,
                sellers: sellers.length,
                customers: customers.length,
                products: products.length,
                orders: orders.length,
                revenue
            }
        });
    }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NaijaDeals server is running.",
        time: new Date().toISOString()
    });
});

/* =========================================================
   ERROR HANDLING
========================================================= */

app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "API route not found."
        });
    }

    next();
});

app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err);

    res.status(500).json({
        success: false,
        message: "Something went wrong on the server."
    });
});

/* =========================================================
   STARTUP
========================================================= */

async function startServer() {
    try {
        await ensureAdmin();

        upgradeExistingProducts();

        addDemoListings();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("");
            console.log("========================================");
            console.log("       NAIJADEALS SERVER RUNNING");
            console.log("========================================");
            console.log(`Local: http://localhost:${PORT}`);
            console.log("");
            console.log("Admin:");
            console.log("Email: favourbabalola839@gmail.com");
            console.log(
                "Password: " +
                (process.env.ADMIN_PASSWORD ||
                    "Admin12345")
            );
            console.log("");
            console.log("API:");
            console.log(`http://localhost:${PORT}/api/health`);
            console.log(
                `http://localhost:${PORT}/api/products`
            );
            console.log("========================================");
            console.log("");
        });
    } catch (error) {
        console.error(
            "Could not start server:",
            error
        );

        process.exit(1);
    }
}

startServer();