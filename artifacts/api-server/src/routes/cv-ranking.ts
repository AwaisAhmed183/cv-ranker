import { Router, Request, Response } from "express";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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
          type: SchemaType.OBJECT,
          properties: {
            score: { type: SchemaType.INTEGER },
            matchedSkills: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            missingSkills: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            summary: { type: SchemaType.STRING },
          },
          required: ["score", "matchedSkills", "missingSkills", "summary"],
        },
      },
    });

    const prompt = `
      You are an expert hiring analyst. Evaluate the CV against the job description using this exact weighted rubric:
      - 40% Technical Skills: match the required technical skills, tools, frameworks, systems, and qualifications in the job description.
      - 40% Experience / Role Match: assess relevant work history, seniority, level of responsibility, project scope, and direct alignment to the role.
      - 20% Domain Relevance: assess industry context, business domain familiarity, and how relevant the candidate's background is to the employer's sector or environment.

      --- JOB DESCRIPTION ---
      ${jobDescription}

      --- CV / RESUME ---
      ${cvText}

      Return ONLY a valid JSON object that matches the required schema. Do not add markdown, code fences, comments, or explanations.
      Generate a score from 0 to 100 based on the weighted rubric above.
      Output only these keys: "score", "matchedSkills", "missingSkills", and "summary".
      - "matchedSkills": array of skill names or short phrases that are clearly present in the CV and relevant to the job.
      - "missingSkills": array of important skill gaps or missing qualifications from the job description that are not sufficiently evidenced in the CV.
      - "summary": concise but informative evaluation of candidate fit.
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
