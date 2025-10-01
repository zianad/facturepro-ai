// To run this application, you need to provide your Gemini API key.
// 1. Rename this file from "env.example.js" to "env.js".
// 2. Replace "YOUR_GEMINI_API_KEY_HERE" with your actual API key.
//
// IMPORTANT: Do NOT commit the `env.js` file to your Git repository.
// It should be ignored by Git to prevent accidental exposure of your key.

window.process = {
  env: {
    // FIX: Renamed VITE_API_KEY to API_KEY to align with Gemini API guidelines.
    API_KEY: "YOUR_GEMINI_API_KEY_HERE"
  }
};