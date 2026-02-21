import * as React from "react";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

function apiUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

function formatNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : "-";
}

function formatPercent(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "-";
}

function formatBytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const scaled = n / 1024 ** i;
  return `${scaled.toFixed(scaled >= 10 || i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(value) {
  const ms = Date.parse(String(value || ""));
  if (!Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}

export default function App() {
  const [hours, setHours] = React.useState("24");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);

  const loadOverview = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl(`/api/site-performance/render/overview?hours=${encodeURIComponent(hours)}`));
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to load Render overview.");
      }
      setData(payload);
    } catch (requestError) {
      setError(String(requestError?.message || "Failed to load dashboard."));
    } finally {
      setLoading(false);
    }
  }, [hours]);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const services = data?.services || [];
  const summary = data?.summary || {};

  return (
    <main className="app">
      <section className="panel">
        <div className="header">
          <div>
            <h1>Render Meta Dashboard</h1>
            <div className="muted">Shared backend model: this app reads `/api/site-performance/*` from the existing TFT API service.</div>
          </div>
          <div className="controls">
            <label htmlFor="hours" className="muted">Window</label>
            <select id="hours" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="6">Last 6h</option>
              <option value="24">Last 24h</option>
              <option value="72">Last 72h</option>
              <option value="168">Last 7d</option>
            </select>
            <button type="button" onClick={loadOverview} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {error ? <section className="error">{error}</section> : null}

      <section className="grid">
        <article className="card"><div className="k">Services</div><div className="v">{formatNumber(summary.serviceCount)}</div></article>
        <article className="card"><div className="k">HTTP Requests</div><div className="v">{formatNumber(summary.totalHttpRequests)}</div></article>
        <article className="card"><div className="k">Bandwidth</div><div className="v">{formatBytes(summary.totalBandwidthBytes)}</div></article>
        <article className="card"><div className="k">Avg CPU</div><div className="v">{formatPercent(summary.avgCpuPercent)}</div></article>
        <article className="card"><div className="k">Avg Memory</div><div className="v">{summary.avgMemoryGb ? `${Number(summary.avgMemoryGb).toFixed(2)} GB` : "-"}</div></article>
        <article className="card"><div className="k">Peak Memory</div><div className="v">{summary.peakMemoryGb ? `${Number(summary.peakMemoryGb).toFixed(2)} GB` : "-"}</div></article>
      </section>

      <section className="panel">
        <div className="header">
          <h2 style={{ margin: 0 }}>Tracked Services</h2>
          <span className="status">Updated {formatDate(data?.generatedAt)}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Region</th>
                <th>Runtime</th>
              </tr>
            </thead>
            <tbody>
              {services.length ? services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{service.type}</td>
                  <td>{service.region || "-"}</td>
                  <td>{service.runtime || "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="muted">No services returned in this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

