import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./styles.css";

const API = "http://localhost:5000/api";
const roles = [
  { value: "user", label: "User" },
  { value: "kabadiwala", label: "Kabadiwala" },
  { value: "recycler", label: "Authorised Recycler" }
];

function App() {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", email: "", password: "", role: "user" });
  const [message, setMessage] = useState("");

  const update = (key, value) => setForm({ ...form, [key]: value });

  async function submitAuth(e) {
    e.preventDefault();
    setMessage("");
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login"
        ? { phone: form.phone, password: form.password, role: form.role }
        : form;
      const response = await axios.post(API + endpoint, payload);
      setUser(response.data.user);
      setMessage("Success");
    } catch (error) {
      setMessage(error.response?.data?.message || "Something went wrong.");
    }
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="card auth-card">
          <div className="brand">♻️ Kabadiwala Connect</div>
          <p className="subtitle">Smart waste collection and recycling</p>
          <div className="tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
          </div>
          <form onSubmit={submitAuth}>
            {mode === "register" && <>
              <input placeholder="Full name" value={form.name} onChange={e => update("name", e.target.value)} required />
              <input placeholder="Address" value={form.address} onChange={e => update("address", e.target.value)} required />
              <input placeholder="Email (optional)" value={form.email} onChange={e => update("email", e.target.value)} />
            </>}
            <input placeholder="Phone number" value={form.phone} onChange={e => update("phone", e.target.value)} required />
            <input type="password" placeholder="Password" value={form.password} onChange={e => update("password", e.target.value)} required />
            <select value={form.role} onChange={e => update("role", e.target.value)}>
              {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            <button className="primary" type="submit">{mode === "login" ? "Login" : "Create account"}</button>
          </form>
          {message && <p className="message">{message}</p>}
          <small>Demo note: use the same phone and password for login. Add MongoDB and secure password hashing before production.</small>
        </section>
      </main>
    );
  }

  return <Dashboard user={user} logout={() => setUser(null)} />;
}

function Dashboard({ user, logout }) {
  const [pickups, setPickups] = useState([]);
  const [wasteTypes, setWasteTypes] = useState([]);
  const [pickup, setPickup] = useState({ location: user.address, wasteTypes: [], quantity: "", date: "" });
  const [message, setMessage] = useState("");

  const load = async () => {
    const [pickupResponse, wasteResponse] = await Promise.all([
      axios.get(API + "/pickups", { params: { userId: user.id, role: user.role } }),
      axios.get(API + "/waste-types")
    ]);
    setPickups(pickupResponse.data);
    setWasteTypes(wasteResponse.data);
  };

  useEffect(() => { load().catch(() => setMessage("Could not load data.")); }, []);

  const toggleWaste = (type) => {
    const selected = pickup.wasteTypes.includes(type)
      ? pickup.wasteTypes.filter(item => item !== type)
      : [...pickup.wasteTypes, type];
    setPickup({ ...pickup, wasteTypes: selected });
  };

  async function createPickup(e) {
    e.preventDefault();
    try {
      await axios.post(API + "/pickups", {
        ...pickup,
        userId: user.id,
        userName: user.name
      });
      setMessage("Pickup request created.");
      setPickup({ ...pickup, wasteTypes: [], quantity: "", date: "" });
      load();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not create pickup.");
    }
  }

  async function changeStatus(id, status) {
    try {
      await axios.patch(API + `/pickups/${id}/status`, { status, assignedTo: user.name });
      setMessage(`Pickup marked as ${status}.`);
      load();
    } catch {
      setMessage("Could not update status.");
    }
  }

  const isUser = user.role === "user";
  const isKabadiwala = user.role === "kabadiwala";

  return (
    <main className="dashboard">
      <header className="topbar">
        <div><strong>♻️ Kabadiwala Connect</strong><span>{user.name} · {roles.find(r => r.value === user.role)?.label}</span></div>
        <button onClick={logout}>Logout</button>
      </header>

      <section className="hero">
        <h1>Welcome, {user.name}</h1>
        <p>Manage your recycling activities from one place.</p>
      </section>

      {isUser && <section className="card">
        <h2>Request Pickup</h2>
        <form onSubmit={createPickup}>
          <input placeholder="Pickup location" value={pickup.location} onChange={e => setPickup({ ...pickup, location: e.target.value })} required />
          <div className="waste-grid">
            {wasteTypes.map(type => <button type="button" className={pickup.wasteTypes.includes(type) ? "waste selected" : "waste"} key={type} onClick={() => toggleWaste(type)}>{type}</button>)}
          </div>
          <input type="number" min="1" placeholder="Estimated quantity (kg)" value={pickup.quantity} onChange={e => setPickup({ ...pickup, quantity: e.target.value })} required />
          <input type="datetime-local" value={pickup.date} onChange={e => setPickup({ ...pickup, date: e.target.value })} required />
          <button className="primary" type="submit">Submit Pickup Request</button>
        </form>
      </section>}

      <section className="card">
        <h2>{isUser ? "My Pickup History" : isKabadiwala ? "Nearby Pickup Requests" : "Available Pickup Records"}</h2>
        {pickups.length === 0 && <p>No pickup requests available.</p>}
        {pickups.map(item => <article className="pickup" key={item.id || item._id}>
          <div>
            <strong>{item.userName || "User"}</strong>
            <p>{item.location}</p>
            <p>{item.wasteTypes.join(", ")} · {item.quantity} kg</p>
            <small>{item.date}</small>
          </div>
          <div className="pickup-actions">
            <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
            {isKabadiwala && item.status === "Pending" && <button onClick={() => changeStatus(item.id || item._id, "Accepted")}>Accept</button>}
            {isKabadiwala && item.status === "Accepted" && <button onClick={() => changeStatus(item.id || item._id, "Collected")}>Confirm collection</button>}
          </div>
        </article>)}
      </section>

      {user.role === "recycler" && <section className="card">
        <h2>Recycler Verification</h2>
        <p>Your starter dashboard is ready. Add document upload and admin approval using a secure file-storage service before production.</p>
      </section>}

      {message && <div className="toast">{message}</div>}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
