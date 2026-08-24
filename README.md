# Smart Resume Screener

A privacy-friendly, browser-based resume screener. Upload PDF or text resumes, paste a job description, and receive a ranked shortlist with clear skill, experience, and education evidence.

## Run it

For local-only screening, open `index.html` in any modern browser. No server, account, or API key is required.

For private, local AI evidence analysis, install [Ollama](https://ollama.com) and download a local model (the default is `gemma3`):

```bash
cd smart-resume-screener
ollama pull gemma3
npm start
```

Then visit `http://localhost:3000`, check **AI evidence analysis**, and screen the candidates. No API key or cloud request is used. To use another local model, set `OLLAMA_MODEL` before `npm start`; to use a non-default Ollama endpoint, set `OLLAMA_URL`.

## What it does

- Accepts PDF, TXT, and pasted resume content
- Extracts candidate name, email, skills, experience, and education
- Identifies priority skills and experience requirements from a job description
- Produces a local LLM 1-10 fit score with evidence and gaps, alongside a deterministic 0-100 score
- Lets you adjust the shortlist threshold and export a CSV
- Adds optional AI-generated, job-related evidence and gap summaries

## Scoring approach

The app uses explainable, local matching:

- Skills: 55 points, based on coverage of job-description skills
- Experience: 30 points, based on stated years against the requirement
- Education: 15 points, based on relevant education signals

It is designed as a starting point for screening, not an automated hiring decision. Always review source resumes and apply consistent human oversight.

## Local AI analysis

The included server calls the Ollama API on `127.0.0.1:11434` and uses a JSON schema to request reliable structured output. Resume text never leaves your machine unless you deliberately point `OLLAMA_URL` at another endpoint. It only analyzes resume text when you enable AI evidence analysis.

The model receives this job-focused instruction:

```
Compare only job-related evidence in resumes against the job description. Do not
infer or use protected characteristics or proxies. Do not make a hiring decision.
Return concise evidence and gaps for human review.
```

The deterministic score stays visible alongside the model output. Treat every result as decision support: review source resumes and apply consistent human oversight.

## Architecture

```
Browser dashboard
  -> PDF.js extracts PDF text / browser reads TXT text
  -> deterministic extractor identifies profile signals
  -> Node.js local server
      -> Ollama local model: semantic 1-10 fit score, evidence, and gaps
      -> SQLite: parsed profile, resume text, job description, and scores
  -> ranked shortlist and CSV export
```

The SQLite database is created automatically as `data.sqlite` beside the server. It stays local and is intentionally excluded from Git. You can inspect saved records through `GET /api/resumes` while the app is running.

## LLM prompt and output contract

The server sends the job description plus resume text to the locally running Ollama model and requires this structured response for every candidate:

```json
{
  "candidates": [{
    "id": 0,
    "fit_score": 1,
    "matched_evidence": ["Job-related evidence from the resume"],
    "gaps": ["Job-related gap or missing evidence"],
    "justification": "Concise, job-related rationale for human review"
  }]
}
```

The prompt prohibits protected-characteristic inference and requires the model to provide decision support only, not a hiring decision.

## Demo

Use [demo-video.mp4](demo-video.mp4) as a 1 minute walkthrough for understanding how to use the smart resume screener.
