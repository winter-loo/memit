# Chrome Web Store Publishing Information

This document contains the necessary information for submitting Memit to the Chrome Web Store.

## Store Listing Details

### **Name**
Memit

### **Summary**
AI-powered explanation and spaced repetition tool for deep understanding.

### **Detailed Description**
Memit is your ultimate companion for deep learning and memory retention. It combines the power of modern AI (Gemini, OpenRouter, MemCool) with spaced repetition to help you understand and remember anything you read online.

**Key Features:**
- **Instant AI Explanations**: Select any text on a webpage and get clear, concise explanations instantly.
- **Multiple AI Providers**: Support for Gemini, OpenRouter (GPT-4, Claude, etc.), and MemCool.
- **Spaced Repetition Integration**: Seamlessly format and send your learnings to Anki for long-term retention.
- **Customizable**: Configure your preferred models, API keys, and UI settings.
- **Privacy-Focused**: Your API keys are stored locally in your browser and never shared.

---

## Privacy Policy

### **Introduction**
Memit ("we," "our," or "the extension") is committed to protecting your privacy. This policy explains how we handle your data.

### **Data Collection and Usage**
- **Selected Text**: When you use the extension to explain a piece of text, that text is sent to the AI provider you have configured (e.g., Google Gemini, OpenRouter, or MemCool). This text is processed solely to provide you with an explanation.
- **API Keys**: If you provide your own API keys for services like Gemini or OpenRouter, these keys are stored locally in your browser's secure storage (`chrome.storage.sync`). They are never sent to our servers or any third party other than the respective AI provider when making a request.
- **Settings and Preferences**: Your settings (e.g., preferred model, theme) are stored locally in your browser.
- **Anki Integration**: If you use the Anki integration, data you explicitly choose to save is sent to your local AnkiConnect instance.

### **Data Sharing**
We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. Data is only shared with the AI providers you explicitly configure and use.

### **Permissions**
- `contextMenus`: Used to add the "Explain with Memit" option to your right-click menu.
- `storage`: Used to save your settings and API keys locally.
- `activeTab` & `scripting`: Used to display the explanation modal on the pages you visit.
- `tts`: Used for text-to-speech features.

### **Changes to This Policy**
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

---

## Assets to Prepare
- **Icon**: `public/vite.svg` (already configured in manifest).
- **Screenshots**: You will need to take at least one screenshot (1280x800 or 640x400) of the extension in action.
- **Promotional Tile**: 440x280 image for the store listing.
