import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Eraser,
  FileDiff,
  FileText,
  Github,
  History,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  WandSparkles,
} from "lucide-react";
import {
  analyzePrompt,
  diffLines,
  optimizePrompt,
  samplePrompts,
  type Analysis,
  type Issue,
  type OptimizeOptions,
} from "../lib/optimizer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";

interface HistoryItem {
  id: string;
  time: number;
  score: number;
  snippet: string;
  input: string;
  options: OptimizeOptions;
}

const HISTORY_KEY = "prompt-optimizer:history:v1";
const GITHUB_URL = "https://github.com/devilking7x/prompt-optimizer";

const DEFAULT_OPTS: OptimizeOptions = { addRole: true, addFormat: true, addConstraints: true, addFallback: true };

const TOGGLES: { key: keyof OptimizeOptions; label: string; hint: string }[] = [
  { key: "addRole", label: "Add role", hint: "“Act as a …” matched to your topic" },
  { key: "addFormat", label: "Specify format", hint: "Markdown shape for the answer" },
  { key: "addConstraints", label: "Add constraints", hint: "Boundaries & no-filler rules" },
  { key: "addFallback", label: "Add fallback", hint: "Ask before guessing" },
];

function scoreColor(score: number): string {
  if (score < 50) return "#fb7185";
  if (score < 75) return "#fcd34d";
  return "#8ef0c1";
}

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-4xl font-bold tracking-tight" style={{ color }}>
            {score}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function severityBadge(severity: Issue["severity"]) {
  if (severity === "high")
    return (
      <Badge variant="destructive" className="shrink-0">
        high
      </Badge>
    );
  if (severity === "medium")
    return (
      <Badge className="shrink-0 border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/15">
        medium
      </Badge>
    );
  return (
    <Badge variant="secondary" className="shrink-0">
      low
    </Badge>
  );
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Home() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<OptimizeOptions>({ ...DEFAULT_OPTS });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [optimized, setOptimized] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });

  const samples = useMemo(() => samplePrompts(), []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* storage full or unavailable — ignore */
    }
  }, [history]);

  const diff = useMemo(() => (optimized ? diffLines(input.trim(), optimized) : []), [input, optimized]);

  const runAnalyze = () => {
    if (!input.trim()) {
      toast.error("Paste a prompt first");
      return;
    }
    const result = analyzePrompt(input);
    const out = optimizePrompt(input, opts);
    setAnalysis(result);
    setOptimized(out);
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: Date.now(),
      score: result.score,
      snippet: input.trim().slice(0, 90),
      input,
      options: { ...opts },
    };
    setHistory((items) => [item, ...items].slice(0, 20));
    toast.success(`Score: ${result.score}/100`, {
      description: `${result.issues.length} issue${result.issues.length === 1 ? "" : "s"} found — optimized version is ready.`,
    });
  };

  const loadSample = (index: string) => {
    const sample = samples[Number(index)];
    if (!sample) return;
    setInput(sample.text);
    setAnalysis(null);
    setOptimized("");
  };

  const clearAll = () => {
    setInput("");
    setAnalysis(null);
    setOptimized("");
    toast.success("Workspace cleared");
  };

  const copyOptimized = async () => {
    if (!optimized) {
      toast.error("Analyze a prompt first");
      return;
    }
    await navigator.clipboard.writeText(optimized);
    toast.success("Optimized prompt copied");
  };

  const downloadOptimized = () => {
    if (!optimized) {
      toast.error("Analyze a prompt first");
      return;
    }
    const blob = new Blob([optimized], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "optimized-prompt.md";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const reloadHistory = (item: HistoryItem) => {
    setInput(item.input);
    setOpts({ ...item.options });
    setAnalysis(null);
    setOptimized("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Prompt restored", { description: "Hit Analyze to re-run." });
  };

  const deleteHistoryItem = (id: string) => setHistory((items) => items.filter((item) => item.id !== id));

  const toggle = (key: keyof OptimizeOptions) => setOpts((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-[#080b10] text-slate-100 selection:bg-mint/30 selection:text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#080b10]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-[#07100d] shadow-[0_0_24px_rgba(142,240,193,0.22)]">
              <Wand2 size={19} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[15px] font-bold tracking-tight text-white">Prompt Optimizer</span>
                <span className="rounded-full border border-mint/20 bg-mint/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-mint">
                  Open source
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">100% local — nothing leaves your browser</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_9px_#8ef0c1]" />
              No uploads · privacy first
            </div>
            <a
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-white/25 hover:text-white"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              <Github size={15} /> <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
            <Sparkles size={14} /> AI utility / 01
          </div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
            Turn vague prompts into precise ones.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Paste a prompt, get a quality score with concrete issues, and a rewritten version with roles, output
            format, constraints, and a fallback line — all computed locally.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* LEFT — input */}
          <Card className="border-white/[0.09] bg-[#0c1118]">
            <CardHeader className="border-b border-white/[0.07]">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
                <FileText size={15} className="text-mint" /> Your prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <Textarea
                aria-label="Prompt input"
                className="min-h-[220px] resize-y bg-white/[0.03] font-mono text-[13px] leading-6 text-slate-200 placeholder:text-slate-700"
                onChange={(event) => {
                  setInput(event.target.value);
                  setAnalysis(null);
                }}
                placeholder="Paste the prompt you were about to send to an AI…"
                spellCheck={false}
                value={input}
              />

              <div>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Optimization techniques
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TOGGLES.map(({ key, label, hint }) => (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                        opts[key] ? "border-mint/25 bg-mint/[0.05]" : "border-white/[0.07] bg-white/[0.02]"
                      }`}
                    >
                      <Switch checked={opts[key]} onCheckedChange={() => toggle(key)} className="mt-0.5" />
                      <span>
                        <span className="block text-[13px] font-medium text-slate-200">{label}</span>
                        <span className="block text-[11px] text-slate-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primary" onClick={runAnalyze} type="button">
                  <WandSparkles size={15} /> Analyze
                </button>
                <Select onValueChange={loadSample}>
                  <SelectTrigger className="w-[190px] border-white/10 bg-white/[0.04] text-xs text-slate-300">
                    <SelectValue placeholder="Load a sample…" />
                  </SelectTrigger>
                  <SelectContent>
                    {samples.map((sample, index) => (
                      <SelectItem key={sample.label} value={String(index)}>
                        {sample.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button className="btn-ghost" onClick={clearAll} type="button">
                  <Eraser size={15} /> Clear
                </button>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT — score, issues, output */}
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="border-white/[0.09] bg-[#0c1118]">
              <CardContent className="flex items-center gap-6 pt-6">
                {analysis ? (
                  <>
                    <ScoreRing score={analysis.score} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">
                        {analysis.score >= 75
                          ? "Strong prompt"
                          : analysis.score >= 50
                            ? "Decent, needs work"
                            : "Needs a rewrite"}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {analysis.issues.length} issue{analysis.issues.length === 1 ? "" : "s"} ·{" "}
                        {analysis.wordCount} words · {analysis.charCount} chars
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-rose-300/30 text-rose-200">
                          {analysis.issues.filter((i) => i.severity === "high").length} high
                        </Badge>
                        <Badge variant="outline" className="border-amber-300/30 text-amber-200">
                          {analysis.issues.filter((i) => i.severity === "medium").length} medium
                        </Badge>
                        <Badge variant="outline" className="border-slate-400/30 text-slate-300">
                          {analysis.issues.filter((i) => i.severity === "low").length} low
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex w-full items-center gap-4 py-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-dashed border-white/15 text-slate-600">
                      <Sparkles size={22} />
                    </div>
                    <p className="text-sm text-slate-500">
                      Your score will appear here.
                      <span className="mt-1 block text-xs text-slate-600">
                        100 − (high × 15 + medium × 8 + low × 4), clamped 5–100.
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/[0.09] bg-[#0c1118]">
              <CardHeader className="border-b border-white/[0.07] py-3">
                <CardTitle className="text-sm text-slate-200">
                  Issues {analysis ? `(${analysis.issues.length})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {analysis ? (
                  analysis.issues.length ? (
                    <Accordion type="multiple" className="w-full">
                      {analysis.issues.map((issue) => (
                        <AccordionItem key={issue.id} value={issue.id} className="border-white/[0.06]">
                          <AccordionTrigger className="py-3 text-left hover:no-underline">
                            <span className="flex items-center gap-3">
                              {severityBadge(issue.severity)}
                              <span className="text-[13px] font-medium text-slate-200">{issue.title}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <p className="text-xs leading-5 text-slate-400">{issue.detail}</p>
                            <p className="mt-2 rounded-lg border border-mint/15 bg-mint/[0.05] p-2.5 text-xs leading-5 text-mint/90">
                              <strong className="font-semibold">Fix:</strong> {issue.fix}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No issues found — this prompt is already sharp. ✨
                    </p>
                  )
                ) : (
                  <p className="py-6 text-center text-xs text-slate-600">
                    Analyze a prompt to see exactly what's holding it back.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/[0.09] bg-[#0c1118]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.07] py-3">
                <CardTitle className="text-sm text-slate-200">Optimized prompt</CardTitle>
                <div className="flex items-center gap-1">
                  <button aria-label="Copy optimized prompt" className="icon-button" onClick={copyOptimized} title="Copy" type="button">
                    <Copy size={15} />
                  </button>
                  <button aria-label="Download as Markdown" className="icon-button" onClick={downloadOptimized} title="Download .md" type="button">
                    <Download size={15} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {optimized ? (
                  <Tabs defaultValue="optimized" className="w-full">
                    <TabsList className="mb-3 bg-white/[0.04]">
                      <TabsTrigger value="optimized" className="text-xs">
                        <FileText size={13} className="mr-1.5" /> Optimized
                      </TabsTrigger>
                      <TabsTrigger value="diff" className="text-xs">
                        <FileDiff size={13} className="mr-1.5" /> Diff
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="optimized">
                      <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 font-mono text-[12.5px] leading-6 text-slate-200">
                        {optimized}
                      </pre>
                    </TabsContent>
                    <TabsContent value="diff">
                      <div className="max-h-[380px] overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 font-mono text-[12.5px] leading-6">
                        {diff.map((line, index) => (
                          <div
                            key={index}
                            className={
                              line.type === "add"
                                ? "rounded bg-mint/10 px-2 text-mint"
                                : line.type === "del"
                                  ? "rounded bg-rose-500/10 px-2 text-rose-300"
                                  : "px-2 text-slate-500"
                            }
                          >
                            <span className="mr-2 select-none opacity-60">
                              {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
                            </span>
                            {line.text || " "}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="grid place-items-center px-8 py-10 text-center">
                    <div>
                      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-600">
                        <Wand2 size={21} />
                      </div>
                      <p className="text-sm text-slate-500">The rewritten prompt will appear here.</p>
                      <p className="mt-1 text-xs text-slate-700">Toggle techniques on the left, then hit Analyze.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <History size={15} className="text-mint" /> History
              <span className="text-[11px] font-normal text-slate-600">stored locally in your browser</span>
            </h2>
            {history.length > 0 && (
              <button
                className="flex items-center gap-1.5 text-[11px] text-slate-500 transition hover:text-rose-300"
                onClick={() => {
                  setHistory([]);
                  toast.success("History cleared");
                }}
                type="button"
              >
                <Trash2 size={13} /> Clear all
              </button>
            )}
          </div>
          {history.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:border-mint/25"
                  onClick={() => reloadHistory(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && reloadHistory(item)}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold"
                    style={{ color: scoreColor(item.score), backgroundColor: `${scoreColor(item.score)}1a` }}
                  >
                    {item.score}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-300">{item.snippet || "(empty)"}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-600">{formatTime(item.time)}</span>
                  </span>
                  <button
                    aria-label="Delete history item"
                    className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteHistoryItem(item.id);
                    }}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/[0.08] p-6 text-center text-xs text-slate-600">
              Nothing here yet — analyzed prompts will show up for quick reload.
            </p>
          )}
        </div>

        <div className="mt-14 grid gap-4 border-t border-white/[0.07] pt-8 sm:grid-cols-3">
          <div className="feature-note">
            <div className="feature-icon">
              <WandSparkles size={16} />
            </div>
            <div>
              <h2>Diagnose first</h2>
              <p>Eight local heuristics score your prompt and explain every issue.</p>
            </div>
          </div>
          <div className="feature-note">
            <div className="feature-icon">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2>Stay private</h2>
              <p>Analysis and rewriting happens inside your browser tab.</p>
            </div>
          </div>
          <div className="feature-note">
            <div className="feature-icon">
              <RotateCcw size={16} />
            </div>
            <div>
              <h2>Iterate fast</h2>
              <p>History, samples, and a line diff keep every version one click away.</p>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t border-white/[0.07] px-5 py-5 text-center text-[11px] text-slate-600">
        Private by design — your prompts never leave this browser tab.
      </footer>
    </div>
  );
}
