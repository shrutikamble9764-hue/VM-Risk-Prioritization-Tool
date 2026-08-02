import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";

export default function Tickets() {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    api.get("/tickets").then((res) => setTickets(res.data));
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Tickets</h1>
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-2">Finding</th>
              <th className="px-4 py-2">Asset</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link to={`/findings/${t.finding.id}`} className="text-blue-700 hover:underline">
                    {t.finding.cveId || t.finding.title}
                  </Link>
                </td>
                <td className="px-4 py-2">{t.finding.asset?.hostname}</td>
                <td className="px-4 py-2"><StatusBadge status={t.finding.status} /></td>
                <td className="px-4 py-2 text-gray-500">{new Date(t.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
