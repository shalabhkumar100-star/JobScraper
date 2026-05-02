import React, { useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [roles, setRoles] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      alert("Upload CV first");
      return;
    }

    setLoading(true);
    setOutput("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("roles", roles);

      const res = await fetch("/api/analyse-cv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setOutput(JSON.stringify(data, null, 2));
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Job Intelligence Engine</h1>

      <p>Upload your CV, then optionally add target roles.</p>

      <input
        type="file"
        accept=".txt,.pdf,.docx"
        onChange={(e) => setFile(e.target.files[0] || null)}
      />

      {file && <p>Selected: {file.name}</p>}

      <textarea
        placeholder="Target roles (optional)"
        value={roles}
        onChange={(e) => setRoles(e.target.value)}
        style={{ width: "100%", marginTop: 20, minHeight: 100 }}
      />

      <button disabled={loading} onClick={handleSubmit} style={{ marginTop: 20 }}>
        {loading ? "Processing..." : "Analyse CV"}
      </button>

      <pre style={{ marginTop: 30, whiteSpace: "pre-wrap" }}>{output}</pre>
    </div>
  );
}
