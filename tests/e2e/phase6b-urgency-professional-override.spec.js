const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function openFollowupResult(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("2");
  await page.locator("#am-actual").fill("12");
  await page.locator("#pm-actual").fill("12");
  const fasting = page.locator("#tabla-seguimiento .ay");
  const pre = page.locator("#tabla-seguimiento .pre");
  for (let i = 0; i < 3; i += 1) {
    await fasting.nth(i).fill("100");
    await pre.nth(i).fill("100");
  }
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");

  // Simula una alerta crítica ya emitida por Clinical r2. La alerta debe
  // conservarse, pero una decisión profesional explícita y justificada
  // puede definir una pauta distinta y continuar hasta el documento final.
  await page.evaluate(() => {
    const note = document.getElementById("nota-clinica");
    const urgent = "SEGUIMIENTO NPH\nHIPOGLICEMIA NIVEL 3: Clinical r2 recomienda evaluación urgente.\nDosis sugerida AM 12 UI · PM 12 UI.";
    note.dataset.rawText = urgent;
    note.textContent = urgent;
  });
}

test("criterio profesional prevalece ante alerta de urgencia y llega al PDF con la pauta documentada", async ({ page }) => {
  await openFollowupResult(page);

  await page.locator("#best-review-modify").click();
  await expect(page.locator("#best-modify-panel")).toBeVisible();
  await expect(page.locator("#best-review-status")).toContainText("Puede modificar la pauta por criterio profesional");

  await page.locator("#best-final-am").fill("14");
  await page.locator("#best-final-pm").fill("12");
  await page.locator("#best-modify-reason").fill("Criterio clínico del médico tratante tras reevaluación presencial del paciente");
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.professionalDecision).toBe("modificada");
  expect(state.professionalAm).toBe(14);
  expect(state.professionalPm).toBe(12);
  await expect(page.locator("#best-review-status")).toContainText("prevalece la pauta documentada por el profesional");
  await expect(page.locator("#nota-clinica")).toContainText("Clinical r2 había activado una ruta de urgencia");
  await expect(page.locator("#nota-clinica")).toContainText("AM 14 UI");
  await expect(page.locator("#nota-clinica")).toContainText("PM 12 UI");

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");

  await page.locator("#nombre-paciente").fill("Paciente criterio médico");
  await page.locator("#fecha-nacimiento-paciente").fill("1958-11-02");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("Paciente criterio médico");
  await expect(frame.locator("#pdf")).toContainText("14 UI");
  await expect(frame.locator("#pdf")).toContainText("12 UI");
});


async function openRealLevel3Result(page, { cause = "none", timing = "fasting", neuro = "no" } = {}) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("2");
  await page.locator("#am-actual").fill("12");
  await page.locator("#pm-actual").fill("20");

  const fasting = page.locator("#tabla-seguimiento .ay");
  const pre = page.locator("#tabla-seguimiento .pre");
  for (const [index, value] of ["58", "92", "105"].entries()) await fasting.nth(index).fill(value);
  for (const [index, value] of ["100", "110", "120"].entries()) await pre.nth(index).fill(value);

  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await page.locator("#hipo-con-ayuda").click();
  await expect(page.locator("#hipo3-review-panel")).toBeVisible();

  await page.locator("#hipo3-momento").selectOption(timing);
  await page.locator("#hipo3-causa").selectOption(cause);
  await page.locator("#hipo3-neuro").selectOption(neuro);
  await page.locator("#hipo3-continuar").click();
  await expectActivePage(page, "p5");
}

test("nivel 3 con patrón claro propone reducir 20% la dosis implicada y permite aceptar Insulog", async ({ page }) => {
  await openRealLevel3Result(page);

  await expect(page.locator("#nota-clinica")).toContainText("PROPUESTA INSULOG: reducir 20% la NPH PM");
  await expect(page.locator("#nota-clinica")).toContainText("AM 12 UI | PM 16 UI");
  await expect(page.locator("#best-review-accept")).toHaveText("ACEPTAR PROPUESTA INSULOG");
  await expect(page.locator("#best-review-accept")).toBeEnabled();

  await page.locator("#best-review-accept").click();
  await expect(page.locator("#best-review-status")).toContainText("Propuesta de reducción de Insulog");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.level3AutomaticRecommendation).toBe(true);
  expect(state.level3ImplicatedDose).toBe("pm");
  expect(state.level3ReductionPercent).toBe(20);
  expect(state.professionalDecision).toBe("aceptada");
  expect(state.professionalAm).toBe(12);
  expect(state.professionalPm).toBe(16);

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");
  await page.locator("#nombre-paciente").fill("Paciente nivel 3 propuesta");
  await page.locator("#fecha-nacimiento-paciente").fill("1958-11-02");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("Hipoglicemia nivel 3");
  await expect(frame.locator("#pdf")).toContainText("propuesta Insulog aceptada");
  await expect(frame.locator("#pdf")).toContainText("20%");
  await expect(frame.locator("#pdf")).toContainText("16 UI");
});

test("nivel 3 con causa reversible deja la dosis a ajuste médico y deshabilita aceptar", async ({ page }) => {
  await openRealLevel3Result(page, { cause: "reduced_intake" });

  await expect(page.locator("#nota-clinica")).toContainText("AJUSTE MÉDICO REQUERIDO");
  await expect(page.locator("#best-review-accept")).toHaveText("AJUSTE MÉDICO REQUERIDO");
  await expect(page.locator("#best-review-accept")).toBeDisabled();
  await expect(page.locator("#best-review-status")).toContainText("MODIFICAR PLAN o REEVALUAR");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.level3AutomaticRecommendation).toBe(false);
  expect(state.level3RequiresMedicalAdjustment).toBe(true);
});


test("crisis hiperglicémica permite documentar derivación sin inventar una dosis de NPH", async ({ page }) => {
  await page.goto("/?driveEndpoint=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FTEST-ENDPOINT-123456%2Fexec");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();

  await page.locator("#hba1c-inicio").fill("12");
  await page.locator("#glicemia-ayunas-inicio").fill("280");
  await page.locator("#glicemia-casual-inicio").fill("350");
  await page.locator("#vfg-inicio").fill("90");
  await page.locator('.catabolico-btn[data-value*="cetosis"]').click();
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();

  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("POSIBLE CRISIS HIPERGLICÉMICA / CETOSIS");
  await expect(page.locator("#best-review-accept")).toHaveText("DERIVAR A URGENCIA SIN PAUTA");
  await expect(page.locator("#best-review-accept")).toBeEnabled();

  await page.locator("#best-review-accept").click();
  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.professionalDecision).toBe("aceptada");
  expect(state.professionalAm).toBeNull();
  expect(state.professionalPm).toBeNull();
  await expect(page.locator("#nota-clinica")).toContainText("No se emite una nueva pauta ambulatoria de NPH");

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");
  await page.locator("#nombre-paciente").fill("Paciente crisis QA");
  await page.locator("#fecha-nacimiento-paciente").fill("1980-10-10");

  const requestPromise = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().includes("script.google.com/macros/s/TEST-ENDPOINT-123456/exec")
  );
  await page.locator("#p6").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  const request = await requestPromise;
  const payload = JSON.parse(request.postData());

  expect(payload.hyperglycemicEmergency).toBe(true);
  expect(payload.urgencyRoute).toBe(true);
  expect(payload.professionalDecision).toBe("Aceptada");
  expect(payload.recommendationText).toBe("Ruta de urgencia: sin titulación automática de NPH");
  expect(payload.recommendedTotal).toBeNull();
  expect(payload.finalTotal).toBeNull();
  expect(payload.initiationFasting).toBe(280);
  expect(payload.initiationCasual).toBe(350);
});
