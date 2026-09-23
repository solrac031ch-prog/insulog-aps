const { defineConfig } = require("@playwright/test");

function professionalStorageState() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  return {
    cookies: [],
    origins: [{
      origin: "http://127.0.0.1:4173",
      localStorage: [{
        name: "insulog.professional.rut.daily.v1",
        value: JSON.stringify({ date, rut: "12.345.678-5" })
      }]
    }]
  };
}

const commonUse = {
  baseURL: "http://127.0.0.1:4173",
  storageState: professionalStorageState(),
  serviceWorkers: "allow",
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
  video: "retain-on-failure"
};

module.exports = defineConfig({
  testDir: "./tests/e2e",
  testMatch: "device-compat.spec.js",
  timeout: 30_000,
  expect: { timeout: 6_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : "list",
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  },
  projects: [
    {
      name: "iphone-webkit",
      use: {
        ...commonUse,
        browserName: "webkit",
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      }
    },
    {
      name: "android-chromium",
      use: {
        ...commonUse,
        browserName: "chromium",
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
      }
    }
  ]
});
