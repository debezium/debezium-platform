import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('before:browser:launch', (browser, launchOptions) => {
        // Disable web security to allow cross-origin requests in local dev
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          // Chrome, Edge, etc.
          launchOptions.args.push('--disable-web-security');
          launchOptions.args.push('--disable-site-isolation-trials');
        }

        if (browser.name === 'electron') {
          // Electron browser
          launchOptions.preferences.webSecurity = false;
        }

        if (browser.family === 'firefox') {
          // Firefox
          launchOptions.preferences['security.fileuri.strict_origin_policy'] = false;
        }

        return launchOptions;
      });
    },
  },
  env: {
    apiUrl: "http://localhost:8080",
  },
  chromeWebSecurity: false,
});

