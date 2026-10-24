import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const referencia = (nome) => path.join(raiz, "docs", "planejamento", "inbox-prototipo", "telas", nome);

export const TAMANHOS = Object.freeze({ desktop: [1440, 900], tablet: [1024, 768], celular: [390, 844] });
export const TEMAS = Object.freeze(["escuro", "claro"]);
export const ESTADOS = Object.freeze({
  carregando: { tamanhos: ["desktop", "tablet", "celular"], prototipo: false, motivoSemReferencia: "Fallback real da página não é desenhado no protótipo." },
  "painel-erro": { tamanhos: ["desktop", "tablet", "celular"], prototipo: false, motivoSemReferencia: "Falha de transporte do painel não é desenhada no protótipo." },
  "thread-erro": { tamanhos: ["desktop", "tablet", "celular"], prototipo: false, motivoSemReferencia: "Falha de transporte da thread não é desenhada no protótipo." },
  "painel-vazio": { tamanhos: ["desktop", "tablet", "celular"], prototipo: false, motivoSemReferencia: "Ausência legítima autorizada de oportunidade não tem comportamento equivalente no protótipo." },
  nota: { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-estado-nota-interna.png") },
  "busca-conversa": { tamanhos: ["desktop", "tablet", "celular"], prototipo: false },
  conversa: { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-escuro-admin-desktop.png") },
  "menu-mais": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-estado-menu-mais.png") },
  "painel-sem-nome": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true },
  "painel-secretaria": { tamanhos: ["desktop", "tablet", "celular"], prototipo: false, motivoSemReferencia: "Navegação real da Secretaria para matrícula não existe no protótipo." },
  "painel-detalhes": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-estado-painel-detalhes.png") },
  "painel-fechado": { tamanhos: ["desktop"], prototipo: true },
  "sem-selecao": { tamanhos: ["desktop", "tablet", "celular"], prototipo: false, motivoSemReferencia: "Sem seleção E1 não tem referência funcional equivalente no protótipo." },
  "humano-compositor": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-claro-admin-desktop-humano-compositor.png") },
  filtros: { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-estado-filtros.png") },
  "seletor-numero": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true },
  "nova-conversa": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true, referencia: referencia("prototipo-estado-nova-conversa.png") },
  "lista-vazia": { tamanhos: ["desktop", "tablet", "celular"], prototipo: true },
  "celular-lista": { tamanhos: ["celular"], prototipo: true },
  "celular-painel": { tamanhos: ["celular"], prototipo: true },
  "celular-conversa": { tamanhos: ["celular"], prototipo: true, referencia: referencia("prototipo-claro-admin-celular-conversa.png") },
  "tablet-painel": { tamanhos: ["tablet"], prototipo: true },
});

export function nomeDaCaptura(alvo, tema, tamanho, estado) {
  return `${alvo}-${tema}-${tamanho}-${estado}.png`;
}

export function caminhoNoNpm(url, nodeModules) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "unpkg.com" || parsed.port || parsed.hash) throw new Error("Recurso npm não autorizado.");
  const partes = decodeURIComponent(parsed.pathname).split("/").filter(Boolean);
  const escopo = partes[0]?.startsWith("@") ?? false;
  const indiceVersao = escopo ? 1 : 0;
  const versao = partes[indiceVersao]?.match(/^([^/@]+)@[^/@]+$/);
  if (!versao || partes.length <= indiceVersao + 1 || partes.some((parte) => parte === "." || parte === ".." || parte.includes("\\") || parte.includes("/"))) throw new Error("Caminho npm inválido.");
  const pacote = escopo ? [partes[0], versao[1]] : [versao[1]];
  return path.join(nodeModules, ...pacote, ...partes.slice(indiceVersao + 1));
}

export function tipoDoArquivo(caminho) {
  switch (path.extname(caminho).toLowerCase()) {
    case ".css": return "text/css";
    case ".js": case ".mjs": return "application/javascript";
    case ".woff2": return "font/woff2";
    case ".woff": return "font/woff";
    case ".ttf": return "font/ttf";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

/** Só o GET da thread cancelado e substituído por outro GET íntegro vira diagnóstico. */
export function cancelamentoDeMensagensRecuperado(pedido, concluidos, base, conteudoCarregado) {
  if (!conteudoCarregado || pedido.method !== "GET" || pedido.erro !== "net::ERR_ABORTED") return false;
  try {
    const url = new URL(pedido.url);
    return url.origin === base && /^\/api\/inbox\/atendimentos\/[^/]+\/mensagens$/.test(url.pathname)
      && concluidos.has(`GET ${pedido.url}`);
  } catch { return false; }
}

export function combinacoes({ alvos, estados }) {
  const resultado = [];
  for (const alvo of alvos) for (const estado of estados) {
    const definido = ESTADOS[estado];
    if (!definido) throw new Error(`Estado visual desconhecido: ${estado}`);
    if (alvo === "prototipo" && !definido.prototipo) continue;
    if (alvo !== "app" && alvo !== "prototipo") throw new Error(`Alvo visual desconhecido: ${alvo}`);
    for (const tema of TEMAS) for (const tamanho of definido.tamanhos) resultado.push({ alvo, tema, tamanho, estado });
  }
  return resultado;
}

/** Falhas React visíveis no console também invalidam a casca, mesmo sem pageerror. */
export function problemaReactNaCaptura(texto) {
  return /hydration|hydrating|hydrated|did not match|didn't match|Each child in a list should have a unique|two children with the same key/i.test(texto);
}
