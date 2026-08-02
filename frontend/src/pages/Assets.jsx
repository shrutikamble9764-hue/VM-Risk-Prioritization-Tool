import { useEffect, useState } from "react";
import api from "../api/client";
import Layout from "../components/Layout";
import BulkUpload from "../components/BulkUpload";

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({
    hostname: "", ip: "", os: "", environment: "PROD",
    internetFacing: false, criticality: "MEDIUM", dataSensitive: false,
  });

  function load() {
    api.get("/assets").then((res) => setAssets(res.data));
  }
  useEffect(load, []);

  async function createAsset(e) {
    e.preventDefault();
    await api.post("/assets", form);
    setShowForm(false);
    setForm({ hostname: "", ip: "", os: "", environment: "PROD", internetFacing: false, criticality: "MEDIUM", dataSensitive: false });
    load();
  }

  async function bulkUploadAssets(rows) {
    const res = await api.post("/assets/bulk", { assets: rows });
    load();
    return res.data;
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Asset Inventory</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(!showBulk)} className="bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded border">
            {showBulk ? "Cancel" : "📤 Bulk Upload (CSV)"}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded">
            {showForm ? "Cancel" : "+ Register Asset"}
          </button>
        </div>
      </div>

      {showBulk && (
        <BulkUpload
          label="Bulk Upload Assets"
          templateHeaders="hostname,ip,os,environment,internetFacing,criticality,dataSensitive,ownerEmail,compensatingControls"
          templateFilename="assets_template.csv"
          onUpload={bulkUploadAssets}
        />
      )}

      {showForm && (
        <form onSubmit={createAsset} className="bg-white border rounded-lg p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <input required placeholder="Hostname" className="border rounded px-2 py-1.5" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
          <input placeholder="IP Address" className="border rounded px-2 py-1.5" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
          <input placeholder="OS" className="border rounded px-2 py-1.5" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} />
          <select className="border rounded px-2 py-1.5" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
            <option value="PROD">Production</option>
            <option value="STAGING">Staging</option>
            <option value="DEV">Development</option>
          </select>
          <select className="border rounded px-2 py-1.5" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.internetFacing} onChange={(e) => setForm({ ...form, internetFacing: e.target.checked })} /> Internet-facing</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.dataSensitive} onChange={(e) => setForm({ ...form, dataSensitive: e.target.checked })} /> Sensitive data</label>
          <button type="submit" className="bg-green-700 text-white rounded px-3 py-1.5">Save Asset</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-2">Hostname</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Environment</th>
              <th className="px-4 py-2">Criticality</th>
              <th className="px-4 py-2">Internet-Facing</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Open Findings</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{a.hostname} {a.isRogue && <span className="text-xs text-red-600 ml-1">ROGUE</span>}</td>
                <td className="px-4 py-2">{a.ip || "-"}</td>
                <td className="px-4 py-2">{a.environment}</td>
                <td className="px-4 py-2">{a.criticality}</td>
                <td className="px-4 py-2">{a.internetFacing ? "Yes" : "No"}</td>
                <td className="px-4 py-2">{a.owner?.name || "Unassigned"}</td>
                <td className="px-4 py-2">{a._count?.findings ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
