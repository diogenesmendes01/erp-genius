import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
const novos = ["painel-detalhes-pessoa", "painel-detalhes-b2b", "painel-detalhes-convidado"];
const m = vi.hoisted(() => ({ auth: vi.fn(async () => {}), hidratar: vi.fn(async () => {}) }));
vi.mock("../../scripts/visual/espera-app.mjs", async original => ({ ...await original<object>(), autenticarApp: m.auth, esperarHidratacaoApp: m.hidratar }));
import { abrirApp } from "../../scripts/visual/capturar-inbox.mjs";
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function modulo() { const p = "../../scripts/visual/" + "detalhes-inbox.mjs"; const x = await import(p).catch(() => null); expect(x, "produtor de cenários325 ausente").not.toBeNull(); return x!; }
it("325 acrescenta30 fotos e preserva exatamente as190 combinações/IDs herdadas", () => {
  const novas = combinacoes({ alvos: ["app", "prototipo"], estados: novos });
  expect(novas).toHaveLength(30); expect(novas.filter(x => x.alvo === "prototipo")).toHaveLength(12);
  expect(ESTADOS[novos[1]].prototipo).toBe(true); expect(ESTADOS[novos[2]].motivoSemReferencia).toMatch(/autorização|convite/i);
  const antigas = combinacoes({ alvos: ["app", "prototipo"], estados: Object.keys(ESTADOS).filter(x => !novos.includes(x)) });
  expect(antigas).toHaveLength(190);
  expect(createHash("sha256").update(JSON.stringify(antigas)).digest("hex")).toBe("c669324e360cf097784814ae7750dc2d54becb933b4d8f0ea27b416b236c1ea4");
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: Object.keys(ESTADOS) })).toHaveLength(220);
});
it("configuração325 exige ID explícito e não usa a canônica ou credencial padrão", async () => {
  const x = await modulo();
  expect(x.configurarDetalhes325("painel-detalhes-pessoa", { INBOX_VISUAL_325_PESSOA: "a?x&b" })).toMatchObject({ id: "a?x&b", modo: "pessoa" });
  expect(x.configurarDetalhes325("painel-detalhes-b2b", { INBOX_VISUAL_325_B2B: "pj" })).toMatchObject({ id: "pj", modo: "b2b" });
  for (const estado of novos) expect(() => x.configurarDetalhes325(estado, {})).toThrow();
  expect(() => x.configurarDetalhes325("painel-detalhes", { INBOX_VISUAL_325_PESSOA: "a" })).toThrow();
  await expect(abrirApp({} as never, {} as never, "http://localhost:3111", {} as never, "painel-detalhes-pessoa", "desktop")).rejects.toThrow(/credenciais|ID/i);
  vi.stubEnv("INBOX_VISUAL_325_PESSOA", "a325");
  await expect(abrirApp({} as never, {} as never, "http://localhost:3111", {} as never, "painel-detalhes-pessoa", "desktop")).rejects.toThrow(/credenciais/i);
  expect(m.auth).not.toHaveBeenCalled();
});
const cabecalho = { pessoaId: "p1", subtitulo: "Pessoa física · Espanhol", quadrado: false, capacidades: { verContato: true, verEmpresa: true, editarContato: true } };
const pessoa = { id: "p1", nome: "Mariana325", email: "pessoa325@example.test", cidade: "Santiago", telefone: "+5500000000325", origemCanal: "INDICACAO", empresa: null };
const detalhe = { pessoa, oportunidade: { id: "op325", produto: "Espanhol", titulo: "Mariana325", valor: "650.00", moeda: "CLP", etapa: "PROPOSTA", b2b: false }, b2b: null, campos: [{ nome: "Objetivo reservado325", valor: "Trabalho", ia: true }] };
const painel = { setor: "COMERCIAL", podeEnviar: false, cabecalho };
const respostas = (p = painel, d: object = detalhe, status = 200) => ({ request: { get: async (url: string) => ({ status: () => status, json: async () => url.endsWith("/painel/detalhes") ? d : p }) } });
it("preflight325 lê dois GETs reais codificados, valida contexto e descreve valores sem response bruto", async () => {
  const x = await modulo(); const urls: string[] = [];
  const c = respostas(); const get = c.request.get; c.request.get = async u => { urls.push(u); return get(u); };
  const r = await x.confirmarDetalhes325(c, "http://localhost:3111", { id: "a?x&b", modo: "pessoa" });
  expect(urls).toEqual(["http://localhost:3111/api/inbox/atendimentos/a%3Fx%26b/painel", "http://localhost:3111/api/inbox/atendimentos/a%3Fx%26b/painel/detalhes"]);
  expect(r).toMatchObject({ modo: "pessoa", nomeCabecalho: "Mariana325", subtitulo: "Pessoa física · Espanhol", fichaHref: "/contatos?c=p1", empresaHref: null });
  expect(r.textos).toEqual(expect.arrayContaining(["pessoa325@example.test", "Santiago", "Espanhol", "Trabalho"]));
  expect(r).not.toHaveProperty("resposta"); expect(r).not.toHaveProperty("headers");
});
it.each([404, 500])("preflight325 reprova HTTP%s sem fabricar vazio legítimo", async status => {
  const x = await modulo(); await expect(x.confirmarDetalhes325(respostas(painel, detalhe, status), "http://localhost:3111", { id: "a", modo: "pessoa" })).rejects.toThrow(/HTTP/);
});
it("preflight325 reprova modo falso, Pessoa ausente e direitos indevidos no convidado", async () => {
  const x = await modulo();
  for (const d of [{ ...detalhe, pessoa: null }, { ...detalhe, oportunidade: null }, { ...detalhe, b2b: { empresa: { id: "e" } } }]) await expect(x.confirmarDetalhes325(respostas(painel, d), "http://localhost:3111", { id: "a", modo: "pessoa" })).rejects.toThrow();
  await expect(x.confirmarDetalhes325(respostas(), "http://localhost:3111", { id: "a", modo: "convidado", campoRestrito: "Objetivo reservado325" })).rejects.toThrow();
});
it("CLI325 faz preflight antes da navegação, abre painel e espera corpo iniciado sem exigir mensagem canônica", async () => {
  vi.stubEnv("INBOX_VISUAL_325_PESSOA", "p325"); vi.stubEnv("INBOX_VISUAL_EMAIL", "ficticio@example.test"); vi.stubEnv("INBOX_VISUAL_SENHA", "segredo-ficticio-de-teste");
  const ordem: string[] = []; const c = respostas(); const get = c.request.get; c.request.get = async u => { ordem.push("GET"); return get(u); };
  const pagina = Object.assign(new EventEmitter(), { goto: vi.fn(async () => { ordem.push("goto"); }), locator: () => ({ isVisible: async () => false }), getByRole: () => ({ click: async () => { ordem.push("abrir"); } }), waitForFunction: vi.fn(async () => { ordem.push("pronto"); }) });
  const r = await abrirApp(pagina as never, c as never, "http://localhost:3111", {} as never, novos[0], "celular");
  expect(pagina.goto).toHaveBeenCalledWith("http://localhost:3111/inbox?c=p325", { waitUntil: "domcontentloaded" });
  expect(ordem).toEqual(["GET", "GET", "goto", "abrir", "pronto"]); expect(m.hidratar).toHaveBeenCalledOnce();
  expect(r.metadados).toMatchObject({ detalhes325: { modo: "pessoa", nomeCabecalho: "Mariana325" } });
});
it("preflight B2B preserva documento nãoBR, links autorizados e D13 sem dados/capacidades globais", async () => {
  const x = await modulo();
  const empresa = { id: "e325", nome: "Ventura Chile325", documento: "76.086.428-5", segmentoMercado: "Logística", porte: "Médio", site: "https://ventura.example.test" };
  const b2b = { empresa: { id: empresa.id, nome: empresa.nome }, decisor: true, participantes: [{ pessoaId: "p1", nome: "Ana325", naConversa: true, hrefConversa: "/inbox?c=atual" }, { pessoaId: "p2", nome: "Bia325", naConversa: false, hrefConversa: "/inbox?c=permitido" }, { pessoaId: "p3", nome: "Caio325", naConversa: false, hrefConversa: null }] };
  const d = { ...detalhe, pessoa: { ...pessoa, nome: "Ana325", cargo: "RH", empresa }, oportunidade: { ...detalhe.oportunidade, b2b: true }, b2b, campos: [] };
  const p = { ...painel, cabecalho: { ...cabecalho, subtitulo: "Falando com Ana325 · Decisor", quadrado: true, capacidades: { verContato: false, verEmpresa: false, editarContato: false } } };
  const r = await x.confirmarDetalhes325(respostas(p as typeof painel, d), "http://localhost:3111", { id: "a", modo: "convidado", campoRestrito: "Objetivo reservado325" });
  expect(r).toMatchObject({ nomeCabecalho: "Ventura Chile325", quadrado: true, fichaHref: null, empresaHref: null, campoRestrito: "Objetivo reservado325", oportunidadeHref: "/funil?o=op325" });
  expect(r.textos).toEqual(expect.arrayContaining(["Documento da empresa", "76.086.428-5"]));
  expect(r.participantes).toEqual(b2b.participantes);
  const ruim = { ...d, b2b: { ...b2b, participantes: b2b.participantes.map(p => ({ ...p, hrefConversa: "https://fora.example.test" })) } };
  await expect(x.confirmarDetalhes325(respostas(p as typeof painel, ruim), "http://localhost:3111", { id: "a", modo: "convidado", campoRestrito: "Objetivo reservado325" })).rejects.toThrow(/Destino/);
});
it("prontidão325 rejeita cartão errado, alvo extra, conteúdo incompleto, campo restrito e overflow", async () => {
  const x = await modulo();
  const esperado = { modo: "convidado", nomeCabecalho: "Ventura Chile325", subtitulo: "Falando com Ana325 · Decisor", quadrado: true, textos: ["ana325@example.test", "Documento da empresa", "76.086.428-5"], fichaHref: null, empresaHref: null, oportunidadeHref: "/funil?o=op325", participantes: [{ nome: "Ana325", naConversa: true, hrefConversa: "/inbox?c=atual" }, { nome: "Bia325", naConversa: false, hrefConversa: "/inbox?c=permitido" }, { nome: "Caio325", naConversa: false, hrefConversa: null }], campoRestrito: "Objetivo reservado325", marcaCampoAria: false };
  let href = "/funil?o=op325", extra = false, nome = esperado.nomeCabecalho, largura = 320, corpoTexto = "Oportunidade atual ana325@example.test Documento da empresa 76.086.428-5 Ana325 Bia325 Caio325 Na conversa";
  const link = (texto: string, destino: string) => ({ textContent: texto, getAttribute: () => destino });
  const corpo = { get textContent() { return corpoTexto; }, querySelector: () => null, querySelectorAll: () => [link("Oportunidade atual", href), link("Falar com", "/inbox?c=permitido"), ...(extra ? [link("Falar com", "/inbox?c=negado")] : [])] };
  const header = { querySelector: (s: string) => s === "h2" ? { get textContent() { return nome; } } : s === ':scope > p' ? { textContent: esperado.subtitulo } : s === ':scope > span' ? { getBoundingClientRect: () => ({ width: 132, height: 132 }), getAttribute: () => "rounded-[34px]" } : null };
  const painelDOM = { inert: false, closest: () => null, getAnimations: () => [], getBoundingClientRect: () => ({ width: 320, height: 500, left: 0, right: 320, top: 0, bottom: 500 }), querySelector: (s: string) => s === '[data-cabecalho-contato]' ? header : s === '[role="tabpanel"]' ? corpo : null, querySelectorAll: () => [{ textContent: "Detalhes", getAttribute: () => "true" }] };
  vi.stubGlobal("window", { innerWidth: 320, innerHeight: 500 }); vi.stubGlobal("document", { documentElement: { get scrollWidth() { return largura; } }, querySelectorAll: () => [painelDOM] });
  expect(x.semanticaDetalhes325Pronto(esperado)).toBe(true);
  href = "/funil?o=outro"; expect(x.semanticaDetalhes325Pronto(esperado)).toBe(false); href = esperado.oportunidadeHref;
  extra = true; expect(x.semanticaDetalhes325Pronto(esperado)).toBe(false); extra = false;
  nome = "Ana325"; expect(x.semanticaDetalhes325Pronto(esperado)).toBe(false); nome = esperado.nomeCabecalho;
  corpoTexto += " Objetivo reservado325"; expect(x.semanticaDetalhes325Pronto(esperado)).toBe(false); corpoTexto = corpoTexto.replace(" Objetivo reservado325", "");
  corpoTexto = corpoTexto.replace("76.086.428-5", ""); expect(x.semanticaDetalhes325Pronto(esperado)).toBe(false); corpoTexto += "76.086.428-5";
  largura = 442; expect(x.semanticaDetalhes325Pronto(esperado)).toBe(false);
});
it("protótipo B2B abre a referência original c2 e convidado não fabrica comparação", async () => {
  const x = await modulo(); const textos: string[] = [];
  const alvo = { isVisible: async () => true, waitFor: async () => {}, first() { return this; }, click: async () => {} };
  const painelProto = { ...alvo, getByText: (s: string) => { textos.push(s); return alvo; } };
  const root = { ...alvo, locator: (s: string) => s === '[data-m="panel"]' ? painelProto : alvo };
  const pagina = { goto: vi.fn(async () => {}), locator: () => root };
  await x.abrirPrototipoDetalhes325(pagina, "file:///referencia/Inbox.dc.html", "painel-detalhes-b2b");
  expect(pagina.goto).toHaveBeenCalledWith("file:///referencia/Inbox.dc.html?c=c2", { waitUntil: "load" });
  expect(textos).toEqual(["Grupo Ventura Logística", "Oportunidade atual", "Contatos nesta oportunidade", "Detalhes"]);
  await expect(x.abrirPrototipoDetalhes325(pagina, "file:///referencia/Inbox.dc.html", "painel-detalhes-convidado")).rejects.toThrow(/referência/);
});
it("espera comercial legada aguarda cartão325 e mantém o callback estrito318/324", async () => {
  const { esperarConteudoApp, semanticaPainelDetalhesPronto } = await import("../../scripts/visual/espera-app.mjs");
  const seletor = vi.fn(() => ({ waitFor: async () => {} }));
  const pagina = { locator: seletor, getByRole: () => { throw Error("Painel Comercial legado foi substituído"); }, waitForFunction: vi.fn(async () => {}) };
  await esperarConteudoApp(pagina as never, "painel-detalhes", "celular");
  expect(seletor).toHaveBeenCalledWith('#painel-contato a[href^="/funil?o="]');
  expect(pagina.waitForFunction).toHaveBeenCalledWith(semanticaPainelDetalhesPronto);
});
it("hash do corpo325 é canônico, determinístico e distingue conteúdo diferente", async () => {
  const x = await modulo(); expect(x.hashCorpoDetalhes325).toBeTypeOf("function");
  const a = x.hashCorpoDetalhes325({ pessoa: { nome: "Ana" }, campos: [] });
  expect(a).toBe("d3c6ec04c958e8823e0c3c4cb33f7fd7bd9cc48bf9ca58b448bdc290ff5b2e14"); expect(x.hashCorpoDetalhes325({ campos: [], pessoa: { nome: "Ana" } })).toBe(a);
  expect(x.hashCorpoDetalhes325({ campos: [], pessoa: { nome: "Bia" } })).not.toBe(a);
});
const base325 = "http://localhost:3111", id325 = "a?x";
const url325 = base325 + "/api/inbox/atendimentos/a%3Fx/painel/detalhes";
const pedido325 = { ordem: 35, method: "GET", url: url325, erro: "net::ERR_ABORTED", contextoId: "contexto1", paginaId: "pagina1", atendimentoId: id325 };
const substituto325 = { ordem: 38, method: "GET", url: url325, status: 200, headersObservados: true, corpoConcluido: true, corpoSha256: "a".repeat(64), contextoId: "contexto1", paginaId: "pagina1", atendimentoId: id325 };
const prova325 = { base: base325, atendimentoId: id325, atendimentoAtualId: id325, contextoId: "contexto1", paginaId: "pagina1", corpoEsperadoSha256: "a".repeat(64), paginaAtiva: true, semanticaFinal: true };
it("abortoDetalhes só vira diagnóstico com GET posterior íntegro da mesma página/contexto/ID e DOM final", async () => {
  const x = await modulo(); expect(x.cancelamentoDetalhes325Recuperado).toBeTypeOf("function");
  expect(x.cancelamentoDetalhes325Recuperado(pedido325, [substituto325], prova325)).toBe(true);
  expect(x.cancelamentoDetalhes325Recuperado(pedido325, [], prova325)).toBe(false);
  // A ordem é a do START: o evento abortado pode chegar depois dos headers/fim do substituto.
  expect(x.cancelamentoDetalhes325Recuperado({ ...pedido325, eventoFalha: 99 }, [{ ...substituto325, eventoHeaders: 40, eventoFim: 41 }], prova325)).toBe(true);
});
it.each([
  ["200 sem fim", {}, { corpoConcluido: false }, {}],
  ["sem headers", {}, { headersObservados: false }, {}],
  ["body diferente", {}, { corpoSha256: "b".repeat(64) }, {}],
  ["body inválido", {}, { corpoSha256: null }, {}],
  ["erro HTTP", {}, { status: 500 }, {}],
  ["mesma ordem", {}, { ordem: 35 }, {}],
  ["ordem anterior", {}, { ordem: 34 }, {}],
  ["sem START", { ordem: undefined }, {}, {}],
  ["ID diferente", {}, { atendimentoId: "outra" }, {}],
  ["URL diferente", {}, { url: base325 + "/api/inbox/atendimentos/outra/painel/detalhes" }, {}],
  ["query", { url: url325 + "?x=1" }, { url: url325 + "?x=1" }, {}],
  ["outra origem", {}, { url: url325.replace("localhost", "127.0.0.1") }, {}],
  ["POST", { method: "POST" }, { method: "POST" }, {}],
  ["SSE", { url: base325 + "/api/inbox/eventos" }, { url: base325 + "/api/inbox/eventos" }, {}],
  ["outro contexto", {}, { contextoId: "contexto2" }, {}],
  ["outra página", {}, { paginaId: "pagina2" }, {}],
  ["desmontada", {}, {}, { paginaAtiva: false }],
  ["troca intencional", {}, {}, { atendimentoAtualId: "outra" }],
  ["DOM incorreto", {}, {}, { semanticaFinal: false }],
  ["falha sem recuperação", { erro: "net::ERR_CONNECTION_RESET" }, {}, {}],
  ["sem hash esperado", {}, {}, { corpoEsperadoSha256: null }],
])("recuperação325 rejeita %s", async (_nome, pedido, substituto, prova) => {
  const x = await modulo(); expect(x.cancelamentoDetalhes325Recuperado).toBeTypeOf("function");
  expect(x.cancelamentoDetalhes325Recuperado({ ...pedido325, ...pedido }, [{ ...substituto325, ...substituto }], { ...prova325, ...prova })).toBe(false);
});
