import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.TOKEN || "dev_token";

// 🧱 Seguridad básica
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// 📁 Directorio de datos
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "locations.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

// 📦 Funciones auxiliares
const loadDB = () => {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8") || "[]");
  } catch {
    return [];
  }
};

const saveDB = (rows) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2));
    return true;
  } catch (e) {
    console.error("❌ ERROR escribiendo DB:", e);
    return false;
  }
};

// 🌍 Archivos estáticos (mapa y frontend)
app.use(express.static(path.join(__dirname, "public")));

// 🩺 Ruta de salud
app.get("/api/ping", (req, res) => res.json({ ok: true, message: "pong", port: PORT }));

// 📡 Recibir ubicación desde la app
app.post("/api/location", (req, res) => {
  let { userId, lat, lon, ts, acc, provider } = req.body || {};
  const latNum = Number(lat),
    lonNum = Number(lon),
    tsNum = Number(ts || Date.now());
  const accNum = acc != null ? Number(acc) : null;

  if (!userId || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({ error: "Out of range" });
  }

  const rows = loadDB();
  rows.push({
    userId,
    lat: latNum,
    lon: lonNum,
    ts: tsNum,
    acc: accNum,
    provider: provider || null,
  });

  saveDB(rows);
  console.log(`📍 [${userId}] ${latNum}, ${lonNum} (acc=${accNum})`);
  res.json({ saved: true });
});

// 📥 Obtener última ubicación
app.get("/api/latest", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const rows = loadDB().filter((r) => r.userId === userId);
  res.json({ latest: rows.length ? rows[rows.length - 1] : null });
});

// 📜 Historial completo
app.get("/api/locations", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });
  res.json({ items: loadDB().filter((r) => r.userId === userId) });
});

// 🏠 Página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Iniciar servidor
app.listen(PORT, () => console.log(`✅ Servidor listo en puerto ${PORT}`));
