import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
let mongoConnected = false;

const users = [];
const pickupRequests = [];

const wasteTypes = [
  "Paper", "Plastic", "Metal", "Glass", "E-waste",
  "Cardboard", "Organic Waste", "Other"
];

const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
  email: String,
  password: String,
  role: String
});

const pickupSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  location: String,
  wasteTypes: [String],
  quantity: Number,
  date: String,
  status: String,
  assignedTo: String,
  createdAt: { type: Date, default: Date.now }
});

let User;
let Pickup;

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    console.log("MONGO_URI not configured. Using temporary in-memory data.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    User = mongoose.model("User", userSchema);
    Pickup = mongoose.model("Pickup", pickupSchema);
    mongoConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
  console.error("MongoDB connection failed:", error.message);
  console.log("Using temporary in-memory data.");
  }
}

function safeUser(user) {
  return {
    id: user.id || user._id,
    name: user.name,
    phone: user.phone,
    address: user.address,
    email: user.email,
    role: user.role
  };
}

app.get("/api/health", (req, res) => {
  res.json({ message: "Kabadiwala Connect API is running", mongoConnected });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, phone, address, email, password, role } = req.body;

  if (!name || !phone || !address || !password || !role) {
    return res.status(400).json({ message: "Please fill all required fields." });
  }

  if (!["user", "kabadiwala", "recycler"].includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  if (mongoConnected) {
    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ message: "Phone already registered." });

    const created = await User.create({ name, phone, address, email, password, role });
    return res.status(201).json({ user: safeUser(created) });
  }

  if (users.some((item) => item.phone === phone)) {
    return res.status(409).json({ message: "Phone already registered." });
  }

  const created = {
    id: crypto.randomUUID(),
    name, phone, address, email, password, role
  };
  users.push(created);
  res.status(201).json({ user: safeUser(created) });
});

app.post("/api/auth/login", async (req, res) => {
  const { phone, password, role } = req.body;

  let user;
  if (mongoConnected) {
    user = await User.findOne({ phone, password, role });
  } else {
    user = users.find((item) => item.phone === phone && item.password === password && item.role === role);
  }

  if (!user) return res.status(401).json({ message: "Invalid login details." });
  res.json({ user: safeUser(user) });
});

app.get("/api/waste-types", (req, res) => {
  res.json(wasteTypes);
});

app.post("/api/pickups", async (req, res) => {
  const { userId, userName, location, wasteTypes: selectedWasteTypes, quantity, date } = req.body;

  if (!userId || !location || !selectedWasteTypes?.length || !quantity || !date) {
    return res.status(400).json({ message: "Please complete all pickup fields." });
  }

  const data = {
    userId,
    userName,
    location,
    wasteTypes: selectedWasteTypes,
    quantity: Number(quantity),
    date,
    status: "Pending",
    assignedTo: ""
  };

  if (mongoConnected) {
    const created = await Pickup.create(data);
    return res.status(201).json(created);
  }

  const created = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
  pickupRequests.push(created);
  res.status(201).json(created);
});

app.get("/api/pickups", async (req, res) => {
  const { userId, role } = req.query;

  if (mongoConnected) {
    const filter = role === "user" ? { userId } : {};
    const results = await Pickup.find(filter).sort({ createdAt: -1 });
    return res.json(results);
  }

  const results = role === "user"
    ? pickupRequests.filter((item) => item.userId === userId)
    : [...pickupRequests];

  res.json(results.reverse());
});

app.patch("/api/pickups/:id/status", async (req, res) => {
  const { status, assignedTo } = req.body;
  const allowed = ["Pending", "Accepted", "Collected", "Cancelled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid status." });
  }

  if (mongoConnected) {
    const updated = await Pickup.findByIdAndUpdate(
      req.params.id,
      { status, assignedTo: assignedTo || "" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Pickup not found." });
    return res.json(updated);
  }

  const item = pickupRequests.find((pickup) => pickup.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Pickup not found." });

  item.status = status;
  item.assignedTo = assignedTo || item.assignedTo;
  res.json(item);
});

app.listen(PORT, async () => {
  await connectDatabase();
  console.log(`Backend running at http://localhost:${PORT}`);
});
