import { runActor } from "../src/apifyClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { role, location } = req.body;

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    const actorId = "johnvc/Google-Jobs-Scraper";

    const input = {
      query: role,
      location: location || "London",
      country: "gb",
      language: "en",
      google_domain: "google.co.uk",
      max_results: 20,
      max_pagination: 1,
      include_lrad: false
    };

    const results = await runActor(actorId, input);

    const rawJobs = Array.isArray(results)
      ? results.flatMap((item) => item.jobs || item.results || item.items || item)
      : [];

    const jobs = rawJobs.map((item) => ({
      role: item.title || item.role || "",
      company: item.company_name || item.companyName || item.company || "",
      location: item.location || "",
      source: "Google Jobs",
      link: item.apply_link || item.applyLink || item.url || item.job_url || "",
    }));

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
