# Smart Resume Screener - 2-3 Minute Demo Script

## 0:00-0:20 - Introduce the application

Open ClearMatch and say: “This is a local smart resume screener. It accepts PDF or text resumes, compares them against a job description, and presents explainable shortlist results. Candidate data stays on this machine.”

## 0:20-0:50 - Add the role requirements

Paste a job description. Point out the detected requirement signals and the shortlist threshold. Explain that the deterministic score is based on direct skills, experience, and education evidence.

## 0:50-1:20 - Upload candidates

Upload two or three PDF or TXT resumes. Point out that the app extracts the candidate name, email, skills, years of experience, and education signal. Mention that PDF text is processed in the browser.

## 1:20-1:55 - Run local LLM analysis

Enable **AI evidence analysis** and click **Screen candidates**. Explain that the Node server sends the job description and resume text only to Ollama running on `127.0.0.1`. The model returns a structured 1-10 fit score, matched evidence, gaps, and a concise justification.

## 1:55-2:25 - Review results and persistence

Review the ranked cards. Explain that shortlisted candidates meet the selected threshold and every card shows evidence for human review. Open a candidate profile, then export the CSV. Finally, mention that parsed profiles and screening results are stored in the local SQLite database, not in a cloud service.

## 2:25-2:40 - Close responsibly

Conclude: “The score is a decision-support signal, not an automated hiring decision. A human reviewer should consistently assess the source resume and job-related evidence.”
