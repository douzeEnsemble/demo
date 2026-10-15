// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { DemoApp, DemoContext } from "./apps";

type Navigate = (path: string, replace?: boolean) => void;
let capturedNavigate: Navigate | undefined;

const cleanupHome = vi.fn();
const cleanupDemo = vi.fn();
const mountHomeView = vi.fn((_root: HTMLElement, navigate: Navigate) => {
  capturedNavigate = navigate;
  return cleanupHome;
});
const mountDemo = vi.fn((_root: HTMLElement, _ctx: DemoContext) => cleanupDemo);
const content = document.createElement("main");
let shellOptions: { onHome: () => void; onRegenerate: () => void; seed: string } | undefined;
const renderAppShell = vi.fn((_root: HTMLElement, opts: typeof shellOptions) => {
  shellOptions = opts;
  return content;
});
const demo: DemoApp = { slug: "roue", name: "Roue de tirage", tagline: "", icon: "wheel", load: async () => mountDemo };

vi.mock("./views/home", () => ({ mountHomeView }));
vi.mock("./components/appShell", () => ({ renderAppShell }));
vi.mock("./apps", () => ({ findDemoApp: (slug: string) => (slug === "roue" ? demo : undefined) }));
vi.mock("./lib/seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/seed")>()),
  randomSeed: vi.fn().mockReturnValueOnce("NEUF01").mockReturnValueOnce("NEUF02").mockReturnValue("NEUF03"),
}));

// main.ts est un point d'entrée à effets de bord (aucun export, monté une
// seule fois pour toute la durée du process, aussi bien réel qu'en test) :
// un seul scénario séquentiel plutôt que des `it()` indépendants — Vitest
// efface l'historique des mocks avant chaque test, ce qui casserait toute
// assertion à cheval sur plusieurs `it()` pour un module qui ne peut être
// importé (et donc rendu) qu'une seule fois.
describe("main (bootstrap applicatif)", () => {
  it("route entre accueil et démos, gère la graine, l'historique et les navigations périmées", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.setItem("demo:theme", "dark");
    history.replaceState({}, "", "/");
    const app = document.getElementById("app");

    await import("./main");
    await vi.waitFor(() => expect(mountHomeView).toHaveBeenCalled());

    // Préférences appliquées dès le démarrage ; accueil sur "/".
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(mountHomeView).toHaveBeenCalledWith(app, expect.any(Function));
    expect(document.title).toBe("Démos");

    // Ouvrir une démo sans graine : une graine est tirée et inscrite dans
    // l'URL sans nouvelle entrée d'historique, puis la démo est montée.
    const pushSpy = vi.spyOn(history, "pushState");
    const replaceSpy = vi.spyOn(history, "replaceState");
    capturedNavigate!("/roue");
    await vi.waitFor(() => expect(mountDemo).toHaveBeenCalled());
    expect(pushSpy).toHaveBeenCalledWith({}, "", "/roue");
    expect(replaceSpy).toHaveBeenCalledWith({}, "", "/roue?seed=NEUF01");
    expect(location.search).toBe("?seed=NEUF01");
    expect(cleanupHome).toHaveBeenCalledOnce();
    expect(renderAppShell).toHaveBeenCalledWith(app, expect.objectContaining({ app: demo, seed: "NEUF01" }));
    expect(mountDemo).toHaveBeenCalledWith(content, { seed: "NEUF01", today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(document.title).toBe("Roue de tirage · Démos");

    // « Nouvelles données » : nouvelle graine, nouvelle entrée d'historique.
    pushSpy.mockClear();
    shellOptions!.onRegenerate();
    await vi.waitFor(() => expect(mountDemo).toHaveBeenCalledTimes(2));
    expect(pushSpy).toHaveBeenCalledWith({}, "", "/roue?seed=NEUF02");
    expect(cleanupDemo).toHaveBeenCalledOnce();
    expect(mountDemo).toHaveBeenLastCalledWith(content, expect.objectContaining({ seed: "NEUF02" }));

    // Une graine valide déjà dans l'URL est reprise telle quelle (majuscules).
    history.replaceState({}, "", "/roue/?seed=abc");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(mountDemo).toHaveBeenLastCalledWith(content, expect.objectContaining({ seed: "ABC" })));

    // Retour à l'accueil depuis l'en-tête.
    shellOptions!.onHome();
    await vi.waitFor(() => expect(mountHomeView).toHaveBeenCalledTimes(2));
    expect(location.pathname).toBe("/");

    // Naviguer vers le chemin déjà courant ne touche pas l'historique.
    pushSpy.mockClear();
    replaceSpy.mockClear();
    capturedNavigate!("/");
    await vi.waitFor(() => expect(mountHomeView).toHaveBeenCalledTimes(3));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();

    // Une démo inconnue redirige vers l'accueil (sans entrée d'historique).
    history.replaceState({}, "", "/inconnue");
    replaceSpy.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(mountHomeView).toHaveBeenCalledTimes(4));
    expect(replaceSpy).toHaveBeenCalledWith({}, "", "/");

    // Deux popstate synchrones : le premier reste « en vol » derrière son
    // import() pendant que le second, plus récent, s'exécute — renderToken
    // doit écarter le premier, dans les deux sens (démo puis accueil, et
    // accueil puis démo).
    mountDemo.mockClear();
    mountHomeView.mockClear();
    history.replaceState({}, "", "/roue?seed=PERIME");
    window.dispatchEvent(new PopStateEvent("popstate"));
    history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(mountHomeView).toHaveBeenCalledOnce());
    await new Promise((r) => setTimeout(r, 10));
    expect(mountDemo).not.toHaveBeenCalled();

    mountHomeView.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));
    history.replaceState({}, "", "/roue?seed=RECENT");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(mountDemo).toHaveBeenCalledOnce());
    await new Promise((r) => setTimeout(r, 10));
    expect(mountHomeView).not.toHaveBeenCalled();
    expect(mountDemo).toHaveBeenCalledWith(content, expect.objectContaining({ seed: "RECENT" }));
  });
});
