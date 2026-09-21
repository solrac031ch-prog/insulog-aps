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
  await expect(page.locator("#best-review-status")).toContainText("prevalece la pauta modificada por el profesional");
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
