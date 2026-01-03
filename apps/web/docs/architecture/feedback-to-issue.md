# On-site Feedback → AI Triage → BD Issue
Date: 2025-12-01  
Issue: markdowntown-7z8.57

## UX
- Persistent, collapsible “Feedback” bubble (bottom-right). Tooltip: “How can we improve this site?”
- On expand: textarea (required), optional email/handle, quick tags (Bug/Idea/Content).
- Success toast; widget stays minimizable.

## Anti-abuse / human signals
- Turnstile/hCaptcha on submit (score-based).
- Honeypot field + min length; per-IP/device rate limit.
- Optional email for follow-up (not required).

## Backend flow
1) POST `/api/feedback` stores message + metadata (ip, ua, sessionId) in `feedback` table.
2) Invoke repo-aware model with context (key docs + recent commits + BD ready list) to:
   - Summarize/classify (bug/feature/content/support).
   - Propose priority and BD title/description.
   - If confidence low, draft 1–2 clarifying questions.
3) If clarifications needed and email present, send via email (or in-app message); else skip.
4) Auto-create BD task when confidence ≥ threshold; include feedback id and model summary.
5) Update feedback row with `bdIssueId`, `status`, `modelConfidence`.

## Data model (feedback table)
- id (cuid), message text, tags string[], email?, sessionId?, ip, ua, status (new/clarify/pushed/closed), bdIssueId?, modelSummary, modelConfidence, createdAt.

## API
- `POST /api/feedback` – validates, captcha, stores, triggers AI.
- `POST /api/feedback/clarify` (optional) – record replies from user to clarifying questions.

## Checklist
- [ ] Frontend widget (portal) with collapse state; integrates Turnstile/hCaptcha when score low.
- [ ] API route with validation, rate limiting, captcha, persistence.
- [ ] AI call with repo/docs context; implement confidence threshold + clarification path.
- [ ] BD integration to create task (CLI invocation or direct file write + sync).
- [ ] Admin/triage view (even simple bd search link) to track feedback→issue mapping.
- [ ] Tests: API validation, rate limits, captcha path; model response shaping (mocked).
