# SerpAPI Comparison Plan

Purpose: build a separate GitHub/Vercel app using SerpAPI Google Jobs so outputs can be compared against the current Apify LinkedIn scraper.

Reason: Apify works for broad roles/locations but struggles with niche keywords such as AI Governance, IT Auditor, and IT SOX. SerpAPI may provide broader Google Jobs coverage and better relevance for niche terms.

Planned repo: `SerpJobScraper` or similar.

MVP scope:
- Vite React UI with role + location inputs
- Vercel API route `/api/search-jobs`
- Backend calls SerpAPI `google_jobs` engine
- Normalize output to same schema as current Apify app:
  - role
  - company
  - location
  - source
  - posted
  - employmentType
  - workplaceType
  - salary
  - applyLink
  - jobLink
  - description
- Add simple relevance filter and debug fields

Environment variable:
- `SERPAPI_KEY`

Comparison criteria:
- Relevance for niche roles
- Number of relevant jobs returned
- Quality of apply links
- Cost per useful result
- Runtime reliability
