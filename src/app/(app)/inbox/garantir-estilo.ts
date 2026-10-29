type JanelaMinima = {
  getComputedStyle?: typeof getComputedStyle;
  HTMLInputElement?: { prototype: object };
  HTMLFormElement?: unknown;
  clearTimeout?: typeof clearTimeout;
  setTimeout?: typeof setTimeout;
  requestAnimationFrame?: typeof requestAnimationFrame;
  cancelAnimationFrame?: typeof cancelAnimationFrame;
};

export function garantirEstilo() {
  const alvo = globalThis as JanelaMinima & {
    HTMLFormElement?: typeof HTMLFormElement;
    HTMLInputElement?: { prototype: object };
    window?: JanelaMinima;
  };
  if (typeof alvo.getComputedStyle !== "function") {
    alvo.getComputedStyle = (() => ({ getPropertyValue: () => "", animationName: "" })) as unknown as typeof getComputedStyle;
  }
  if (typeof alvo.HTMLFormElement !== "function") {
    alvo.HTMLFormElement = class HTMLFormElement {} as unknown as typeof HTMLFormElement;
  }
  const descritor = alvo.HTMLInputElement ? Object.getOwnPropertyDescriptor(alvo.HTMLInputElement.prototype, "checked") : undefined;
  if (!descritor) {
    const Entrada = class HTMLInputElement {};
    Object.defineProperty(Entrada.prototype, "checked", { configurable: true, get() { return false; } });
    alvo.HTMLInputElement = Entrada;
  }
  if (typeof alvo.requestAnimationFrame !== "function") {
    alvo.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as unknown as typeof requestAnimationFrame;
    alvo.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  const janela = alvo.window;
  if (!janela) return;
  if (typeof janela.getComputedStyle !== "function") janela.getComputedStyle = alvo.getComputedStyle;
  if (janela.HTMLInputElement !== alvo.HTMLInputElement) janela.HTMLInputElement = alvo.HTMLInputElement;
  if (!janela.HTMLFormElement) janela.HTMLFormElement = alvo.HTMLFormElement;
  if (typeof janela.clearTimeout !== "function") janela.clearTimeout = clearTimeout.bind(globalThis);
  if (typeof janela.setTimeout !== "function") janela.setTimeout = setTimeout.bind(globalThis);
  if (typeof janela.requestAnimationFrame !== "function") janela.requestAnimationFrame = alvo.requestAnimationFrame;
  if (typeof janela.cancelAnimationFrame !== "function") janela.cancelAnimationFrame = alvo.cancelAnimationFrame;
}
