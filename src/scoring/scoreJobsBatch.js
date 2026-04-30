import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function scoreJobsBatch(jobs, cvText) {
  const prompt = `
You are scoring job fit.

CV:\n${cvText}

JOBS:\n${JSON.stringify(jobs)}

For each job, return a JSON array:
[
  { "index": 0, "score": 8 },
  { "index": 1, "score": 6 }
]

Rules:
- score strictly (no inflation)
- 7+ means strong fit
- only return JSON
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return [];
  }
}
