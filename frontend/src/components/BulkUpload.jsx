import { useState } from "react";
import Papa from "papaparse";

/**
 * Generic CSV bulk-upload widget.
 * @param {string} templateHeaders - CSV header row shown as a downloadable template
 * @param {string} templateFilename
 * @param {function} onUpload - async (rows: object[]) => resultSummary
 */
export default function BulkUpload({ templateHeaders, templateFilename, onUpload, label }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function downloadTemplate() {
    const blob = new Blob([templateHeaders + "\n"], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setResult(null);
    setBusy(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const summary = await onUpload(parsed.data);
          setResult(summary);
        } catch (err) {
          setError(err.response?.data?.error || "Upload failed.");
        } finally {
          setBusy(false);
        }
      },
      error: (err) => {
        setError("Could not parse CSV: " + err.message);
        setBusy(false);
      },
    });

    e.target.value = ""; // allow re-selecting the same file
  }

  return (
    <div className="bg-white border rounded-lg p-4 mb-4 text-sm">
      <h2 className="font-semibold mb-2">{label}</h2>
      <div className="flex items-center gap-3 mb-2">
        <label className="bg-gray-900 text-white px-3 py-1.5 rounded cursor-pointer">
          {busy ? "Uploading..." : "Choose CSV File"}
          <input type="file" accept=".csv" onChange={handleFile} disabled={busy} className="hidden" />
        </label>
        <button onClick={downloadTemplate} className="text-blue-700 hover:underline">
          Download CSV template
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-2 rounded mt-2">{error}</div>}

      {result && (
        <div className="bg-green-50 text-green-800 p-2 rounded mt-2">
          <div>✅ Created: {result.created} &nbsp; ⚠️ Failed: {result.failed}</div>
          {result.errors?.length > 0 && (
            <ul className="mt-1 text-xs text-red-700 list-disc pl-4 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.row}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
