# BetterView AI - Privacy Policy

**Effective Date:** November 2026

BetterView AI is committed to protecting your privacy. This policy explains how BetterView AI handles user information.

## 1. Zero Data Collection
BetterView AI **does not collect, transmit, store, or sell any personal data**, conversation content, browsing history, or user telemetry. No analytics, tracking pixels, or third-party monitoring scripts are embedded in the extension.

## 2. No External Network Requests
BetterView AI **makes zero outbound network requests**. All parsing, JSON validation, and DOM rendering occur 100% locally within your browser. Your conversations with Google Gemini and Grok remain strictly between you and those respective services.

## 3. Use of Permissions
- **`storage`**: Used exclusively to store local user preferences (such as theme mode: auto, light, or dark) and local onboarding state flags (such as whether the welcome tour has been viewed). No personal or conversational data is ever saved to storage.
- **Host Permissions (`https://gemini.google.com/*`, `https://grok.com/*`)**: Required solely to inject the content script that detects visual component code blocks and renders UI cards directly within the chat interface on those two platforms.

## 4. Open Source & Transparency
BetterView AI is fully open-source and its source code is publicly inspectable at:
https://github.com/hardikguptaofficialgit/betterview

## 5. Contact
If you have questions regarding this Privacy Policy, please open an issue on our GitHub repository.
