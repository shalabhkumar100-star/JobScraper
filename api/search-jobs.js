import { runActor } from "../src/apifyClient.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { role, location } = req.body;

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    const actorId = "curious_coder/linkedin-jobs-scraper";

    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}&location=${encodeURIComponent(location || "London")}&f_TPR=r86400`;

    const input = {
      urls: [searchUrl],
      maxItems: 25,
    };

    const results = await runActor(actorId, input);
    const jobs = Array.isArray(results) ? results.map(normaliseJob) : [];

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
