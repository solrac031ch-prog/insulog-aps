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

module.exports = defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "device-compat.spec.js",
  timeout: 30_000,
  expect: {
    timeout: 6_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    storageState: professionalStorageState(),
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" }
    }
  ]
});
