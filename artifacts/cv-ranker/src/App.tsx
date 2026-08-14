import { useMemo, useRef, useState } from "react";
import {
  FileText,
  Upload,
  X,
  ArrowRight,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Info,
  ClipboardCheck,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

type Finding = { label: string; detail: string; evidence?: string };
type Analysis = {
  score: number;
  verdict: string;
  summary: string;
  matched: Finding[];
  gaps: Finding[];
  evidence: { quote: string; context: string }[];
};

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

async function extractPdfText(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1);
        const content = await page.getTextContent();
        return content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
      }),
    );

    return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
  } finally {
    await loadingTask.destroy();
  }
}

function ScoreRing({ score }: { score: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (score / 100);
  return (
    <div
      className="relative h-36 w-36 shrink-0"
      data-testid="metric-match-score"
    >
      <svg viewBox="0 0 120 120" className="-rotate-90 h-full w-full">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth="9"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="font-serif text-4xl leading-none text-foreground">
          {score}
        </strong>
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">
          of 100
        </span>
      </div>
    </div>
  );
}

function Step({
  number,
  label,
  active,
  done,
}: {
  number: string;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/40 bg-primary/10" : "border-border"}`}
      >
        {done ? <Check size={13} /> : number}
      </span>
      <span className="hidden text-[11px] font-semibold uppercase tracking-[.12em] sm:block">
        {label}
      </span>
    </div>
  );
}

function Home() {
  const [job, setJob] = useState("");
  const [cv, setCv] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [showMethod, setShowMethod] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canAnalyze =
    !isExtracting && job.trim().length > 30 && cv.trim().length > 30;
  const jobCount = useMemo(
    () => (job.trim() ? job.trim().split(/\s+/).length : 0),
    [job],
  );
  const cvCount = useMemo(
    () => (cv.trim() ? cv.trim().split(/\s+/).length : 0),
    [cv],
  );

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setFileError("Please choose a PDF file.");
      setFileName("");
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      setFileError("Please choose a PDF smaller than 10 MB.");
      setFileName("");
      return;
    }

    setFileError("");
    setFileName(file.name);
    setIsExtracting(true);
    setStatus("idle");

    try {
      const extractedText = await extractPdfText(file);

      if (extractedText.length < 30) {
        setCv("");
        setFileName("");
        setFileError("We could not find enough readable text in that PDF.");
        return;
      }

      setCv(extractedText);
    } catch (error) {
      console.error("PDF extraction failed", error);
      setCv("");
      setFileName("");
      setFileError("We could not read that PDF. Please paste the CV text instead.");
    } finally {
      setIsExtracting(false);
    }
  };

  // CHANGED: Now calls your real Gemini backend
  const runAnalysis = async () => {
    if (!canAnalyze) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch("/api/cv-ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: job, cvText: cv }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analysis");
      }

      const data = await response.json();
      setResult(data); // Gemini returns the exact Analysis object we need
      setStatus("idle");
    } catch (error) {
      console.error("Analysis error:", error);
      setStatus("error");
    }
  };

  const reset = () => {
    setJob("");
    setCv("");
    setFileName("");
    setFileError("");
    setResult(null);
    setStatus("idle");
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <div className="font-serif text-xl font-semibold tracking-tight">
                CV Ranker
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">
                Private review workspace
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden items-center gap-1.5 sm:flex">
              <ShieldCheck size={14} className="text-primary" /> Session-only
            </span>
            <button
              onClick={reset}
              data-testid="button-reset-top"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-foreground transition hover:bg-secondary"
            >
              <RotateCcw size={14} /> New review
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 pb-20 lg:px-10">
        <div className="flex items-center justify-between border-b border-border/60 py-5">
          <div className="flex items-center gap-2">
            <Step
              number="01"
              label="Context"
              active={!result}
              done={!!result}
            />
            <span className="mx-1 h-px w-8 bg-border sm:w-16" />
            <Step number="02" label="Read" active={!!result} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
            {result ? "Analysis complete" : "One candidate · one role"}
          </span>
        </div>

        {!result ? (
          <section className="animate-rise-in pt-12 lg:pt-16">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-primary">
                <Sparkles size={13} /> Grounded first read
              </div>
              <h1 className="font-serif text-5xl leading-[.98] tracking-[-.04em] text-foreground sm:text-7xl">
                Make the first read
                <br />
                <em className="text-primary">worth defending.</em>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
                Bring a role and one CV. CV Ranker surfaces the overlap, the
                open questions, and the evidence behind both—so your next
                conversation starts with signal, not guesswork.
              </p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_1fr_280px]">
              <label className="group flex min-h-[360px] flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_hsl(205_32%_18%/0.04)] transition focus-within:border-primary/60 focus-within:shadow-[0_12px_35px_hsl(162_35%_39%/0.10)]">
                <div className="mb-5 flex items-start justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="font-mono text-xs text-primary">01</span>{" "}
                    Role brief
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {jobCount} words
                  </span>
                </div>
                <textarea
                  value={job}
                  onChange={(event) => {
                    setJob(event.target.value);
                    setStatus("idle");
                  }}
                  data-testid="input-job-description"
                  placeholder="Paste the job description here…"
                  className="min-h-[260px] flex-1 resize-none bg-transparent text-sm leading-7 outline-none placeholder:text-muted-foreground/55"
                />
                <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Info size={13} /> Include responsibilities and must-have
                  skills for a sharper read.
                </div>
              </label>
              <label className="group flex min-h-[360px] flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_hsl(205_32%_18%/0.04)] transition focus-within:border-primary/60 focus-within:shadow-[0_12px_35px_hsl(162_35%_39%/0.10)]">
                <div className="mb-5 flex items-start justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="font-mono text-xs text-primary">02</span>{" "}
                    Candidate CV
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {cvCount} words
                  </span>
                </div>
                <textarea
                  value={cv}
                  onChange={(event) => {
                    setCv(event.target.value);
                    setFileName("");
                    setStatus("idle");
                  }}
                  data-testid="input-cv-text"
                  placeholder="Paste the candidate's CV text here…"
                  className="min-h-[190px] flex-1 resize-none bg-transparent text-sm leading-7 outline-none placeholder:text-muted-foreground/55"
                />
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                  className="hidden"
                  data-testid="input-cv-file"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  data-testid="button-upload-pdf"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/35 bg-primary/5 py-3 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/10"
                >
                  <Upload size={15} /> Upload PDF instead
                </button>
                {fileName && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <FileText size={14} className="shrink-0 text-primary" />
                      {fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFileName("");
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                      data-testid="button-remove-file"
                      className="rounded p-1 hover:bg-background"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                {isExtracting && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-3 w-3 animate-pulse rounded-full border-2 border-primary/30 border-t-primary" />
                    Reading PDF text…
                  </p>
                )}
                {fileError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle size={13} />
                    {fileError}
                  </p>
                )}
              </label>
              <aside className="flex flex-col rounded-2xl bg-sidebar p-5 text-sidebar-foreground">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-sidebar-primary">
                  <Search size={14} /> Review lens
                </div>
                <h2 className="mt-5 font-serif text-2xl leading-tight">
                  A transparent starting point, not a verdict.
                </h2>
                <p className="mt-3 text-sm leading-6 text-sidebar-foreground/65">
                  We compare recurring role language with the candidate’s own
                  text. No hidden ranking. No stored profile.
                </p>
                <button
                  type="button"
                  onClick={() => setShowMethod(!showMethod)}
                  data-testid="button-toggle-method"
                  className="mt-auto flex items-center justify-between border-t border-sidebar-border pt-4 text-left text-xs font-semibold text-sidebar-foreground"
                >
                  <span>How the read works</span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${showMethod ? "rotate-180" : ""}`}
                  />
                </button>
                {showMethod && (
                  <p className="mt-3 text-xs leading-5 text-sidebar-foreground/60">
                    We identify meaningful terms in the role, check whether they
                    appear in the CV, then show the exact supporting sentence
                    when available. Human judgment stays in the loop.
                  </p>
                )}
              </aside>
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card/65 p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <SlidersHorizontal size={16} className="text-accent" />
                <span>
                  <strong className="text-foreground">
                    Ready when you are.
                  </strong>{" "}
                  This takes a few seconds and stays in this tab.
                </span>
              </div>
              <button
                onClick={runAnalysis}
                disabled={!canAnalyze || status === "loading"}
                data-testid="button-run-analysis"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_5px_0_hsl(162_35%_25%)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_hsl(162_35%_25%)] active:translate-y-0 active:shadow-[0_3px_0_hsl(162_35%_25%)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {isExtracting ? (
                  <>
                    <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                    Reading PDF…
                  </>
                ) : status === "loading" ? (
                  <>
                    <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />{" "}
                    Reading both inputs…
                  </>
                ) : (
                  <>
                    Run first read <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            {status === "error" && (
              <p
                className="animate-rise-in mt-3 text-right text-xs font-semibold text-destructive"
                data-testid="status-form-error"
              >
                Add a role brief and CV text (at least a few sentences each) to
                begin.
              </p>
            )}
          </section>
        ) : (
          <Results result={result} onReset={reset} />
        )}
      </div>
    </main>
  );
}

function Results({
  result,
  onReset,
}: {
  result: Analysis;
  onReset: () => void;
}) {
  return (
    <section className="animate-rise-in pt-10 lg:pt-14">
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-9 md:flex-row md:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-primary">
            <Check size={13} /> Read complete
          </div>
          <h1 className="font-serif text-5xl leading-none tracking-[-.04em] sm:text-6xl">
            Here’s the shape
            <br />
            <em className="text-primary">of the match.</em>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
            {result.summary}
          </p>
        </div>
        <button
          onClick={onReset}
          data-testid="button-new-review-result"
          className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary/50 hover:bg-secondary"
        >
          <RotateCcw size={15} /> Start another review
        </button>
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground sm:p-8">
          <div className="flex flex-col items-start gap-7 sm:flex-row sm:items-center">
            <ScoreRing score={result.score} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.17em] text-sidebar-primary">
                Overall signal
              </div>
              <h2 className="mt-2 font-serif text-3xl">{result.verdict}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-sidebar-foreground/65">
                A directional comparison based only on the text you supplied.
                Use it to guide the next human conversation.
              </p>
            </div>
          </div>
          <div className="mt-8 border-t border-sidebar-border pt-5">
            <div className="flex justify-between text-xs text-sidebar-foreground/60">
              <span>Overlap detected</span>
              <span className="font-mono">{result.matched.length} signals</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sidebar-accent">
              <div
                className="h-full rounded-full bg-sidebar-primary transition-all duration-700"
                style={{ width: `${result.score}%` }}
              />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-accent">
            <ArrowRight size={14} /> Suggested next step
          </div>
          <h2 className="mt-4 font-serif text-3xl leading-tight">
            Use a focused screen.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Ask the candidate to walk through one project connected to the
            strongest overlap, then probe the open questions below. Keep the
            decision anchored in evidence.
          </p>
          <div className="mt-6 rounded-xl bg-secondary/70 p-4 text-xs leading-5 text-foreground">
            <strong>Good prompt:</strong> “Tell me about the most relevant
            example of your experience with the role’s core requirements.”
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/12 text-primary">
                <Check size={15} />
              </span>{" "}
              Matched requirements
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {result.matched.length}
            </span>
          </div>
          {result.matched.length ? (
            <div className="space-y-4">
              {result.matched.map((item, index) => (
                <div
                  key={item.label}
                  className={`animate-rise-in delay-${Math.min(index + 1, 4)} border-l-2 border-primary/50 pl-3`}
                  data-testid={`finding-matched-${index}`}
                >
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.detail}
                  </div>
                  {item.evidence && (
                    <div className="mt-2 text-xs italic leading-5 text-foreground/70">
                      “{item.evidence}”
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyFinding text="No clear matching terms surfaced." />
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-foreground">
                <Info size={15} />
              </span>{" "}
              Open questions
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {result.gaps.length}
            </span>
          </div>
          {result.gaps.length ? (
            <div className="space-y-4">
              {result.gaps.map((item, index) => (
                <div
                  key={item.label}
                  className={`animate-rise-in delay-${Math.min(index + 1, 4)} border-l-2 border-accent/70 pl-3`}
                  data-testid={`finding-gap-${index}`}
                >
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.detail}. Ask before assuming.
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyFinding text="No obvious open questions from the supplied text." />
          )}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-serif text-2xl">Evidence trail</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The phrases below are copied from the candidate text you supplied.
            </p>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-primary">
            <ShieldCheck size={13} /> Grounded in input
          </span>
        </div>
        {result.evidence.length ? (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {result.evidence.map((item, index) => (
              <div
                key={`${item.quote}-${index}`}
                className="rounded-xl bg-secondary/55 p-4"
                data-testid={`evidence-snippet-${index}`}
              >
                <div className="font-serif text-lg leading-snug">
                  “{item.quote}”
                </div>
                <div className="mt-3 text-[11px] font-semibold uppercase tracking-[.1em] text-primary">
                  {item.context}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyFinding text="Add more detail to the CV to create an evidence trail." />
        )}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs leading-5 text-muted-foreground">
        <ShieldCheck size={14} className="shrink-0 text-primary" /> CV Ranker is
        a decision-support tool. It does not assess protected characteristics
        and should not replace structured, human review.
      </p>
    </section>
  );
}

function EmptyFinding({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/25 p-5 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary resetKey="cv-ranker">
      <Home />
    </ErrorBoundary>
  );
}

export default App;
