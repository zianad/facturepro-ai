// To run this application locally, you need to provide your Gemini API key.
// 1. Rename this file from "env.example.js" to "env.js".
// 2. Replace "YOUR_GEMINI_API_KEY_HERE" with your actual API key.
//
// IMPORTANT: Do NOT commit the `env.js` file to your Git repository.
// It has been added to the .gitignore file to prevent accidental exposure of your key.

window.process = {
  env: {
    API_KEY: "YOUR_GEMINI_API_KEY_HERE"
  }
};
