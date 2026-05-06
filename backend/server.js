const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeProducts = (products) => {
  if (!Array.isArray(products)) return [];
  return products
    .map((p) => {
      if (typeof p === "string") {
        const name = p.trim();
        if (!name) return null;
        return { name, quantity: 1, inStock: true };
      }

      if (p && typeof p === "object" && typeof p.name === "string") {
        const name = p.name.trim();
        if (!name) return null;
        const quantityNum = Number(p.quantity);
        const inStock =
          typeof p.inStock === "boolean" ? p.inStock : quantityNum > 0;
        return {
          name,
          quantity: Number.isFinite(quantityNum) ? Math.max(0, quantityNum) : 1,
          inStock,
        };
      }

      return null;
    })
    .filter(Boolean);
};

const app = express();

app.use(cors());
app.use(express.json());

// Kept for your existing (older) routes below.
const Shop = require("./models/shop");

// -------- Store / Inventory APIs --------

const storeSchema = new mongoose.Schema(
  {
    osmId: { type: String, unique: true, sparse: true },
    source: { type: String, default: "manual" },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["Food", "Medicines", "Kirana"],
      required: true,
    },
    distance: { type: Number, required: true, min: 0 },
    open: { type: Boolean, default: true },
    rating: { type: Number, default: 4, min: 0, max: 5 },
    // Mixed so old records (strings) don't crash schema casting.
    products: { type: [mongoose.Schema.Types.Mixed], default: [] },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

const Store =
  mongoose.models.Store || mongoose.model("Store", storeSchema);

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "admin" },
  },
  { timestamps: true }
);

const Admin =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-env";

const authAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const payload = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(payload.id).lean();
    if (!admin) return res.status(401).json({ ok: false, message: "Invalid token" });
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
};

const ensureDefaultAdmin = async () => {
  const defaultUsername = process.env.ADMIN_USERNAME || "admin";
  const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await Admin.findOne({ username: defaultUsername }).lean();
  if (existing) return;

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  await Admin.create({ username: defaultUsername, passwordHash, role: "admin" });
  console.log(`✅ Default admin created: ${defaultUsername}`);
};

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ DB Error:", err.message));

mongoose.connection.once("open", async () => {
  await ensureDefaultAdmin();
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.post("/auth/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: "username and password are required" });
    }

    const admin = await Admin.findOne({ username }).lean();
    if (!admin) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id.toString(), role: admin.role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      ok: true,
      token,
      admin: { id: admin._id.toString(), username: admin.username, role: admin.role },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/stores/nearby", async (req, res) => {
  try {
    const { radius = "2", category = "All", q = "", lat = "", lng = "" } = req.query;
    const r = Number(radius) || 2;
    const search = String(q).trim();

    const userLat = Number(lat);
    const userLng = Number(lng);
    const hasUserCoords = Number.isFinite(userLat) && Number.isFinite(userLng);

    const query = {};
    if (category !== "All") query.category = category;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { "products.name": { $regex: search, $options: "i" } },
        // legacy products stored as array of strings
        { products: { $regex: search, $options: "i" } },
      ];
    }

    const candidates = await Store.find(query).lean();
    const hydrated = candidates
      .map((s) => {
        const storeLat = s.coordinates?.lat;
        const storeLng = s.coordinates?.lng;
        const hasStoreCoords =
          Number.isFinite(Number(storeLat)) && Number.isFinite(Number(storeLng));

        const computedDistance =
          hasUserCoords && hasStoreCoords
            ? Number(haversineKm(userLat, userLng, storeLat, storeLng).toFixed(2))
            : Number(s.distance || 999);

        return {
          id: s._id.toString(),
          name: s.name,
          category: s.category,
          distance: computedDistance,
          open: s.open,
          rating: s.rating,
          products: normalizeProducts(s.products),
        };
      })
      .filter((s) => s.distance <= r)
      .sort((a, b) => a.distance - b.distance || b.rating - a.rating);

    res.json({ ok: true, count: hydrated.length, stores: hydrated });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/stores", authAdmin, async (req, res) => {
  try {
    const stores = await Store.find({})
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      ok: true,
      count: stores.length,
      stores: stores.map((s) => ({
        id: s._id.toString(),
        osmId: s.osmId || null,
        source: s.source || "manual",
        name: s.name,
        category: s.category,
        distance: s.distance,
        open: s.open,
        rating: s.rating,
        products: normalizeProducts(s.products),
        coordinates: s.coordinates || { lat: null, lng: null },
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post("/stores/bootstrap-demo", authAdmin, async (req, res) => {
  try {
    const demoStores = [
      {
        name: "Green Basket",
        category: "Kirana",
        distance: 0.9,
        open: true,
        rating: 4.3,
        source: "manual",
        products: normalizeProducts(["Rice", "Flour", "Cooking Oil", "Sugar", "Tea"]),
      },
      {
        name: "MediCare Plus",
        category: "Medicines",
        distance: 1.1,
        open: true,
        rating: 4.4,
        source: "manual",
        products: normalizeProducts(["Paracetamol", "Cough Syrup", "Bandages", "ORS"]),
      },
      {
        name: "Taste Point",
        category: "Food",
        distance: 1.6,
        open: true,
        rating: 4.1,
        source: "manual",
        products: normalizeProducts(["Burger", "Pizza", "Juice", "Fries"]),
      },
    ];

    const ops = demoStores.map((store) => ({
      updateOne: {
        filter: { name: store.name, source: "manual" },
        update: { $set: store },
        upsert: true,
      },
    }));

    const result = await Store.bulkWrite(ops, { ordered: false });
    res.json({
      ok: true,
      message: "Demo stores added/updated",
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.patch("/stores/:id/products", authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { products } = req.body || {};

    if (!Array.isArray(products)) {
      return res.status(400).json({ ok: false, message: "products must be an array" });
    }

    const normalized = normalizeProducts(products);

    const updated = await Store.findByIdAndUpdate(
      id,
      { products: normalized },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ ok: false, message: "Store not found" });

    return res.json({ ok: true, store: updated });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
});

// MongoDB connect (you already have this)

// -------- APIs --------

// GET
app.get("/api/shops", async (req, res) => {
  const shops = await Shop.find();
  res.json(shops);
});

// POST
app.post("/api/shops", async (req, res) => {
  const shop = new Shop(req.body);
  await shop.save();
  res.json(shop);
});

// DELETE
app.delete("/api/shops/:id", async (req, res) => {
  await Shop.findByIdAndDelete(req.params.id);
  res.json({ msg: "Deleted" });
});

// -------- END --------

app.listen(5000, () => console.log("Server running"));