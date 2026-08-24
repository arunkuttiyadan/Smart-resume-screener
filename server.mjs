import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const ollamaUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const model = process.env.OLLAMA_MODEL || "gemma3";
const database = new DatabaseSync(join(root, "data.sqlite"));
database.exec(`CREATE TABLE IF NOT EXISTS parsed_resumes (
  id INTEGER PRIMARY KEY, candidate_name TEXT NOT NULL, email TEXT, resume_text TEXT NOT NULL,
  skills_json TEXT NOT NULL, experience_years INTEGER, education_detected INTEGER NOT NULL,
  job_description TEXT NOT NULL, deterministic_score INTEGER NOT NULL, llm_fit_score INTEGER,
  llm_analysis_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

const schema = { type: "object", additionalProperties: false, required: ["candidates"], properties: {
  candidates: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["id", "fit_score", "matched_evidence", "gaps", "justification"], properties: {
      id: { type: "integer" }, fit_score: { type: "integer", minimum: 1, maximum: 10 },
      matched_evidence: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } }, justification: { type: "string" }
    }
  }}
}};
const send = (res, status, payload, type = "application/json") => { res.writeHead(status, { "Content-Type": type }); res.end(type === "application/json" ? JSON.stringify(payload) : payload); };

async function analyze(body) {
  const candidates = body.candidates.map(c => `ID: ${c.id}\nName: ${c.name}\nResume:\n${c.resume}`).join("\n\n---\n\n");
  const prompt = `Compare each candidate with the job description using only job-related resume evidence. Assign an integer fit score from 1 (very limited fit) to 10 (strong fit). Do not infer or use protected characteristics, age, gender, ethnicity, disability, religion, nationality, health, family status, or proxies. Do not make a hiring decision. Return concise evidence and gaps for a human reviewer.\n\nJob description:\n${body.job_description}\n\nCandidates:\n${candidates}\n\nReturn JSON exactly matching this schema:\n${JSON.stringify(schema)}`;
  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, stream: false, format: schema, options: { temperature: 0 }, messages: [{ role: "user", content: prompt }] }) });
  } catch { throw Error(`Could not reach Ollama at ${ollamaUrl}. Start Ollama and make sure the ${model} model is installed.`); }
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Local LLM analysis failed");
  if (!data.message?.content) throw Error("The local model returned no structured response.");
  return JSON.parse(data.message.content);
}

function saveParsedResumes(body, analysis) {
  const byId = new Map(analysis.candidates.map(candidate => [candidate.id, candidate]));
  const insert = database.prepare(`INSERT INTO parsed_resumes (candidate_name, email, resume_text, skills_json, experience_years, education_detected, job_description, deterministic_score, llm_fit_score, llm_analysis_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const candidate of body.candidates) {
    const result = byId.get(candidate.id);
    insert.run(candidate.name, candidate.email || null, candidate.resume, JSON.stringify(candidate.skills || []), candidate.years || null, candidate.education ? 1 : 0, body.job_description, candidate.deterministic_score, result?.fit_score || null, JSON.stringify(result || null));
  }
}

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/analyze") {
      let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 3_000_000) throw Error("Request is too large"); }
      const body = JSON.parse(raw), analysis = await analyze(body); saveParsedResumes(body, analysis); return send(res, 200, analysis);
    }
    if (req.method === "GET" && req.url === "/api/resumes") {
      return send(res, 200, database.prepare("SELECT id, candidate_name, email, skills_json, experience_years, education_detected, llm_fit_score, created_at FROM parsed_resumes ORDER BY id DESC").all());
    }
    const path = normalize(join(root, req.url === "/" ? "index.html" : req.url));
    if (!path.startsWith(root)) return send(res, 403, { error: "Forbidden" });
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(path)] || "application/octet-stream";
    send(res, 200, await readFile(path, "utf8"), type);
  } catch (error) { send(res, 500, { error: error.message }); }
}).listen(process.env.PORT || 3000, "127.0.0.1", () => console.log(`ClearMatch running at http://localhost:3000 using local model ${model}`));
