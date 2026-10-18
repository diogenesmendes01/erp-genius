// Divisão do texto da base de conhecimento em trechos para a busca textual.
// Acumula parágrafos (separados por linha em branco) até `max`; parágrafo maior que `max`
// é cortado em janelas de `max` com recuo de `sobreposicao` caracteres.

export const EXTENSOES_ACEITAS = [".txt", ".md", ".csv", ".pdf"] as const;

export function dividirEmTrechos(texto: string, max = 1200, sobreposicao = 150): string[] {
  const limite = Math.max(1, Math.floor(max));
  const recuo = Math.min(Math.max(0, Math.floor(sobreposicao)), limite - 1);
  const paragrafos = texto
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const trechos: string[] = [];
  let atual = "";
  const fechar = () => {
    if (atual) trechos.push(atual);
    atual = "";
  };

  for (const p of paragrafos) {
    if (p.length > limite) {
      fechar();
      for (let ini = 0; ; ini += limite - recuo) {
        const fim = Math.min(ini + limite, p.length);
        const janela = p.slice(ini, fim).trim();
        if (janela) trechos.push(janela);
        if (fim >= p.length) break;
      }
      continue;
    }
    const junto = atual ? `${atual}\n\n${p}` : p;
    if (junto.length <= limite) {
      atual = junto;
    } else {
      fechar();
      atual = p;
    }
  }
  fechar();
  return trechos;
}
