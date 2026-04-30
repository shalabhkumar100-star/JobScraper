import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { runActor } from "./apifyClient.js";
import { scoreJobsBatch } from "./scoring/scoreJobsBatch.js";
import targets from "../config/targets.json" assert { type: "json" };

dotenv.config();

const CV_TEXT = "PASTE_YOUR_CV_TEXT_HERE";

const ACTORS = {
  google: "apify/google-jobs-scraper",
  linkedin: "apify/linkedin-jobs-scraper",
  indeed: "apify/indeed-jobs-scraper",
};

function normalize(job, source) {
  return {
    role: job.title || job.position,
    company: job.companyName || job.company,
    posted: job.postedAt || job.date,
    source,
    link: job.url || job.applyUrl,
  };
}

async function fetchJobs() {
  let all = [];

  for (const role of targets.roles.slice(0, 3)) {
    const input = {
      query: role,
      location: targets.location,
      maxItems: 20,
    };

    try {
      const [g, l, i] = await Promise.all([
        runActor(ACTORS.google, input),
        runActor(ACTORS.linkedin, input),
        runActor(ACTORS.indeed, input),
      ]);

      all.push(...g.map(j => normalize(j, "Google")));
      all.push(...l.map(j => normalize(j, "LinkedIn")));
      all.push(...i.map(j => normalize(j, "Indeed")));
    } catch (e) {
      console.error("Error:", e.message);
    }
  }

  return all;
}

async function main() {
  const jobs = await fetchJobs();

  const scores = await scoreJobsBatch(jobs, CV_TEXT);

  const scored = scores
    .map(s => ({ ...jobs[s.index], score: s.score }))
    .filter(j => j.score >= targets.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, targets.maxResults);

  const out = path.resolve("output/jobs.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(scored, null, 2));

  console.table(scored);
}

main();
