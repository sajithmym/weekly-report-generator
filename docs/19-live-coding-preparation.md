# Technical walkthrough preparation

Be ready to explain why reports use a Monday UTC `weekStart`, why `(userId, weekStart)` is unique, and why immutable version snapshots preserve review evidence. Demonstrate the state machine: draft, submit, correction, resubmit, approval.

Differentiate frontend navigation from server authorization. Team members own only their reports; managers see non-drafts/manage projects but cannot mutate users; administrators manage access. Explain that current role/status is loaded on protected requests.

Be able to discuss bcrypt, memory-held access tokens, HttpOnly rotating refresh cookies, hashed refresh storage, replay prevention, CORS, Helmet, DTO validation, throttling, and production secret validation. Run [15 Testing](15-testing.md), seed local data, keep PostgreSQL live, and state the real boundaries: no project-membership enforcement, deployment pipeline, or browser E2E suite.
