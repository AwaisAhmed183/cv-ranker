import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

// POST /api/cv-ranking
router.post("/cv-ranking", async (req: Request, res: Response) => {
  try {
    const { jobDescription, cvText } = req.body;

    if (!jobDescription || !cvText) {
      return res
        .status(400)
        .json({ error: "Missing job description or CV text" });
    }

    // Get the API key from Replit Secrets
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Gemini API key is not configured" });
    }

    // Initialize Gemini with strict JSON output
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            score: { type: "INTEGER" },
            verdict: { type: "STRING" },
            summary: { type: "STRING" },
            matched: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  detail: { type: "STRING" },
                  evidence: { type: "STRING" },
                },
                required: ["label", "detail", "evidence"],
              },
            },
            gaps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  detail: { type: "STRING" },
                },
                required: ["label", "detail"],
              },
            },
            evidence: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  quote: { type: "STRING" },
                  context: { type: "STRING" },
                },
                required: ["quote", "context"],
              },
            },
          },
          required: ["score", "verdict", "summary", "matched", "gaps", "evidence"],
        },
      },
    });

    const prompt = `
      You are an expert hiring analyst. Evaluate the candidate against the job description using a weighted rubric:
      - 40% role fit: alignment with required skills, tools, responsibilities, and domain context.
      - 40% experience and impact: seniority, direct experience, scope, outcomes, and quality of evidence.
      - 20% clarity and credibility: how clearly the CV supports claims and how compelling the presentation is.

      --- JOB DESCRIPTION ---
      ${jobDescription}

      --- CV / RESUME ---
      ${cvText}

      Return ONLY a valid JSON object that matches the required schema. Do not add markdown, comments, or code fences.
      Score the candidate from 0 to 100.
      Give a brief verdict title, a concise summary, a matched array with label/detail/evidence, a gaps array with label/detail, and an evidence array with direct quotes from the CV and the surrounding context.
      Extract the evidence quotes directly from the CV text and keep every string concise and factual.
    `;

    // Call Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse the raw JSON string from Gemini and send it directly to the frontend
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(responseText);
    } catch (error) {
      console.error("Gemini returned malformed JSON", error);
      return res
        .status(502)
        .json({ error: "Gemini returned an invalid analysis response" });
    }

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error("CV ranking request failed", error);
    return res.status(500).json({ error: "Failed to analyze CV" });
  }
});

export default router;
