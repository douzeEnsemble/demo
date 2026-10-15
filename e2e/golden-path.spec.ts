import { test, expect } from "@playwright/test";

test("l'accueil liste les démos et chacune s'ouvre avec une graine dans l'URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-card")).toHaveCount(4);

  for (const [name, slug] of [
    ["Roue de tirage", "roue"],
    ["Sondage", "sondage"],
    ["Gestion de stock", "stock"],
    ["Réservation de repas", "repas"],
  ]) {
    await page.click(`.app-card[data-slug=${slug}]`);
    await expect(page).toHaveURL(new RegExp(`/${slug}\\?seed=[A-Z2-9]{6}$`));
    await expect(page.locator(".app-title")).toHaveText(name);
    await expect(page).toHaveTitle(`${name} · Démos`);
    await page.click("#shell-home");
    await expect(page).toHaveURL(/\/$/);
  }
});

test("une même graine redonne les mêmes données, « Nouvelles données » en tire d'autres", async ({ page }) => {
  await page.goto("/stock?seed=E2E001");
  const first = await page.locator("#stock-products").innerText();
  await page.reload();
  await expect(page.locator("#stock-products")).toHaveText(first);
  await expect(page.locator("#shell-seed")).toHaveText("E2E001");

  await page.click("#shell-regenerate");
  await expect(page).not.toHaveURL(/seed=E2E001/);
  await expect(page.locator("#stock-products")).not.toHaveText(first);

  // Le bouton précédent revient au jeu de données d'avant.
  await page.goBack();
  await expect(page.locator("#shell-seed")).toHaveText("E2E001");
  await expect(page.locator("#stock-products")).toHaveText(first);
});

test("une démo inconnue renvoie vers l'accueil", async ({ page }) => {
  await page.goto("/nimporte-quoi");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".app-card")).toHaveCount(4);
});
