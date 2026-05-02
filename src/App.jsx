import React, { useState } from "react";

export default function App() {
  const [role, setRole] = useState("Program Manager");
  const [location, setLocation] = useState("London");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const searchJobs = async () => {
    if (!role.trim()) {
      alert("Enter a role to search");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, location }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.jobs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1>Job Search Engine</h1>
      <p>Search job boards by target role and location.</p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
        <label>
          Role
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Program Manager"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. London"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <button onClick={searchJobs} disabled={loading} style={{ padding: "11px 18px" }}>
          {loading ? "Searching..." : "Search Jobs"}
        </button>
      </div>

      {error && <p style={{ color: "red", marginTop: 20 }}>Error: {error}</p>}

      <div style={{ marginTop: 30 }}>
        {results.length > 0 && (
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th align="left">Role</th>
                <th align="left">Company</th>
                <th align="left">Location</th>
                <th align="left">Source</th>
                <th align="left">Link</th>
              </tr>
            </thead>
            <tbody>
              {results.map((job, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid #ddd" }}>
                  <td>{job.role}</td>
                  <td>{job.company}</td>
                  <td>{job.location}</td>
                  <td>{job.source}</td>
                  <td>
                    {job.link ? (
                      <a href={job.link} target="_blank" rel="noreferrer">Open</a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
