import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseFile(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("pdf")) {
    const data = await pdf(buffer);
    return data.text;
  }

  if (contentType.includes("word") || contentType.includes("docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cvText = await parseFile(req);

    const prompt = `
You are analysing a CV.

CV:\n${cvText}

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
      temperature: 0.3,
    });

    const text = response.choices[0].message.content;

    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ raw: text });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
