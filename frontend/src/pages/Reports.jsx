import { useState } from "react";
import Layout from "../components/Layout";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Reports() {
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  function downloadCsv() {
    const token = localStorage.getItem("vm_token");
    const params = new URLSearchParams();
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    // Use fetch so we can attach the auth header, then trigger a download.
    fetch(`${API_BASE_URL}/api/reports/findings.csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "findings_report.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Reports</h1>
      <div className="bg-white rounded-lg shadow-sm border p-5 max-w-lg">
        <h2 className="font-semibold text-sm mb-3">Export Findings (CSV)</h2>
        <div className="flex gap-3 mb-4">
          <select className="border rounded px-3 py-1.5 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select className="border rounded px-3 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="VERIFIED_CLOSED">Verified Closed</option>
            <option value="FALSE_POSITIVE">False Positive</option>
            <option value="RISK_ACCEPTED">Risk Accepted</option>
          </select>
        </div>
        <button onClick={downloadCsv} className="bg-gray-900 text-white text-sm px-4 py-2 rounded">
          Download CSV
        </button>
      </div>
    </Layout>
  );
}
