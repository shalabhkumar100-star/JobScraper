import React, { useState } from "react";

export default function App() {
  const [role, setRole] = useState("Program Manager");
  const [location, setLocation] = useState("London");
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
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
    setMeta(null);

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
      setMeta({
        totalFetched: data.totalFetched,
        totalUnique: data.totalUnique,
        expandedRoles: data.expandedRoles || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 1400, margin: "0 auto" }}>
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

      {meta && (
        <div style={{ marginTop: 20, padding: 12, background: "#f4f4f4", borderRadius: 6 }}>
          <div><strong>Total fetched:</strong> {meta.totalFetched ?? "-"}</div>
          <div><strong>Total unique:</strong> {meta.totalUnique ?? "-"}</div>
          {meta.expandedRoles.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Expanded searches:</strong> {meta.expandedRoles.join(", ")}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 30, overflowX: "auto" }}>
        {results.length > 0 && (
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", background: "white", minWidth: 1200 }}>
            <thead>
              <tr>
                <th align="left">Role</th>
                <th align="left">Company</th>
                <th align="left">Location</th>
                <th align="left">Posted</th>
                <th align="left">Posted Date</th>
                <th align="left">Deadline</th>
                <th align="left">Score</th>
                <th align="left">Source Query</th>
                <th align="left">Links</th>
              </tr>
            </thead>
            <tbody>
              {results.map((job, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid #ddd" }}>
                  <td>{job.role}</td>
                  <td>{job.company}</td>
                  <td>{job.location}</td>
                  <td>{job.posted || "-"}</td>
                  <td>{job.postedDate || "-"}</td>
                  <td>{job.deadline || "-"}</td>
                  <td>{job.relevanceScore ?? "-"}</td>
                  <td>{job.sourceQuery || "-"}</td>
                  <td>
                    {job.applyLink ? (
                      <a href={job.applyLink} target="_blank" rel="noreferrer">
                        Apply
                      </a>
                    ) : (
                      "-"
                    )}

                    {job.jobLink && (
                      <>
                        {" | "}
                        <a href={job.jobLink} target="_blank" rel="noreferrer">
                          Job
                        </a>
                      </>
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
