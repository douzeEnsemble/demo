// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("basePath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    history.pushState({}, "", "/");
  });

  describe("déploiement à la racine (BASE_URL = \"/\")", () => {
    beforeEach(() => {
      vi.stubEnv("BASE_URL", "/");
    });

    it("appPath laisse un chemin absolu inchangé", async () => {
      const { appPath } = await import("./basePath");
      expect(appPath("/roue")).toBe("/roue");
    });

    it("appPath(\"/\") reste \"/\"", async () => {
      const { appPath } = await import("./basePath");
      expect(appPath("/")).toBe("/");
    });

    it("routePath renvoie le pathname tel quel", async () => {
      history.pushState({}, "", "/roue");
      const { routePath } = await import("./basePath");
      expect(routePath()).toBe("/roue");
    });
  });

  describe("déploiement sous un sous-chemin (BASE_URL = \"/demo/\")", () => {
    beforeEach(() => {
      vi.stubEnv("BASE_URL", "/demo/");
    });

    it("appPath préfixe le chemin par le sous-chemin de déploiement", async () => {
      const { appPath } = await import("./basePath");
      expect(appPath("/roue")).toBe("/demo/roue");
    });

    it("appPath(\"/\") renvoie le sous-chemin lui-même", async () => {
      const { appPath } = await import("./basePath");
      expect(appPath("/")).toBe("/demo/");
    });

    it("routePath retire le sous-chemin de déploiement", async () => {
      history.pushState({}, "", "/demo/roue");
      const { routePath } = await import("./basePath");
      expect(routePath()).toBe("/roue");
    });

    it("routePath renvoie le pathname tel quel s'il ne commence pas par le sous-chemin", async () => {
      history.pushState({}, "", "/autre-chemin");
      const { routePath } = await import("./basePath");
      expect(routePath()).toBe("/autre-chemin");
    });
  });
});
