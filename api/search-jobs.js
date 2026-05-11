import OpenAI from "openai";
import { flattenTargetRoles } from "../config/targetRoles.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TARGET_ROLE_EXPANSIONS = Object.fromEntries(
  flattenTargetRoles().map((role) => [
    role.targetRole.toLowerCase(),
    role.searchTerms,
  ]),
);

const STATIC_ROLE_EXPANSIONS = {
  ...TARGET_ROLE_EXPANSIONS,
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

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateFromTimestamp(value) {
  if (!value) return "";
  const raw = Number(value);
  if (!raw) return "";
  const ms = raw > 9999999999 ? raw : raw * 1000;
  return formatDate(new Date(ms));
}

function dateFromRelativeText(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";

  const now = new Date();
  const date = new Date(now);

  if (text.includes("today") || text.includes("hour") || text.includes("minute") || text.includes("just now")) return formatDate(date);

  const dayMatch = text.match(/(\d+)\s+day/);
  if (dayMatch) {
    date.setDate(now.getDate() - Number(dayMatch[1]));
    return formatDate(date);
  }

  const weekMatch = text.match(/(\d+)\s+week/);
  if (weekMatch) {
    date.setDate(now.getDate() - Number(weekMatch[1]) * 7);
    return formatDate(date);
  }

  return "";
}

function normaliseDeadline(value) {
  const timestampDate = dateFromTimestamp(value);
  if (timestampDate) return timestampDate;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);

  return String(value || "");
}

function normaliseJob(item, sourceQuery = "") {
  const minSalary = item["salaryInsights/compensationBreakdown/0/minSalary"];
  const maxSalary = item["salaryInsights/compensationBreakdown/0/maxSalary"];
  const currency = item["salaryInsights/compensationBreakdown/0/currencyCode"] || "";
  const period = item["salaryInsights/compensationBreakdown/0/payPeriod"] || "";

  const salaryRange = minSalary || maxSalary
    ? `${currency} ${minSalary || ""}${minSalary && maxSalary ? " - " : ""}${maxSalary || ""} ${period}`.trim()
    : item.salary || "";

  const postedRaw = item.postedAt || "";
  const postedDate = dateFromTimestamp(item.postedAtTimestamp) || dateFromRelativeText(postedRaw) || postedRaw;

  return {
    role: item.title || item.standardizedTitle || "",
    company: item.companyName || "",
    location: item.location || "",
    source: "LinkedIn",
    postedDate,
    deadlineDate: normaliseDeadline(item.expireAt),
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

  if (!process.env.OPENAI_API_KEY) return [...new Set([cleanRole, ...staticExpansions])].slice(0, 12);

  const prompt = `Expand this job search term into 8-12 real LinkedIn job titles and search phrases. Include exact job titles and adjacent titles. Include compliance/control/audit variants where relevant. Keep phrases short and suitable for LinkedIn job search. Return ONLY a JSON array of strings. Search term: ${cleanRole}`;

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { role, location } = req.body || {};
    if (!role) return res.status(400).json({ error: "Role is required" });
    if (!process.env.APIFY_TOKEN) return res.status(500).json({ error: "Missing APIFY_TOKEN environment variable" });

    const expandedRoles = await expandRole(role);
    const apifyUrl = `https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;
    let allJobs = [];
    const searchUrls = [];

    for (const query of expandedRoles) {
      const searchUrl = buildLinkedInSearchUrl(query, location);
      searchUrls.push(searchUrl);
      const input = { urls: [searchUrl], count: 25, scrapeCompany: false, splitByLocation: false };
      const response = await fetch(apifyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const results = await response.json();
      if (!response.ok) continue;
      const jobs = Array.isArray(results) ? results.map((job) => normaliseJob(job, query)) : [];
      allJobs.push(...jobs);
    }

    const uniqueJobs = dedupeJobs(allJobs)
      .map((job) => ({ ...job, relevanceScore: scoreRelevance(job, role) }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return res.status(200).json({ jobs: uniqueJobs.slice(0, 50), expandedRoles, searchUrls, totalFetched: allJobs.length, totalUnique: uniqueJobs.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
