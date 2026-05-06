import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STATIC_ROLE_EXPANSIONS = {
  "sox": [
    "SOX Manager",
    "SOX Compliance Manager",
    "SOX Controls Manager",
    "Internal Controls Manager",
    "IT Controls Manager",
    "Technology Controls Manager",
    "ITGC Manager",
    "SOX ITGC",
    "Financial Controls Manager",
    "Internal Audit SOX"
  ],
  "it sox": [
    "IT SOX Manager",
    "SOX ITGC Manager",
    "IT General Controls",
    "ITGC",
    "IT Controls Manager",
    "Technology Controls Manager",
    "SOX Compliance Manager",
    "Internal Controls Technology",
    "IT Audit SOX",
    "Technology Risk Controls"
  ],
  "it auditor": [
    "IT Auditor",
    "Senior IT Auditor",
    "Technology Auditor",
    "IT Audit Manager",
    "Technology Audit Manager",
    "IT Risk Auditor",
    "Internal Audit Technology",
    "Technology Risk Assurance"
  ],
  "ai governance": [
    "AI Governance Manager",
    "Responsible AI Manager",
    "AI Risk Manager",
    "AI Compliance Manager",
    "AI Assurance Manager",
    "Model Risk Manager",
    "AI Policy Manager",
    "AI Risk Management",
    "Responsible AI Lead"
  ]
};

function normaliseJob(item, sourceQuery = "") {
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
    applyLink: item.applyUrl || item.link || item.inputUrl || "",
    jobLink: item.link || item.inputUrl || item.applyUrl || "",
    companyLinkedinUrl: item.companyLinkedinUrl || "",
    posterName: item.jobPosterName || "",
    posterProfileUrl: item.jobPosterProfileUrl || "",
    description: item.descriptionText || "",
    sourceQuery,
  };
}

async function expandRole(role) {
  const cleanRole = String(role || "").trim();
  const key = cleanRole.toLowerCase();
  const staticExpansions = STATIC_ROLE_EXPANSIONS[key] || [];

  if (!process.env.OPENAI_API_KEY) {
    return [...new Set([cleanRole, ...staticExpansions])].slice(0, 12);
  }

  const prompt = `Expand this job search term into 8-12 real LinkedIn job titles and search phrases.

Important:
- Include exact job titles and adjacent titles.
- Include compliance/control/audit variants where relevant.
- Keep phrases short and suitable for LinkedIn job search.
- Return ONLY a JSON array of strings.

Search term: ${cleanRole}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const aiExpansions = JSON.parse(response.choices[0].message.content);
    return [...new Set([cleanRole, ...staticExpansions, ...aiExpansions])].slice(0, 12);
  } catch {
    return [...new Set([cleanRole, ...staticExpansions])].slice(0, 12);
  }
}

function buildLinkedInSearchUrl(query, location) {
  const params = new URLSearchParams({
    keywords: `"${query}"`,
    location: location || "London",
    f_TPR: "r604800",
    f_JT: "F",
  });

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function dedupeJobs(jobs) {
  const seen = new Map();

  for (const job of jobs) {
    const key = `${job.role}|${job.company}|${job.location}`.toLowerCase();
    if (!seen.has(key)) seen.set(key, job);
  }

  return Array.from(seen.values());
}

function scoreRelevance(job, originalRole) {
  const text = `${job.role} ${job.description}`.toLowerCase();
  const role = String(originalRole || "").toLowerCase();

  const keywordMap = {
    "sox": ["sox", "controls", "internal controls", "itgc", "audit", "compliance"],
    "it sox": ["sox", "itgc", "it general controls", "technology controls", "controls", "audit"],
    "it auditor": ["it audit", "technology audit", "auditor", "audit", "technology risk", "controls"],
    "ai governance": ["ai governance", "responsible ai", "ai risk", "model risk", "ai compliance", "ai assurance", "governance"],
  };

  const keywords = keywordMap[role] || role.split(/\s+/).filter(Boolean);
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
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

    const expandedRoles = await expandRole(role);
    const apifyUrl = `https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;

    let allJobs = [];
    const searchUrls = [];

    for (const query of expandedRoles) {
      const searchUrl = buildLinkedInSearchUrl(query, location);
      searchUrls.push(searchUrl);

      const input = {
        urls: [searchUrl],
        count: 25,
        scrapeCompany: false,
        splitByLocation: false,
      };

      const response = await fetch(apifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const results = await response.json();

      if (!response.ok) {
        continue;
      }

      const jobs = Array.isArray(results) ? results.map((job) => normaliseJob(job, query)) : [];
      allJobs.push(...jobs);
    }

    const uniqueJobs = dedupeJobs(allJobs)
      .map((job) => ({ ...job, relevanceScore: scoreRelevance(job, role) }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return res.status(200).json({
      jobs: uniqueJobs.slice(0, 50),
      expandedRoles,
      searchUrls,
      totalFetched: allJobs.length,
      totalUnique: uniqueJobs.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
