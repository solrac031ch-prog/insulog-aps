const { test, expect } = require("@playwright/test");
const baseline = require("./visual-baseline.json");

const RECORD_MODE = process.env.VISUAL_RECORD === "1";

function hammingDistance(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < hexA.length; i += 1) {
    let value = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (value) {
      distance += value & 1;
      value >>= 1;
    }
  }
  return distance;
}

async function perceptualHash(page, screenshotBuffer) {
  const src = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;
  return page.evaluate(async (dataUrl) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 9, 8);
    const pixels = context.getImageData(0, 0, 9, 8).data;

    const luminance = (index) => (
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114
    );

    let bits = "";
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = (y * 9 + x) * 4;
        const right = (y * 9 + x + 1) * 4;
        bits += luminance(left) > luminance(right) ? "1" : "0";
      }
    }

    let hex = "";
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  }, src);
}

async function settleVisual(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(80);
}

async function captureVisual(page, testInfo, key) {
  await settleVisual(page);

  const path = testInfo.outputPath(`${key}.png`);
  const screenshot = await page.screenshot({
    path,
    animations: "disabled",
    caret: "hide",
    fullPage: false
  });
  await testInfo.attach(`${key}.png`, { path, contentType: "image/png" });

  const hash = await perceptualHash(page, screenshot);
  const expected = baseline.profiles[key];
  const tolerance = expected?.tolerance ?? baseline.defaultTolerance ?? 6;

  if (RECORD_MODE) {
    console.log(`VISUAL_BASELINE ${key} ${hash}`);
    return hash;
  }

  expect(expected, `Missing visual baseline for ${key}; current hash ${hash}`).toBeTruthy();
  const distance = hammingDistance(hash, expected.hash);
  expect(
    distance,
    `${key}: perceptual hash ${hash} differs from ${expected.hash} by ${distance} bits (tolerance ${tolerance})`
  ).toBeLessThanOrEqual(tolerance);
  return hash;
}

async function gotoFlowSelection(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await expect(page.locator("#p2")).toHaveClass(/active/);
}

async function gotoFollowup(page) {
  await gotoFlowSelection(page);
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await expect(page.locator("#p35")).toHaveClass(/active/);
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expect(page.locator("#p4")).toHaveClass(/active/);
}

async function fillFasting(page, values) {
  const inputs = page.locator("#tabla-seguimiento .ay");
  for (let index = 0; index < values.length; index += 1) {
    await inputs.nth(index).fill(String(values[index]));
  }
}

async function fillPreEleven(page, values) {
  const inputs = page.locator("#tabla-seguimiento .pre");
  for (let index = 0; index < values.length; index += 1) {
    await inputs.nth(index).fill(String(values[index]));
  }
}

async function gotoHypoglycemiaAlert(page) {
  await gotoFollowup(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [60, 105, 110]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#p4")).toHaveClass(/active/);
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await expect(page.locator("#hipo-ada-titulo")).toContainText("nivel 1");
}

async function gotoHighDoseReview(page) {
  await gotoFollowup(page);
  await page.locator("#peso-seguimiento").fill("50");
  await page.locator("#tipo-esquema").selectOption("2");
  await page.locator("#am-actual").fill("20");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [160, 160, 160]);
  await fillPreEleven(page, [160, 160, 160]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#p41")).toHaveClass(/active/);
  await expect(page.locator("#p41")).toContainText("dosis alta");
}

async function gotoClinicalNote(page) {
  await gotoFollowup(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [160, 160, 160]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#p5")).toHaveClass(/active/);
  await expect(page.locator("#nota-clinica")).toContainText("Nuevo Esquema sugerido");
}

for (const profile of [
  { name: "mobile", viewport: { width: 390, height: 844 } },
  { name: "desktop", viewport: { width: 1440, height: 1000 } }
]) {
  test.describe(`visual contract ${profile.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(profile.viewport);
    });

    test(`portada ${profile.name}`, async ({ page }, testInfo) => {
      await page.goto("/");
      await expect(page.locator("#p0")).toHaveClass(/active/);
      await captureVisual(page, testInfo, `${profile.name}-p0`);
    });

    test(`selección de flujo ${profile.name}`, async ({ page }, testInfo) => {
      await gotoFlowSelection(page);
      await captureVisual(page, testInfo, `${profile.name}-p2`);
    });

    test(`seguimiento HGT ${profile.name}`, async ({ page }, testInfo) => {
      await gotoFollowup(page);
      await captureVisual(page, testInfo, `${profile.name}-p4`);
    });

    test(`alerta de hipoglicemia ${profile.name}`, async ({ page }, testInfo) => {
      await gotoHypoglycemiaAlert(page);
      await captureVisual(page, testInfo, `${profile.name}-hypo`);
    });

    test(`revisión de dosis alta ${profile.name}`, async ({ page }, testInfo) => {
      await gotoHighDoseReview(page);
      await captureVisual(page, testInfo, `${profile.name}-high-dose`);
    });

    test(`nota clínica ${profile.name}`, async ({ page }, testInfo) => {
      await gotoClinicalNote(page);
      await captureVisual(page, testInfo, `${profile.name}-note`);
    });
  });
}
