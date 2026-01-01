import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import fetch from "node-fetch";

const app = express();
const server = http.createServer(app);

// --- 🔥 MIDDLEWARE ---
// 1. Fix for GPSLogger
app.use((req, res, next) => {
    if (req.method === 'POST' && !req.headers['content-type']) {
        req.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    next();
});

// 2. High Limit for Images (50MB)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 🕵️‍♀️ DEBUG LOGGER
app.use((req, res, next) => {
    const skipLogs = ['/active-drivers', '/log'];
    if (!skipLogs.includes(req.path)) {
        console.log(`\n🔔 [API HIT] ${req.method} ${req.url}`);
        if (req.method === 'POST') {
            // Body preview (Don't show massive base64 strings in log)
            const bodyKeys = Object.keys(req.body);
            console.log(`📦 Body Keys: ${bodyKeys.join(', ')}`);
        }
    }
    next();
});

// --- 🍃 MONGODB ---
const MONGO_URL = "mongodb://127.0.0.1:27017/busmitra";
mongoose.connect(MONGO_URL)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- 📝 SCHEMAS ---

const VehicleSchema = new mongoose.Schema({
    vehicleId: { type: String, unique: true }, // "MJH01"
    lat: Number, lon: Number, speed: Number,
    lastUpdated: Date, status: String,
    routeCode: String // Linked Route
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

const LogSchema = new mongoose.Schema({
    vehicleId: String, lat: Number, lon: Number, speedKph: Number, timestamp: Date, rawParams: Object
});
const Log = mongoose.model("Log", LogSchema);

const RouteSchema = new mongoose.Schema({
    name: String, code: String, color: String, coordinates: [[Number]], distance: String, duration: String
});
const Route = mongoose.model("Route", RouteSchema);

const AnnotationSchema = new mongoose.Schema({
    version: String, updatedAt: { type: Date, default: Date.now }, elements: Array
});
const Annotation = mongoose.model("Annotation", AnnotationSchema);

const StopSchema = new mongoose.Schema({
    name: String, lat: Number, lon: Number, routeCode: String, sequence: Number
});
const Stop = mongoose.model("Stop", StopSchema);

// 🔥 UPGRADED PROFILE SCHEMA
const BusProfileSchema = new mongoose.Schema({
    vehicleId: { type: String, unique: true }, // "MJH01"
    type: String,           // e.g. "AC Sleeper"
    fare: Number,           // e.g. 150
    rating: Number,         // e.g. 4.8
    routeCode: String,      // Links to the Route (Stops)
    driverName: String,     // e.g. "Ramesh Ji"
    contactNumber: String,  // e.g. "9876543210"
    amenities: [String],    // ["WiFi", "Water", "Blanket"]
    photos: [String]        // Array of Base64 Image Strings
});
const BusProfile = mongoose.model("BusProfile", BusProfileSchema);

const FavoriteSchema = new mongoose.Schema({ deviceId: String, vehicleId: String });
const Favorite = mongoose.model("Favorite", FavoriteSchema);

/* ---------------- 🚀 API ENDPOINTS ---------------- */

// 1. GPS Input
app.all("/log", async (req, res) => {
    try {
        const data = req.method === "GET" ? req.query : req.body;
        const vehicleId = data.bus_id || data.aid || "unknown"; // bus_id priority
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lon);
        const speed = (parseFloat(data.spd_kph) || 0);

        if (!lat || !lon) return res.send("Ignored");
        const now = new Date();

        await Log.create({ vehicleId, lat, lon, speedKph: speed, timestamp: now, rawParams: data });

        // Try to find profile to sync Route Code if exists
        const profile = await BusProfile.findOne({ vehicleId });
        const routeCode = profile ? profile.routeCode : null;

        await Vehicle.findOneAndUpdate(
            { vehicleId },
            { lat, lon, speed, lastUpdated: now, status: "active", ...(routeCode && { routeCode }) },
            { upsert: true }
        );
        res.send("OK");
    } catch (e) {
        console.error("Log Error:", e);
        res.status(500).send("Err");
    }
});

// 2. Profile APIs (GET)
app.get("/buses/:id/profile", async (req, res) => {
    try {
        const profile = await BusProfile.findOne({ vehicleId: req.params.id });
        if(profile) console.log(`✅ Profile served for ${req.params.id} (Has photos: ${profile.photos?.length || 0})`);
        else console.log(`⚠️ No profile found for ${req.params.id}`);
        res.json({ profile });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Profile APIs (POST/SAVE)
app.post("/buses/:id/profile", async (req, res) => {
    try {
        const updateData = { ...req.body, vehicleId: req.params.id };

        // Upsert Profile
        const profile = await BusProfile.findOneAndUpdate(
            { vehicleId: req.params.id },
            updateData,
            { upsert: true, new: true }
        );

        // Also update the Live Vehicle Cache with the Route Code so map updates instantly
        if(req.body.routeCode) {
            await Vehicle.findOneAndUpdate(
                { vehicleId: req.params.id },
                { routeCode: req.body.routeCode }
            );
        }

        console.log(`✅ Full Profile updated for ${req.params.id}`);
        res.json({ success: true, profile });
    } catch (e) {
        console.error("❌ Error saving profile:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- Standard Getters ---
app.get("/active-drivers", async (req, res) => {
    const recent = new Date(Date.now() - 30 * 60 * 1000);
    const drivers = await Vehicle.find({ lastUpdated: { $gte: recent } });
    res.json({ drivers });
});
app.get("/stops", async (req, res) => {
    const stops = await Stop.find({});
    res.json({ stops });
});
app.get("/routes", async (req, res) => {
    const routes = await Route.find({});
    res.json({ routes });
});
app.get("/routes/:code/stops", async (req, res) => {
    const stops = await Stop.find({ routeCode: req.params.code }).sort({ sequence: 1 });
    res.json({ stops });
});
app.get("/routes/:code/buses", async (req, res) => {
    const recent = new Date(Date.now() - 30 * 60 * 1000);
    const buses = await Vehicle.find({ routeCode: req.params.code, lastUpdated: { $gte: recent } });
    res.json({ buses });
});
app.get("/history/:id", async (req, res) => {
    const history = await Log.find({ vehicleId: req.params.id }).sort({ timestamp: -1 }).limit(100);
    res.json({ trail: history });
});
app.post("/routes", async (req, res) => {
    try {
        const newRoute = await Route.create(req.body);
        res.json({ success: true, id: newRoute._id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/annotations", async (req, res) => {
    const data = await Annotation.findOne().sort({ updatedAt: -1 });
    res.json({ success: true, data: data ? data.elements : [] });
});
app.post("/annotations", async (req, res) => {
    await Annotation.deleteMany({});
    await Annotation.create({ version: "v1", elements: req.body.elements });
    res.json({ success: true });
});
app.post("/favorites/toggle", async (req, res) => {
    const { deviceId, vehicleId } = req.body;
    const exists = await Favorite.findOne({ deviceId, vehicleId });
    if (exists) { await Favorite.deleteOne({ _id: exists._id }); return res.json({ saved: false }); }
    await Favorite.create({ deviceId, vehicleId }); res.json({ saved: true });
});
app.get("/favorites/:deviceId", async (req, res) => {
    const favs = await Favorite.find({ deviceId: req.params.deviceId });
    res.json({ favorites: favs });
});

// --- Add New Stop API ---
app.post("/stops", async (req, res) => {
    try {
        const { name, lat, lon, routeCode, sequence } = req.body;

        // Basic Validation
        if (!name || !lat || !lon) {
            return res.status(400).json({ error: "Name, Latitude and Longitude are required!" });
        }

        const stop = await Stop.create({
            name,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            routeCode: routeCode || "General", // Default if empty
            sequence: parseInt(sequence) || 0
        });

        console.log(`🚏 New Stop Added: ${stop.name} [${stop.routeCode}]`);
        res.json({ success: true, stop });
    } catch (e) {
        console.error("❌ Error adding stop:", e.message);
        res.status(500).json({ error: e.message });
    }
});
app.get("/search", async (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    const buses = await Vehicle.find({ vehicleId: { $regex: q, $options: "i" } });
    const routes = await Route.find({ name: { $regex: q, $options: "i" } });
    const stops = await Stop.find({ name: { $regex: q, $options: "i" } });
    res.json({ buses, routes, stops });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 BusMitra Server running on port ${PORT}`));
