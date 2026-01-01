import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";

const app = express();
const server = http.createServer(app);

// --- 🔥 FIX: Force Content-Type for GPSLogger ---
app.use((req, res, next) => {
    if (req.method === 'POST' && !req.headers['content-type']) {
        req.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for saving large map data
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URL = "mongodb://127.0.0.1:27017/busmitra";
mongoose.connect(MONGO_URL)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- Schemas ---

const LogSchema = new mongoose.Schema({
    vehicleId: String, lat: Number, lon: Number, speedKph: Number, timestamp: Date, rawParams: Object
});
const Log = mongoose.model("Log", LogSchema);

const VehicleSchema = new mongoose.Schema({
    vehicleId: { type: String, unique: true },
    lat: Number, lon: Number, speed: Number, lastUpdated: Date, status: String
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

const RouteSchema = new mongoose.Schema({
    name: String, code: String, color: String, coordinates: [[Number]], distance: String, duration: String
});
const Route = mongoose.model("Route", RouteSchema);

// 🆕 Annotation Schema (For saving your Map Design)
const AnnotationSchema = new mongoose.Schema({
    version: String,
    updatedAt: { type: Date, default: Date.now },
    elements: Array // Stores all your text labels and icons
});
const Annotation = mongoose.model("Annotation", AnnotationSchema);

/* ---------------- APIs ---------------- */

// ... (Existing GPS APIs remain same)

// 4. 🆕 ANNOTATION APIs (Save/Load Map Design)
app.get("/annotations", async (req, res) => {
    try {
        // Get the latest saved version
        const data = await Annotation.findOne().sort({ updatedAt: -1 });
        res.json({ success: true, data: data ? data.elements : [] });
    } catch (e) {
        res.status(500).json({ error: "Load Failed" });
    }
});

app.post("/annotations", async (req, res) => {
    try {
        // Overwrite or Create New
        await Annotation.deleteMany({}); // Optional: Keep only one "Master" version
        await Annotation.create({
            version: "v1",
            elements: req.body.elements
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Save Failed" });
    }
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
