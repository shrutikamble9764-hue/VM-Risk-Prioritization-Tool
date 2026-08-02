import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import Layout from "../components/Layout";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";

export default function FindingDetail() {
  const { id } = useParams();
  const [finding, setFinding] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    api.get(`/findings/${id}`).then((res) => setFinding(res.data));
  }

  useEffect(load, [id]);

  async function action(fn) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fn();
      setMsg(res.data.message || "Done.");
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!finding) return <Layout><div>Loading...</div></Layout>;

  const b = finding.riskBreakdown;

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-3">
          {finding.cveId || finding.title}
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
          {finding.inKev && <span className="text-red-600 text-sm font-semibold">⚠ Actively Exploited (KEV)</span>}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{finding.description}</p>
      </div>

      {msg && <div className="bg-blue-50 text-blue-800 text-sm p-2 rounded mb-4">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h2 className="font-semibold text-sm mb-3">Risk Score Breakdown — why {finding.riskScore}/10?</h2>
            {b ? (
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-1 text-gray-500">CVSS ({b.cvss.raw})</td><td className="text-right font-medium">+{b.cvss.contribution} / {b.cvss.maxPoints}</td></tr>
                  <tr className="border-b"><td className="py-1 text-gray-500">EPSS ({(b.epss.raw * 100).toFixed(1)}% exploit probability)</td><td className="text-right font-medium">+{b.epss.contribution} / {b.epss.maxPoints}</td></tr>
                  <tr className="border-b"><td className="py-1 text-gray-500">Threat Intel (KEV: {String(b.threatIntel.inKev)}, PoC: {String(b.threatIntel.hasPublicExploit)})</td><td className="text-right font-medium">+{b.threatIntel.contribution} / {b.threatIntel.maxPoints}</td></tr>
                  <tr className="border-b"><td className="py-1 text-gray-500">Asset Criticality ({b.assetCriticality.raw})</td><td className="text-right font-medium">+{b.assetCriticality.contribution} / {b.assetCriticality.maxPoints}</td></tr>
                  <tr className="border-b"><td className="py-1 text-gray-500">Business Impact (internet-facing: {String(b.businessImpact.internetFacing)}, sensitive data: {String(b.businessImpact.dataSensitive)})</td><td className="text-right font-medium">+{b.businessImpact.contribution} / {b.businessImpact.maxPoints}</td></tr>
                  <tr><td className="py-1 text-gray-500">Compensating Controls ({b.compensatingControls.applied.join(", ") || "none"})</td><td className="text-right font-medium text-green-700">{b.compensatingControls.reduction}</td></tr>
                </tbody>
              </table>
            ) : (
              <div className="text-gray-400 text-sm">No breakdown available.</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h2 className="font-semibold text-sm mb-2">Recommended Remediation</h2>
            <p className="text-sm text-gray-700">{finding.remediationAdvice || "No remediation guidance provided yet."}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h2 className="font-semibold text-sm mb-2">Rescan / Verification History</h2>
            {finding.rescanLogs?.length ? (
              <ul className="text-sm space-y-2">
                {finding.rescanLogs.map((r) => (
                  <li key={r.id} className="border-b pb-2">
                    <span className={r.result === "fixed" ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                      {r.result === "fixed" ? "Verified Fixed" : "Still Vulnerable"}
                    </span>{" "}
                    — {new Date(r.createdAt).toLocaleString()} {r.notes && `— ${r.notes}`}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-400 text-sm">No rescans yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border p-4 text-sm space-y-2">
            <h2 className="font-semibold mb-2">Asset</h2>
            <div><span className="text-gray-500">Host:</span> {finding.asset.hostname}</div>
            <div><span className="text-gray-500">IP:</span> {finding.asset.ip || "N/A"}</div>
            <div><span className="text-gray-500">Owner:</span> {finding.asset.owner?.name || "Unassigned"}</div>
            <div><span className="text-gray-500">SLA Deadline:</span> {finding.slaDeadline ? new Date(finding.slaDeadline).toLocaleDateString() : "N/A"}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 space-y-2">
            <h2 className="font-semibold text-sm mb-2">Actions</h2>

            {["NEW", "TRIAGED", "IN_PROGRESS"].includes(finding.status) && (
              <button
                disabled={busy}
                onClick={() => action(() => api.post(`/findings/${id}/mark-fixed`))}
                className="w-full bg-gray-900 text-white text-sm py-2 rounded disabled:opacity-50"
              >
                Mark as Fixed → Send for Rescan
              </button>
            )}

            {finding.status === "RESCAN_PENDING" && (
              <div className="space-y-2">
                <button
                  disabled={busy}
                  onClick={() => action(() => api.post(`/findings/${id}/rescan-result`, { result: "fixed" }))}
                  className="w-full bg-green-700 text-white text-sm py-2 rounded disabled:opacity-50"
                >
                  Confirm Rescan: Fixed
                </button>
                <button
                  disabled={busy}
                  onClick={() => action(() => api.post(`/findings/${id}/rescan-result`, { result: "still_vulnerable" }))}
                  className="w-full bg-red-700 text-white text-sm py-2 rounded disabled:opacity-50"
                >
                  Confirm Rescan: Still Vulnerable
                </button>
              </div>
            )}

            <button
              disabled={busy}
              onClick={() => {
                const reason = prompt("Reason for false positive?");
                if (reason) action(() => api.post(`/findings/${id}/false-positive/request`, { reason }));
              }}
              className="w-full bg-gray-100 text-gray-800 text-sm py-2 rounded disabled:opacity-50"
            >
              Flag as False Positive
            </button>

            <button
              disabled={busy}
              onClick={() => {
                const justification = prompt("Justification for risk acceptance?");
                const days = prompt("Expires in how many days?", "90");
                if (justification && days) {
                  const expiresAt = new Date(Date.now() + Number(days) * 86400000).toISOString();
                  action(() => api.post(`/findings/${id}/risk-acceptance/request`, { justification, expiresAt }));
                }
              }}
              className="w-full bg-gray-100 text-gray-800 text-sm py-2 rounded disabled:opacity-50"
            >
              Request Risk Acceptance
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
