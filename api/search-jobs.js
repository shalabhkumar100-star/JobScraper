function normaliseJob(item) {
  const minSalary = item["salaryInsights/compensationBreakdown/0/minSalary"];
  const maxSalary = item["salaryInsights/compensationBreakdown/0/maxSalary"];
  const currency = item["salaryInsights/compensationBreakdown/0/currencyCode"] || "";
  const period = item["salaryInsights/compensationBreakdown/0/payPeriod"] || "";

  const salaryRange = minSalary || maxSalary
    ? `${currency} ${minSalary || ""}${minSalary && maxSalary ? " - " : ""}${maxSalary || ""} ${period}`.trim()
    : item.salary || "";

  return {
    role: item.title || item.standardizedTitle || "",
    company: item.companyName || "",
    location: item.location || "",
    source: "LinkedIn",
    posted: item.postedAt || "",
    applicants: item.applicantsCount ?? "",
    employmentType: item.employmentType || "",
    seniority: item.seniorityLevel || "",
    workplaceType: item["workplaceTypes/0"] || (item.workRemoteAllowed ? "Remote" : ""),
    salary: salaryRange,
    applyLink: item.applyUrl || item.link || "",
    jobLink: item.link || "",
    companyLinkedinUrl: item.companyLinkedinUrl || "",
    posterName: item.jobPosterName || "",
    posterProfileUrl: item.jobPosterProfileUrl || "",
    description: item.descriptionText || "",
  };
}

function getRoleVariants(role) {
  const cleanRole = String(role || "").trim();
  const lower = cleanRole.toLowerCase();

  const variantMap = {
    "it auditor": ["IT Auditor", "Technology Auditor", "IT Audit", "Senior IT Auditor"],
    "program manager": ["Program Manager", "Programme Manager", "Project Manager", "Transformation Manager"],
    "project manager": ["Project Manager", "Programme Manager", "Program Manager"],
    "product manager": ["Product Manager", "Product Owner", "Product Lead"],
    "strategy manager": ["Strategy Manager", "Strategy & Operations", "Business Strategy Manager"],
    "transformation manager": ["Transformation Manager", "Business Transformation", "Digital Transformation"],
    "ai governance manager": ["AI Governance", "Responsible AI", "AI Risk", "AI Programme Manager"],
  };

  return variantMap[lower] || [cleanRole];
}

function buildLinkedInSearchUrl(role, location) {
  const variants = getRoleVariants(role);
  const query = variants.map((variant) => `"${variant}"`).join(" OR ");

  const params = new URLSearchParams({
    keywords: query,
    location: location || "London",
    f_TPR: "r86400",
    f_JT: "F",
  });

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function tokenise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function isRelevantJob(job, role) {
  const title = String(job.role || "").toLowerCase();
  const targetTokens = tokenise(role).filter((token) => token.length > 2);

  if (!targetTokens.length) return true;

  const strictMatches = {
    "it auditor": ["auditor", "audit", "technology risk", "it risk", "controls"],
    "program manager": ["program", "programme", "project", "transformation"],
    "project manager": ["project", "programme", "program"],
    "product manager": ["product", "owner"],
    "strategy manager": ["strategy", "strategic", "operations"],
    "transformation manager": ["transformation", "change", "programme", "program"],
    "ai governance manager": ["ai", "governance", "responsible", "risk"],
  };

  const allowed = strictMatches[String(role || "").toLowerCase()] || targetTokens;

  return allowed.some((word) => title.includes(word));
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

    if (!process.env.APIFY_TOKEN) {
      return res.status(500).json({ error: "Missing APIFY_TOKEN environment variable" });
    }

    const searchUrl = buildLinkedInSearchUrl(role, location);

    const input = {
      urls: [searchUrl],
      count: 25,
      scrapeCompany: false,
      splitByLocation: false,
    };

    const apifyUrl = `https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;

    const response = await fetch(apifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const results = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: results?.error?.message || results?.message || "Apify actor request failed",
        details: results,
        input,
        searchUrl,
      });
    }

    const allJobs = Array.isArray(results) ? results.map(normaliseJob) : [];
    const jobs = allJobs.filter((job) => isRelevantJob(job, role)).slice(0, 10);

    return res.status(200).json({
      jobs,
      searchUrl,
      totalFetched: allJobs.length,
      totalRelevant: jobs.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
