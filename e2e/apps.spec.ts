import { test, expect } from "@playwright/test";

test("roue : un tirage désigne un gagnant et l'ajoute à l'historique", async ({ page }) => {
  await page.goto("/roue?seed=E2E001");
  await page.click("#wheel-spin");
  await expect(page.locator("#wheel-spin")).toBeDisabled();
  await expect(page.locator("#wheel-result")).toContainText("est tiré", { timeout: 10_000 });
  const winner = await page.locator("#wheel-result strong").innerText();
  await expect(page.locator("#wheel-history li").first()).toContainText(winner);
});

test("roue : tirage sans remise et ajout d'une case", async ({ page }) => {
  await page.goto("/roue?seed=E2E001");
  const count = await page.locator(".chip").count();
  await page.fill("#wheel-add-input", "Case e2e");
  await page.click("#wheel-add-form button[type=submit]");
  await expect(page.locator(".chip")).toHaveCount(count + 1);

  await page.check("#wheel-remove-winner");
  await page.click("#wheel-spin");
  await expect(page.locator("#wheel-result")).toContainText("retiré de la roue", { timeout: 10_000 });
  await expect(page.locator(".chip")).toHaveCount(count);
});

test("sondage : voter met à jour les résultats et le nombre de votants", async ({ page }) => {
  await page.goto("/sondage?seed=E2E001");
  const meta = await page.locator("#poll-meta").innerText();
  const votants = Number(meta.match(/(\d+) votants/)![1]);

  await page.locator("input[name=choice]").first().check();
  await page.fill("#poll-voter", "Testeur E2E");
  await page.click("#poll-submit");
  await expect(page.locator("#poll-message")).toHaveText("Merci Testeur E2E, ton vote est enregistré !");
  await expect(page.locator("#poll-meta")).toContainText(`${votants + 1} votants`);
  await expect(page.locator("#poll-recent li").first()).toContainText("Testeur E2E");
});

test("stock : une sortie décrémente le stock et apparaît dans les mouvements", async ({ page }) => {
  await page.goto("/stock?seed=E2E001");
  const product = page.locator(".product.status-ok").first();
  const name = await product.locator(".product-name").innerText();
  const before = Number(await product.locator(".stock-badge strong").innerText());

  await product.locator("[data-action=sale]").click();
  await expect(page.locator(".product", { hasText: name }).locator(".stock-badge strong")).toHaveText(String(before - 1));
  await expect(page.locator("#stock-movements li").first()).toContainText(`${name} · Vente`);

  await page.selectOption("#stock-status", "alert");
  await expect(page.locator(".product.status-ok")).toHaveCount(0);
});

test("repas : réserver met à jour la jauge et la liste", async ({ page }) => {
  await page.goto("/repas?seed=E2E001");
  const gauge = await page.locator("#booking-gauge").innerText();
  const taken = Number(gauge.match(/(\d+) places? réservées?/)![1]);

  await page.fill("input[name=name]", "Famille E2E");
  await page.locator("input[data-menu]").first().fill("2");
  await page.fill("#menu-enfant", "1");
  await page.click("#booking-form button[type=submit]");
  await expect(page.locator("#booking-message")).toHaveText("Réservation de Famille E2E enregistrée (3 couverts).");
  await expect(page.locator("#booking-gauge")).toContainText(`${taken + 3} places réservées`);
  await expect(page.locator(".reservation").first()).toContainText("Famille E2E");

  // Annulation en deux clics au même endroit.
  const cancel = page.locator(".reservation").first().locator("[data-action=cancel]");
  await cancel.click();
  await cancel.click();
  await expect(page.locator("#booking-gauge")).toContainText(`${taken} places réservées`);
});
