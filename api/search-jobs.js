function normaliseJob(item) {
  const applyOptions = item.apply_options || [];
  const firstApplyOption = applyOptions[0] || {};

  return {
    role: item.title || "",
    company: item.company_name || "",
    location: item.location || "",
    source: "Google Jobs / SerpAPI",
    posted: item.detected_extensions?.posted_at || item.extensions?.find((x) => String(x).toLowerCase().includes("ago")) || "",
    applicants: "",
    employmentType: item.detected_extensions?.schedule_type || "",
    seniority: "",
    workplaceType: item.detected_extensions?.work_from_home ? "Remote" : "",
    salary: item.detected_extensions?.salary || "",
    applyLink: firstApplyOption.link || item.share_link || "",
    jobLink: item.share_link || firstApplyOption.link || "",
    companyLinkedinUrl: "",
    posterName: "",
    posterProfileUrl: "",
    description: item.description || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { role, location } = req.body || {};

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    if (!process.env.SERPAPI_KEY) {
      return res.status(500).json({ error: "Missing SERPAPI_KEY environment variable" });
    }

    const params = new URLSearchParams({
      engine: "google_jobs",
      q: role,
      location: location || "London, England, United Kingdom",
      hl: "en",
      gl: "uk",
      api_key: process.env.SERPAPI_KEY,
    });

    const serpUrl = `https://serpapi.com/search.json?${params.toString()}`;
    const response = await fetch(serpUrl);
    const results = await response.json();

    if (!response.ok || results.error) {
      return res.status(response.status || 500).json({
        error: results.error || "SerpAPI request failed",
        details: results,
      });
    }

    const jobs = Array.isArray(results.jobs_results)
      ? results.jobs_results.map(normaliseJob)
      : [];

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
