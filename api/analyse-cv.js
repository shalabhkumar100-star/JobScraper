import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { cv, roles } = req.body;

  const prompt = `
You are analysing a CV.

CV:\n${cv}

Target roles:\n${roles}

Return:
- key skills
- best-fit roles
- strengths
- gaps

Return JSON only.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content);
    res.json(parsed);
  } catch {
    res.json({ raw: response.choices[0].message.content });
  }
}
