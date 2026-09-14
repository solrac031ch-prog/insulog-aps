const { test, expect } = require("@playwright/test");

test("diagnóstico visual de portada", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const diagnostics = await page.locator(".brand-title").evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      className: el.className,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      borderRight: `${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}`,
      borderBottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`,
      borderLeft: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`,
      outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`,
      boxShadow: cs.boxShadow,
      background: cs.backgroundColor,
      position: cs.position,
      display: cs.display,
      lineHeight: cs.lineHeight,
      overflow: cs.overflow,
      pseudoBefore: getComputedStyle(el, "::before").content,
      pseudoAfter: getComputedStyle(el, "::after").content
    };
  });
  console.log("PORTADA_DIAGNOSTICS", JSON.stringify(diagnostics));

  const borderElements = await page.locator("#p0 *").evaluateAll((nodes) => nodes
    .map((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
      return {
        tag: el.tagName,
        id: el.id,
        className: typeof el.className === "string" ? el.className : "",
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        borders: widths.join("/"),
        borderColor: cs.borderTopColor,
        outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`
      };
    })
    .filter((x) => x.rect.width > 300 && (x.borders !== "0px/0px/0px/0px" || !x.outline.startsWith("0px"))));
  console.log("PORTADA_WIDE_BORDERS", JSON.stringify(borderElements));

  await expect(page.locator(".brand-title")).toBeVisible();
});
