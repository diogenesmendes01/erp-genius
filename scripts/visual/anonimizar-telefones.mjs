/** Callback autocontido para page.evaluate, após todas as interações e antes da foto.
 * Altera somente o DOM de captura; nunca o arquivo de referência ou os pixels.
 * O relatório não contém os números originais. Não monitora renderizações futuras:
 * quem interagir novamente precisa reaplicar antes de fotografar.
 */
export function anonimizarTelefonesNoDom() {
  let substituicoes = 0;
  const substituir = (texto) => texto.replace(/\+55(?:[\s().-]*\d){10,11}(?![\s().-]*\d)/g, (telefone) => {
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.startsWith("5500")) return telefone;
    let hash = 2166136261;
    for (const digito of digitos) hash = Math.imul(hash ^ digito.charCodeAt(0), 16777619);
    substituicoes++;
    return `+5500${((hash >>> 0) % 1_000_000_000).toString().padStart(9, "0")}`;
  });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const no = walker.currentNode;
    if (no.parentElement?.closest("script, style, noscript, template")) continue;
    no.textContent = substituir(no.textContent ?? "");
  }
  for (const elemento of document.body.querySelectorAll("*")) {
    for (const atributo of ["title", "aria-label", "placeholder", "alt", "value", "href"]) {
      const valor = elemento.getAttribute(atributo);
      if (valor === null || (atributo === "href" && !valor.startsWith("tel:"))) continue;
      const novo = substituir(valor);
      if (novo !== valor) elemento.setAttribute(atributo, novo);
    }
    if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) {
      const novo = substituir(elemento.value);
      if (novo !== elemento.value) elemento.value = novo;
    }
  }
  return {
    politica: "telefones +55 do DOM anonimizados antes da captura; HTML original intacto",
    versao: 1,
    substituicoes,
  };
}
