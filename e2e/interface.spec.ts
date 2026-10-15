import { test, expect } from "@playwright/test";

test("le thème choisi persiste après un rechargement et entre accueil et démos", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.click(".app-card[data-slug=sondage]");
  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("le mode accessibilité s'active depuis une démo et réduit les animations de la roue", async ({ page }) => {
  await page.goto("/roue?seed=E2E001");
  await page.click("#a11y-toggle");
  await page.locator(".accessibility-modal input[data-key=reduceMotion]").check();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal-overlay")).toHaveCount(0);

  // Sans animation, le résultat tombe immédiatement.
  await page.click("#wheel-spin");
  await expect(page.locator("#wheel-result")).toContainText("est tiré", { timeout: 1_000 });
});
