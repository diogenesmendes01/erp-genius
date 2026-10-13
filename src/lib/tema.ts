// Tema claro/escuro do shell (C21 da #170). Uma fonte só: a classe `dark` do <html>, aplicada antes do
// paint pelo script do layout (src/app/layout.tsx, chave "tema" do localStorage). Antes, cada
// ThemeToggle (Sidebar e BarraMobile) guardava o próprio useState lido uma vez no efeito: trocar o
// tema no celular e girar a tela deixava o ícone da Sidebar desatualizado. Agora os dois leem a classe
// por useSyncExternalStore, e a troca avisa todos os inscritos.

/** Chave do localStorage — a mesma que o script do layout lê antes do paint. */
export const CHAVE_TEMA = "tema";

const inscritos = new Set<() => void>();

/** O tema escuro está aplicado? (a classe `dark` do <html> é a verdade) */
export function temaEscuroAplicado(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** No servidor não há <html> para ler: o HTML sai claro, e a hidratação corrige pelo valor do cliente. */
export function temaEscuroNoServidor(): boolean {
  return false;
}

/** Inscrição para useSyncExternalStore: devolve o cancelamento. */
export function acompanharTema(aoMudar: () => void): () => void {
  inscritos.add(aoMudar);
  return () => {
    inscritos.delete(aoMudar);
  };
}

/** Troca o tema, avisa todos os controles inscritos e grava a escolha para o próximo carregamento. */
export function alternarTema(): void {
  const escuro = !temaEscuroAplicado();
  document.documentElement.classList.toggle("dark", escuro);
  for (const aoMudar of [...inscritos]) aoMudar();
  localStorage.setItem(CHAVE_TEMA, escuro ? "dark" : "light");
}
