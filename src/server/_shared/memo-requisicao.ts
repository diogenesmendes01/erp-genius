import * as React from "react";

function cacheDoReact(): (<F extends (...args: never[]) => unknown>(f: F) => F) | undefined {
  try {
    const c = (React as { cache?: unknown }).cache;
    return typeof c === "function" ? (c as <F extends (...args: never[]) => unknown>(f: F) => F) : undefined;
  } catch {
    return undefined;
  }
}

const cache = cacheDoReact();

export const memoPorRequisicao: <F extends (...args: never[]) => unknown>(f: F) => F = cache ?? ((f) => f);

export function congelar<T>(valor: T): T {
  if (valor && typeof valor === "object" && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const v of Object.values(valor as Record<string, unknown>)) congelar(v);
  }
  return valor;
}
