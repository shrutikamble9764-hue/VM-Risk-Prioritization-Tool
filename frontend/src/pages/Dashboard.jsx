import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "../api/client";
import Layout from "../components/Layout";

const SEV_COLORS = { CRITICAL: "#b91c1c", HIGH: "#c2410c", MEDIUM: "#a16207", LOW: "#15803d" };

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(
          err.response?.data?.error ||
            err.message ||
            "Could not load dashboard data. Check that the backend is reachable."
        );
      });
  }, []);

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          <div className="font-semibold mb-1">Failed to load dashboard</div>
          <div className="text-sm">{error}</div>
        </div>
      </Layout>
    );
  }

  if (!data) return <Layout><div>Loading dashboard...</div></Layout>;

  const severityData = Object.entries(data.severityDistribution).map(([k, v]) => ({
    name: k,
    value: v,
  }));

  const mttrData = Object.entries(data.mttr)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({ name: k, days: v }));

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Risk Posture Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Overall Risk Posture" value={`${data.riskPosture}/10`} />
        <StatCard label="Open Findings" value={data.totalOpenFindings} />
        <StatCard
          label="SLA Compliance"
          value={`${data.slaCompliancePercent}%`}
          color={data.slaCompliancePercent < 80 ? "text-red-600" : "text-green-600"}
        />
        <StatCard
          label="Actively Exploited (KEV)"
          value={data.activeExploitCount}
          color={data.activeExploitCount > 0 ? "text-red-600" : "text-green-600"}
          sub="Open findings in CISA KEV"
        />
        <StatCard label="SLA Breaches" value={data.breachedCount} color="text-red-600" />
        <StatCard label="Upcoming Breaches (3d)" value={data.upcomingBreaches} color="text-amber-600" />
        <StatCard label="False Positive Rate" value={`${data.fpRate}%`} />
        <StatCard label="Closed Findings" value={data.totalClosedFindings} color="text-green-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <h2 className="text-sm font-semibold mb-3">Open Findings by Severity</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={90} label>
                {severityData.map((entry) => (
                  <Cell key={entry.name} fill={SEV_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <h2 className="text-sm font-semibold mb-3">Mean Time To Remediate (days)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mttrData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="days" fill="#1f2937" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <h2 className="text-sm font-semibold mb-3">Aging Report (Open, Unresolved)</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Open &gt; 30 days</span><span className="font-semibold">{data.aging.over30}</span></div>
            <div className="flex justify-between"><span>Open &gt; 60 days</span><span className="font-semibold text-amber-600">{data.aging.over60}</span></div>
            <div className="flex justify-between"><span>Open &gt; 90 days</span><span className="font-semibold text-red-600">{data.aging.over90}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <h2 className="text-sm font-semibold mb-3">Top Vulnerable Assets</h2>
          <div className="space-y-1 text-sm">
            {data.topVulnerableAssets.length === 0 && <div className="text-gray-400">No open findings.</div>}
            {data.topVulnerableAssets.map((a) => (
              <div key={a.hostname} className="flex justify-between border-b py-1">
                <span>{a.hostname}</span>
                <span className="text-gray-500">{a.count} findings · total risk {a.totalRisk.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
