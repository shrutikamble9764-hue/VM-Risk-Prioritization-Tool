const COLORS = {
  NEW: "bg-blue-100 text-blue-800",
  TRIAGED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  FIX_APPLIED: "bg-cyan-100 text-cyan-800",
  RESCAN_PENDING: "bg-amber-100 text-amber-800",
  VERIFIED_CLOSED: "bg-green-100 text-green-800",
  FALSE_POSITIVE: "bg-gray-200 text-gray-700",
  RISK_ACCEPTED: "bg-slate-200 text-slate-700",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[status] || "bg-gray-100 text-gray-700"}`}>
      {status?.replaceAll("_", " ")}
    </span>
  );
}
