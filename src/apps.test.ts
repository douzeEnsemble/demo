import { describe, expect, it } from "vitest";
import { DEMO_APPS, findDemoApp } from "./apps";
import { icons } from "./lib/icons";

describe("registre des démos", () => {
  it("a des slugs uniques, au format URL, et des icônes existantes", () => {
    expect(new Set(DEMO_APPS.map((a) => a.slug)).size).toBe(DEMO_APPS.length);
    for (const app of DEMO_APPS) {
      expect(app.slug).toMatch(/^[a-z0-9-]+$/);
      expect(icons[app.icon]).toBeDefined();
    }
  });

  it("charge la fonction de montage de chaque démo", async () => {
    for (const app of DEMO_APPS) expect(typeof (await app.load())).toBe("function");
  });

  it("retrouve une démo par son slug", () => {
    expect(findDemoApp("roue")?.name).toBe("Roue de tirage");
    expect(findDemoApp("inconnue")).toBeUndefined();
  });
});
