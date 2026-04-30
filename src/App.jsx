import React, { useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [roles, setRoles] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) return alert("Upload CV first");

    setLoading(true);

    const text = await file.text();

    const res = await fetch("/api/analyse-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv: text, roles }),
    });

    const data = await res.json();
    setOutput(JSON.stringify(data, null, 2));
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Job Intelligence Engine</h1>

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />

      <textarea
        placeholder="Target roles (optional)"
        value={roles}
        onChange={(e) => setRoles(e.target.value)}
        style={{ width: "100%", marginTop: 20 }}
      />

      <button onClick={handleSubmit} style={{ marginTop: 20 }}>
        {loading ? "Processing..." : "Analyse CV"}
      </button>

      <pre style={{ marginTop: 30 }}>{output}</pre>
    </div>
  );
}
