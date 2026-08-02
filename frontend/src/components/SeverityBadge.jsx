const COLORS = {
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-300",
  LOW: "bg-green-100 text-green-800 border-green-300",
};

export default function SeverityBadge({ severity }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${
        COLORS[severity] || "bg-gray-100 text-gray-800 border-gray-300"
      }`}
    >
      {severity}
    </span>
  );
}
