export interface Issue {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  fix: string;
}

export interface Analysis {
  score: number;
  issues: Issue[];
  wordCount: number;
  charCount: number;
}

export interface OptimizeOptions {
  addRole: boolean;
  addFormat: boolean;
  addConstraints: boolean;
  addFallback: boolean;
}

const ROLE_RE = /you are|as a|act as/i;
const VAGUE_RE = /\b(good|great|nice|some|various|several|etc\.?|things|stuff)\b/gi;
const FORMAT_RE = /\b(format|json|markdown|table|bullet|step-by-step)\b/i;
const CONSTRAINT_RE = /\b(must|don't|do not|avoid|never|only|exactly|limit)\b/i;
const FALLBACK_RE = /if unsure|if you don't know|ask me|clarif/i;
const CONTEXT_RE = /\b(context|example|for example|background|reference|scenario)\b/i;

export function analyzePrompt(text: string): Analysis {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const charCount = text.length;
  const issues: Issue[] = [];

  // (1) missing role → high
  if (!ROLE_RE.test(trimmed)) {
    issues.push({
      id: "role",
      severity: "high",
      title: "No role assigned",
      detail:
        "The prompt never tells the model who to be. Without a role, answers tend to be generic and middle-of-the-road.",
      fix: "Start with a role, e.g. “Act as an expert software engineer.” — or enable “Add role” and let the optimizer do it.",
    });
  }

  // (2) vague words → medium
  const vagueHits = Array.from(new Set((trimmed.match(VAGUE_RE) || []).map((w) => w.toLowerCase())));
  if (vagueHits.length > 0) {
    issues.push({
      id: "vague",
      severity: "medium",
      title: "Vague wording detected",
      detail: `Fuzzy words weaken instructions: ${vagueHits.join(", ")}. The model has to guess what “good” or “some” means here.`,
      fix: "Replace each fuzzy word with something measurable, e.g. “good” → “production-ready with error handling”.",
    });
  }

  // (3) no output format → high
  if (!FORMAT_RE.test(trimmed)) {
    issues.push({
      id: "format",
      severity: "high",
      title: "No output format specified",
      detail:
        "You didn't say how the answer should look. The model will pick a shape at random — wall of text, list, code — and you'll re-ask.",
      fix: "Name the shape: “Return a Markdown table with columns X, Y, Z” or “Answer step-by-step in numbered bullets”.",
    });
  }

  // (4) no constraints → medium
  if (!CONSTRAINT_RE.test(trimmed)) {
    issues.push({
      id: "constraints",
      severity: "medium",
      title: "No constraints given",
      detail:
        "Nothing tells the model what to avoid or stay inside of, so answers drift — too long, off-topic, or over-cautious.",
      fix: "Add boundaries: “Only cover X. Do not invent details. Keep it under 200 words.”",
    });
  }

  // (5) length
  if (wordCount > 0 && wordCount < 15) {
    issues.push({
      id: "short",
      severity: "medium",
      title: "Too short to be precise",
      detail: `Only ${wordCount} words. Very short prompts leave every decision to the model — role, depth, format, tone.`,
      fix: "Add at least a role, one constraint, and the output format you want.",
    });
  } else if (wordCount > 400) {
    issues.push({
      id: "rambling",
      severity: "low",
      title: "Rambling prompt",
      detail: `${wordCount} words without clear structure. Long prompts dilute the actual instruction — the model may answer the wrong part.`,
      fix: "Split it: one goal sentence, then context, then format, then constraints. Delete throat-clearing.",
    });
  }

  // (6) more than 2 question marks → medium
  const questionMarks = (trimmed.match(/\?/g) || []).length;
  if (questionMarks > 2) {
    issues.push({
      id: "questions",
      severity: "medium",
      title: "Too many questions",
      detail: `${questionMarks} question marks. Multi-question prompts get partial answers — the model picks the easiest one.`,
      fix: "Ask one thing per prompt, or number the questions and demand an answer to each.",
    });
  }

  // (7) no fallback → low
  if (!FALLBACK_RE.test(trimmed)) {
    issues.push({
      id: "fallback",
      severity: "low",
      title: "No fallback instruction",
      detail:
        "There's no instruction for what to do when the request is ambiguous. Models then guess silently instead of asking.",
      fix: "Add: “If anything is ambiguous, ask a clarifying question before answering.”",
    });
  }

  // (8) long but no context/example words → low
  if (wordCount > 120 && !CONTEXT_RE.test(trimmed)) {
    issues.push({
      id: "context",
      severity: "low",
      title: "Long but no context",
      detail:
        "A long prompt with no examples, background, or reference material. Abstract instructions alone produce abstract answers.",
      fix: "Paste one concrete example of input → desired output. Examples beat paragraphs of description.",
    });
  }

  const highs = issues.filter((i) => i.severity === "high").length;
  const mediums = issues.filter((i) => i.severity === "medium").length;
  const lows = issues.filter((i) => i.severity === "low").length;
  const score = Math.max(5, Math.min(100, 100 - (highs * 15 + mediums * 8 + lows * 4)));

  return { score, issues, wordCount, charCount };
}

function detectDomain(text: string): string {
  if (/blog|story|essay|article|email|novel|poem|copywriting|draft/i.test(text))
    return "professional writing coach";
  if (/data|sql|database|dataset|analysis|statistics|csv|pandas|spreadsheet/i.test(text))
    return "data analyst";
  if (/code|bug|function|python|javascript|typescript|debug|refactor|program|script|app|website|login/i.test(text))
    return "expert software engineer";
  return "domain expert";
}

export function optimizePrompt(text: string, opts: OptimizeOptions): string {
  const t = text.trim();
  if (!t) return "";
  const parts: string[] = [];

  if (opts.addRole && !ROLE_RE.test(t)) {
    const domain = detectDomain(t);
    const article = /^[aeiou]/i.test(domain) ? "an" : "a";
    parts.push(`Act as ${article} ${domain}.`);
  }

  parts.push(t);

  if (opts.addFormat) {
    parts.push(
      "**Output format:**\nPresent your answer in clean Markdown with headers and bullet points where they help. Use code blocks for any code."
    );
  }

  if (opts.addConstraints) {
    parts.push(
      "**Constraints:**\nBe specific and concrete — no generic filler. Address exactly what was asked and nothing more. If a detail is unknown, say so instead of inventing it."
    );
  }

  if (opts.addFallback) {
    parts.push("If anything is ambiguous, ask a clarifying question before answering.");
  }

  return parts.join("\n\n");
}

export function samplePrompts(): { label: string; text: string }[] {
  return [
    {
      label: "Vague coding prompt",
      text: "write some good code for a login page with nice design and various features",
    },
    {
      label: "Vague writing prompt",
      text: "write a nice blog post about various productivity things etc, make it great",
    },
    {
      label: "Decent prompt",
      text: "Act as a professional writing coach.\n\nReview the draft below and list exactly 5 concrete improvements.\n\n**Output format:**\nReturn a Markdown table with columns: Issue | Why it matters | Suggested fix.\n\n**Constraints:**\nOnly comment on clarity and structure. Do not rewrite the whole draft.\n\nIf anything is ambiguous, ask a clarifying question before answering.",
    },
    {
      label: "Rambling prompt",
      text: `ok so basically what i want is like, um, i need you to write something for me, it's kind of about, well, let me think, it's about productivity i guess, or maybe about how to be productive, and i want it to be good, you know, really good, like the best thing ever, and it should have some tips in it, various tips, several tips actually, as many as you can think of, and also maybe some stuff about time management because that's kind of related, and things like that, and etc, and i was thinking maybe you could also talk about, hmm, what was i saying, oh right, productivity, and like how people can do more things in less time, which would be nice, and it would be great if it was long, like really long, because longer is better right, and i want it to sound professional but also casual, you know what i mean, like friendly but also serious, and maybe add some various examples of stuff, and things, and also, wait, i should mention that my audience is, um, people who read blogs, various people, several types of people actually, and they like good content, great content even, and i want the blog to be nice, really nice, with a nice title and nice headings and nice everything, and can you make it search friendly too, whatever that means, just make it good for google or something, and also, hmm, let me think about what else, oh yeah, i want it to mention my product, which is, well, i'll tell you about it later, but just leave a placeholder or something, or actually maybe don't, i don't know, you decide, and also make sure it's not boring, because boring is bad, nobody likes boring things, and stuff like that is just, ugh, and i need this soon, like as soon as possible, actually take your time, no rush, but also hurry, you know, and one more thing, can you ask me questions if you need to, or actually don't ask questions, just figure it out yourself, because i don't have time to answer questions, but also i want it to be perfect, so maybe do ask, i don't know, whatever you think is best, and yeah, that's basically it, i think, oh wait, also, i forgot to say, it should be about morning routines too, because those are popular, various morning routines, several of them, with good tips and nice ideas and great suggestions of things and stuff, and also evening routines, why not, various evening routines too, several of them as well, with good tips and nice ideas, and maybe afternoon routines, i don't know, just cover all the routines, all the various routines, several routines for every part of the day, and make each one good and nice and great, with things and stuff in each, etc etc etc, and that's really all, i promise, well, almost, one last thing, make it funny too, like really funny, the funniest thing anyone has ever read, but also serious, you know, funny but serious, that's the vibe, good luck`,
    },
  ];
}

export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

/** Simple LCS-based line diff. */
export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const m = A.length;
  const n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      out.push({ type: "same", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: A[i] });
      i++;
    } else {
      out.push({ type: "add", text: B[j] });
      j++;
    }
  }
  while (i < m) {
    out.push({ type: "del", text: A[i] });
    i++;
  }
  while (j < n) {
    out.push({ type: "add", text: B[j] });
    j++;
  }
  return out;
}
