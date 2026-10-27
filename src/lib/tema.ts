export const CHAVE_TEMA = "tema";

const inscritos = new Set<() => void>();

export function temaEscuroAplicado(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function temaEscuroNoServidor(): boolean {
  return false;
}

export function acompanharTema(aoMudar: () => void): () => void {
  inscritos.add(aoMudar);
  return () => {
    inscritos.delete(aoMudar);
  };
}

export function alternarTema(): void {
  const escuro = !temaEscuroAplicado();
  document.documentElement.classList.toggle("dark", escuro);
  for (const aoMudar of [...inscritos]) aoMudar();
  localStorage.setItem(CHAVE_TEMA, escuro ? "dark" : "light");
}
