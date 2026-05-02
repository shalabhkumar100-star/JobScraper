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

    // Example: LinkedIn Jobs scraper actor (you can change this ID later)
    const actorId = "apify/linkedin-jobs-scraper";

    const input = {
      keywords: role,
      location: location || "London",
      maxItems: 20,
    };

    const results = await runActor(actorId, input);

    const jobs = results.map((item) => ({
      role: item.title || item.position || "",
      company: item.companyName || "",
      location: item.location || "",
      source: "LinkedIn",
      link: item.url || item.applyUrl || "",
    }));

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
