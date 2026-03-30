# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public issue.** Instead, email the maintainer directly or use GitHub's [private vulnerability reporting](https://github.com/hummusonrails/poke-code/security/advisories/new).

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 7 days.

## Scope

poke-code interacts with macOS system services (iMessage via `chat.db`) and AI APIs. Security concerns we care about include:

- Unauthorized access to `chat.db` or message content
- API key exposure or credential leakage
- Prompt injection via message content
- Unintended code execution through tool calls
