const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

test("los medicamentos coadyuvantes del caso aparecen en inicio, seguimiento y PSCV", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    window.InsulogRuntime.state.patch({
      am: 18,
      pm: 10,
      professionalDecision: "aceptada",
      professionalAm: 18,
      professionalPm: 10,
      professionalReason: "",
      professionalDosePerKg: null
    });
    window.InsulogRuntime.navigation.go(6);
  });

  await expectActivePage(page, "p6");
  await page.locator("#nombre-paciente").fill("Paciente contrato documental");
  await page.locator("#fecha-nacimiento-paciente").fill("1965-03-14");

  const medication = page.locator('input[data-aps-med="seguimiento"][data-med-key="dapagliflozina10"]');
  await medication.check();
  await page.evaluate(() => {
    const input = document.querySelector('input[data-aps-med="seguimiento"][data-med-key="dapagliflozina10"]');
    window.InsulogRuntime.state.patch({
      tratamientoConcomitante: input?.dataset.label || "Dapagliflozina: 10 mg/día"
    });
  });

  const cases = [
    { button: "INICIO DE INSULINA", title: "Inicio de insulina NPH" },
    { button: "SEGUIMIENTO Y AJUSTE", title: "Seguimiento y ajuste de insulina NPH" },
    { button: "CONTROL PROGRAMA CV", title: "Control en Programa de Salud Cardiovascular" }
  ];

  for (const item of cases) {
    await page.locator("#p6").getByRole("button", { name: item.button, exact: true }).click();
    await expectActivePage(page, "p7");

    const frame = page.frameLocator("#pdf-preview-frame");
    const pdf = frame.locator("#pdf");
    await expect(pdf).toContainText(item.title);
    await expect(pdf.locator(".pdf-medicamentos-paciente")).toContainText("Medicamentos para la diabetes");
    await expect(pdf.locator(".pdf-medicamentos-paciente")).toContainText("Dapagliflozina 10 mg: 1 comprimido en la mañana");

    if (item.button === "CONTROL PROGRAMA CV") {
      await expect(pdf).toContainText("Si el glucómetro es propiedad del CESFAM, favor devolverlo en la encargado del programa de salud cardiovascular.");
      await expect(pdf).not.toContainText("oficina de dirección");
      await expect(pdf).not.toContainText("encargada Susan");
    }

    await page.getByRole("button", { name: "VOLVER / CAMBIAR DATOS", exact: true }).click();
    await expectActivePage(page, "p6");
  }
});

test("Documento · datos del paciente muestra acciones centradas y sin aviso técnico de Drive", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.InsulogRuntime.navigation.go(6));
  await expectActivePage(page, "p6");

  await expect(page.locator("#drive-sync-status")).toHaveCount(0);
  await expect(page.locator("#p6 .document-actions .btn")).toHaveCount(3);

  const metrics = await page.locator("#p6").evaluate((section) => {
    const actions = section.querySelector(".document-actions");
    const back = section.querySelector(":scope > .secondary-nav");
    const style = getComputedStyle(actions);
    const sectionRect = section.getBoundingClientRect();
    const backRect = back.getBoundingClientRect();
    return {
      display: style.display,
      justifyContent: style.justifyContent,
      backCenterDelta: Math.abs((backRect.left + backRect.width / 2) - (sectionRect.left + sectionRect.width / 2)),
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });

  expect(metrics.display).toBe("flex");
  expect(metrics.justifyContent).toBe("center");
  expect(metrics.backCenterDelta).toBeLessThanOrEqual(2);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
});
