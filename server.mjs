import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const ollamaUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const model = process.env.OLLAMA_MODEL || "gemma3";
const schema = {
  type: "object", additionalProperties: false, required: ["candidates"], properties: {
    candidates: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["id", "matched_evidence", "gaps", "justification"], properties: {
        id: { type: "integer" }, matched_evidence: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } }, justification: { type: "string" }
      }
    }}
  }
};

const send = (res, status, payload, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(payload) : payload);
};

async function analyze(body) {
  const candidates = body.candidates.map(c => `ID: ${c.id}\nName: ${c.name}\nResume:\n${c.resume}`).join("\n\n---\n\n");
  const prompt = `Compare the candidates using only job-related evidence. Do not infer or use protected characteristics, age, gender, ethnicity, disability, religion, nationality, health, family status, or proxies. Do not make a hiring decision. Return concise matched evidence and gaps for human review.\n\nJob description:\n${body.job_description}\n\nCandidates:\n${candidates}\n\nReturn JSON that conforms exactly to this schema:\n${JSON.stringify(schema)}`;
  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false, format: schema, options: { temperature: 0 }, messages: [{ role: "user", content: prompt }] })
    });
  } catch {
    throw Error(`Could not reach Ollama at ${ollamaUrl}. Start Ollama and make sure the ${model} model is installed.`);
  }
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Local LLM analysis failed");
  if (!data.message?.content) throw Error("The local model returned no structured response.");
  return JSON.parse(data.message.content);
}

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/analyze") {
      let raw = "";
      for await (const chunk of req) { raw += chunk; if (raw.length > 3_000_000) throw Error("Request is too large"); }
      return send(res, 200, await analyze(JSON.parse(raw)));
    }
    const path = normalize(join(root, req.url === "/" ? "index.html" : req.url));
    if (!path.startsWith(root)) return send(res, 403, { error: "Forbidden" });
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(path)] || "application/octet-stream";
    send(res, 200, await readFile(path, "utf8"), type);
  } catch (error) { send(res, 500, { error: error.message }); }
}).listen(process.env.PORT || 3000, "127.0.0.1", () => console.log(`ClearMatch running at http://localhost:3000 using local model ${model}`));
