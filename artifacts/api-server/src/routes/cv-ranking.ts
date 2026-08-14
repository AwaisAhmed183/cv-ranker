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

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Create the prompt for Gemini
    
    // Create the prompt for Gemini to return strict JSON
    const prompt = `
      You are an expert HR recruiter. Compare the following Job Description and CV.

      --- JOB DESCRIPTION ---
      ${jobDescription}

      --- CV / RESUME ---
      ${cvText}

      Return a valid JSON object (and ONLY the JSON object, no markdown formatting, no code fences) with this exact structure:
      {
        "score": (integer 0-100),
        "verdict": (string summarizing the match, e.g. "Strong first read"),
        "summary": (string explaining the match),
        "matched": [{"label": (string), "detail": (string), "evidence": (string)}],
        "gaps": [{"label": (string), "detail": (string)}],
        "evidence": [{"quote": (string), "context": (string)}]
      }
      Extract the evidence quotes directly from the CV text.
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
