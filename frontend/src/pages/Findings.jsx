import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import Layout from "../components/Layout";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import BulkUpload from "../components/BulkUpload";

const emptyForm = {
  cveId: "",
  title: "",
  description: "",
  assetId: "",
  cvssScore: "",
  epssScore: "",
  inKev: false,
  hasPublicExploit: false,
  remediationAdvice: "",
};

export default function Findings() {
  const [findings, setFindings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState({ severity: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function load() {
    setLoading(true);
    const params = {};
    if (filters.severity) params.severity = filters.severity;
    if (filters.status) params.status = filters.status;
    api.get("/findings", { params }).then((res) => {
      setFindings(res.data);
      setLoading(false);
    });
  }

  useEffect(load, [filters]);

  useEffect(() => {
    api.get("/assets").then((res) => setAssets(res.data));
  }, []);

  async function createFinding(e) {
    e.preventDefault();
    setFormError("");
    if (!form.assetId) {
      setFormError("Please select an asset.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/findings", {
        ...form,
        cvssScore: form.cvssScore ? Number(form.cvssScore) : 0,
        epssScore: form.epssScore ? Number(form.epssScore) : 0,
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to create finding.");
    } finally {
      setSaving(false);
    }
  }

  async function bulkUploadFindings(rows) {
    const res = await api.post("/findings/bulk", { findings: rows });
    load();
    return res.data;
  }

  function daysLeft(deadline) {
    if (!deadline) return null;
    const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return d;
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Findings</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded border"
          >
            {showBulk ? "Cancel" : "📤 Bulk Upload (CSV)"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded"
          >
            {showForm ? "Cancel" : "+ Add Finding"}
          </button>
        </div>
      </div>

      {showBulk && (
        <BulkUpload
          label="Bulk Upload Findings (asset must already exist — matched by hostname)"
          templateHeaders="assetHostname,cveId,title,description,cvssScore,epssScore,inKev,hasPublicExploit,remediationAdvice"
          templateFilename="findings_template.csv"
          onUpload={bulkUploadFindings}
        />
      )}

      {showForm && (
        <form onSubmit={createFinding} className="bg-white border rounded-lg p-5 mb-6 space-y-3 text-sm">
          <h2 className="font-semibold mb-1">New Vulnerability / Finding</h2>
          {formError && <div className="bg-red-50 text-red-700 p-2 rounded">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 mb-1">Asset *</label>
              <select
                required
                className="border rounded px-2 py-1.5 w-full"
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              >
                <option value="">Select an asset...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.hostname} ({a.criticality})</option>
                ))}
              </select>
              {assets.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No assets found — register an asset first on the Assets page.</p>
              )}
            </div>

            <div>
              <label className="block text-gray-600 mb-1">CVE ID</label>
              <input
                placeholder="e.g. CVE-2024-12345"
                className="border rounded px-2 py-1.5 w-full"
                value={form.cveId}
                onChange={(e) => setForm({ ...form, cveId: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-600 mb-1">Title *</label>
              <input
                required
                placeholder="e.g. Apache Struts Remote Code Execution"
                className="border rounded px-2 py-1.5 w-full"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-600 mb-1">Description *</label>
              <textarea
                required
                rows={3}
                className="border rounded px-2 py-1.5 w-full"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-gray-600 mb-1">CVSS Score (0-10)</label>
              <input
                type="number" step="0.1" min="0" max="10"
                className="border rounded px-2 py-1.5 w-full"
                value={form.cvssScore}
                onChange={(e) => setForm({ ...form, cvssScore: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-gray-600 mb-1">EPSS Score (0-1, optional — auto-refreshed later)</label>
              <input
                type="number" step="0.01" min="0" max="1"
                className="border rounded px-2 py-1.5 w-full"
                value={form.epssScore}
                onChange={(e) => setForm({ ...form, epssScore: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.inKev} onChange={(e) => setForm({ ...form, inKev: e.target.checked })} />
              In CISA KEV (actively exploited)
            </label>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.hasPublicExploit} onChange={(e) => setForm({ ...form, hasPublicExploit: e.target.checked })} />
              Public exploit / PoC available
            </label>

            <div className="md:col-span-2">
              <label className="block text-gray-600 mb-1">Remediation Advice</label>
              <textarea
                rows={2}
                placeholder="e.g. Upgrade to version X, or apply vendor patch Y"
                className="border rounded px-2 py-1.5 w-full"
                value={form.remediationAdvice}
                onChange={(e) => setForm({ ...form, remediationAdvice: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-green-700 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Finding"}
          </button>
          <p className="text-xs text-gray-500">
            Risk score, SLA deadline, and the owner notification email are generated automatically on save.
          </p>
        </form>
      )}

      <div className="flex gap-3 mb-4">
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        >
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="TRIAGED">Triaged</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESCAN_PENDING">Rescan Pending</option>
          <option value="VERIFIED_CLOSED">Verified Closed</option>
          <option value="FALSE_POSITIVE">False Positive</option>
          <option value="RISK_ACCEPTED">Risk Accepted</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-2">CVE / Title</th>
              <th className="px-4 py-2">Asset</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Risk Score</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">SLA</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-4 text-gray-400">Loading...</td></tr>
            )}
            {!loading && findings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-gray-400">No findings match these filters.</td></tr>
            )}
            {findings.map((f) => {
              const dl = daysLeft(f.slaDeadline);
              return (
                <tr key={f.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link to={`/findings/${f.id}`} className="text-blue-700 hover:underline font-medium">
                      {f.cveId || f.title}
                    </Link>
                    {f.inKev && <span className="ml-2 text-xs text-red-600 font-semibold">⚠ KEV</span>}
                  </td>
                  <td className="px-4 py-2">{f.asset?.hostname}</td>
                  <td className="px-4 py-2"><SeverityBadge severity={f.severity} /></td>
                  <td className="px-4 py-2 font-semibold">{f.riskScore}</td>
                  <td className="px-4 py-2"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-2">
                    {dl === null ? "-" : dl < 0 ? (
                      <span className="text-red-600 font-semibold">Breached {Math.abs(dl)}d ago</span>
                    ) : (
                      <span className={dl <= 3 ? "text-amber-600 font-semibold" : ""}>{dl}d left</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

