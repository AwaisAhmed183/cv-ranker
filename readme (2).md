# AI-Powered CV Ranker & ATS Optimization System

A high-performance, automated CV ranking system that leverages **Google Gemini LLM** to analyze, score, and rank candidate resumes against specific job descriptions. This tool streamlines the recruitment process by providing data-driven insights and match-score percentages for every candidate.

## 🚀 Key Features

- **LLM-Driven Analysis:** Uses advanced Large Language Models (Gemini) to parse unstructured resume data and job requirements.
- **Automated Ranking:** Instantaneous scoring and ranking of multiple CVs based on skill relevance, experience, and education.
- **Robust API Integration:** Built with a scalable TypeScript/Node.js backend featuring custom error handling for malformed LLM outputs.
- **Developer-Friendly Patching:** Includes Python-based patching scripts for seamless codebase synchronization and deployment.
- **Modern Tech Stack:** Engineered using TypeScript, pnpm, and Replit Connectors for high-speed development and deployment.

## 🛠️ Tech Stack

- **Backend:** TypeScript, Node.js, Express
- **AI/LLM:** Google Gemini API
- **Automation:** Python (Patching & Scripting)
- **Package Management:** pnpm
- **Environment:** Replit / Local Dev

## 📁 Project Structure

```text
├── artifacts/       # API server and core logic
├── lib/             # Shared utility functions
├── scripts/         # Automation and setup scripts
├── patch_cv_ranking.py # LLM response parsing & error handling patch
└── package.json     # Project configuration and dependencies
```

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AwaisAhmed183/cv-ranker.git
   cd cv-ranker
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment:**
   Create a `.env` file with your Gemini API Key:
   ```text
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the server:**
   ```bash
   pnpm start
   ```

---
**Author:** [Awais Ahmed Shah](https://github.com/AwaisAhmed183)  
**Specialization:** Data Science | Machine Learning | AI Backend Engineer
