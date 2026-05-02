import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import formidable from "formidable";
import fs from "fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: false });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const buffer = fs.readFileSync(file.filepath);
    let cvText = "";

    if (file.mimetype.includes("pdf")) {
      const data = await pdf(buffer);
      cvText = data.text;
    } else if (
      file.mimetype.includes("word") ||
      file.mimetype.includes("docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      cvText = result.value;
    } else {
      cvText = buffer.toString();
    }

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
