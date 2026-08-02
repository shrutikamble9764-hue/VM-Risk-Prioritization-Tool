import { useEffect, useState } from "react";
import api from "../api/client";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";

export default function Admin() {
  const { user } = useAuth();
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "ASSET_OWNER" });

  function load() {
    api.get("/admin/sla-config").then((res) => setSlaConfigs(res.data));
    api.get("/admin/users").then((res) => setUsers(res.data)).catch(() => {});
  }
  useEffect(load, []);

  async function updateSla(severity, slaDays) {
    await api.put(`/admin/sla-config/${severity}`, { slaDays: Number(slaDays) });
    load();
  }

  async function createUser(e) {
    e.preventDefault();
    await api.post("/auth/users", newUser);
    setNewUser({ name: "", email: "", password: "", role: "ASSET_OWNER" });
    load();
  }

  const defaultSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Admin</h1>

      <div className="bg-white rounded-lg shadow-sm border p-5 mb-6 max-w-lg">
        <h2 className="font-semibold text-sm mb-3">SLA Configuration (days to remediate)</h2>
        {defaultSeverities.map((sev) => {
          const cfg = slaConfigs.find((c) => c.severity === sev);
          return (
            <div key={sev} className="flex items-center justify-between mb-2 text-sm">
              <span>{sev}</span>
              <input
                type="number"
                defaultValue={cfg?.slaDays ?? ""}
                onBlur={(e) => updateSla(sev, e.target.value)}
                className="border rounded px-2 py-1 w-24 text-right"
              />
            </div>
          );
        })}
      </div>

      {user?.role === "ADMIN" && (
        <div className="bg-white rounded-lg shadow-sm border p-5 max-w-lg">
          <h2 className="font-semibold text-sm mb-3">Create User</h2>
          <form onSubmit={createUser} className="space-y-2 text-sm">
            <input required placeholder="Name" className="border rounded px-2 py-1.5 w-full" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            <input required type="email" placeholder="Email" className="border rounded px-2 py-1.5 w-full" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            <input required type="password" placeholder="Password" className="border rounded px-2 py-1.5 w-full" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            <select className="border rounded px-2 py-1.5 w-full" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="ADMIN">Admin</option>
              <option value="SECURITY_ANALYST">Security Analyst</option>
              <option value="ASSET_OWNER">Asset Owner / Team Lead</option>
              <option value="EXECUTIVE_VIEWER">Executive Viewer</option>
              <option value="AUDITOR">Auditor</option>
            </select>
            <button type="submit" className="bg-gray-900 text-white rounded px-3 py-1.5 w-full">Create</button>
          </form>

          <h3 className="font-semibold text-sm mt-5 mb-2">Existing Users</h3>
          <ul className="text-sm space-y-1">
            {users.map((u) => (
              <li key={u.id} className="flex justify-between border-b py-1">
                <span>{u.name} ({u.email})</span>
                <span className="text-gray-500">{u.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Layout>
  );
}
