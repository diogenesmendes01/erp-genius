import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ErroPermissaoFalso } = vi.hoisted(() => ({ ErroPermissaoFalso: class extends Error {} }));
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), pagina: vi.fn(), item: vi.fn(), opcoes: vi.fn(), triagem: vi.fn(), revisoes: vi.fn(), preferencia: vi.fn(), admin: vi.fn(), contar: vi.fn(), filtro: vi.fn(), resumo:vi.fn(), operacao:vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao, temPapel: mocks.admin, ErroPermissao: ErroPermissaoFalso }));
vi.mock("@/server/inbox/consultas-pagina", () => ({ contarChipsInbox: mocks.contar, listarAtendimentosPagina: mocks.pagina, obterItemListaInbox: mocks.item }));
vi.mock("@/server/inbox/contexto-lista",()=>({criarOperacaoListaInbox:mocks.operacao}));
vi.mock("@/server/inbox/contagens",()=>({resumoDaListaInbox:mocks.resumo}));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ listarOpcoesAtendimento: mocks.opcoes, listarTriagemWhatsApp: mocks.triagem, listarRevisoesEnvio: mocks.revisoes }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/inbox/opcoes-filtro", () => ({ opcoesFiltroInbox: mocks.filtro }));
vi.mock("./InboxNovo", () => ({ InboxNovo: ({ fusoEscola, fuso, filtros, selecionado, inicial, triagem, revisoes, opcoesFiltro, contagens, resumo, sino: sinoRenderizado, opcoesNovaConversa, agoraInicial, podeAbrirFunil, podeCriarOportunidade }: { fusoEscola?: string; podeAbrirFunil?: boolean; podeCriarOportunidade?: boolean; agoraInicial?: number; sino?: import("react").ReactNode; opcoesNovaConversa?: unknown; contagens?: unknown; resumo?:unknown; opcoesFiltro?: { setores: string[]; numeros: { id: string }[] }; fuso: string | null; filtros: object; selecionado: string | null; triagem: unknown[] | null; revisoes: unknown[] | null; inicial: { proximo: string | null; itens: { id: string }[] } }) => `fusoEscola:${fusoEscola}|funil:${podeAbrirFunil}|criar329:${podeCriarOportunidade}|agora:${agoraInicial}|nova:${opcoesNovaConversa ? "sim" : "nao"}|${renderToStaticMarkup(createElement("span", null, sinoRenderizado))}|inbox:${fuso}|tri:${triagem === null ? "nao" : triagem.length}|rev:${revisoes === null ? "nao" : revisoes.length}|filtros:${JSON.stringify(filtros)}|sel:${selecionado}|prox:${inicial.proximo}|setores:${opcoesFiltro?.setores}|numeros:${opcoesFiltro?.numeros.map((n) => n.id)}|itens:${inicial.itens.map((i) => i.id)}|contagens:${JSON.stringify(contagens)}|resumo:${JSON.stringify(resumo)}` }));
const sino = vi.hoisted(() => ({ listar: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/crm/notificacoes", () => ({ listarNotificacoes: sino.listar }));
vi.mock("@/server/relatorios/atendimento", () => ({ fusoDaEscola: sino.fuso }));
vi.mock("../tarefas/SinoNotificacoes", () => ({ SinoNotificacoes: ({ notificacoes, fusoExibicao, fusoEscola }: { notificacoes: { titulo: string }[]; fusoExibicao: string; fusoEscola: string }) => `Notificações:${notificacoes.map((n) => n.titulo)}|${fusoExibicao}|${fusoEscola}` }));

import Page from "./page";
const operacao={id:"op-ssr"};
const resumo={contagens:{todas:100,ia:9,aprovacao:8,handoff:7,humano:6,semResposta:5,naoAtribuidas:4},aria:{estado:"ATIVA",pausada:false,podeGerenciar:false}};
beforeEach(()=>{vi.clearAllMocks();mocks.operacao.mockReturnValue(operacao);mocks.resumo.mockResolvedValue(resumo);});

it("entrega agregados autorizados pelo usuário/filtros sem depender de paginação ou deep link", async () => {
  sino.listar.mockResolvedValue([]); sino.fuso.mockResolvedValue("America/Sao_Paulo"); mocks.sessao.mockResolvedValue({ id: "u", papeis: ["FINANCEIRO"] });
  mocks.preferencia.mockResolvedValue({ ok: false });
  mocks.admin.mockReturnValue(false); mocks.triagem.mockResolvedValue([]); mocks.opcoes.mockResolvedValue({ destinos: [], numeros: [] });
  mocks.pagina.mockResolvedValue({ itens: [], proximo: null }); mocks.filtro.mockResolvedValue({ setores: [], numeros: [] });
  const contagens = { todas: 99, minhas: 8, naoLidas: 7, prazo: 6, fila: 5 }; mocks.contar.mockResolvedValue(contagens);
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "Ana", responsavel: "eu" }) }));
  expect(mocks.contar).toHaveBeenCalledWith({ id: "u", papeis: ["FINANCEIRO"] }, { busca: "Ana", responsavel: "eu" },{operacao});
  expect(html).toContain(`contagens:${JSON.stringify(contagens).replaceAll('"', '&quot;')}`);
  expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.contar.mock.invocationCallOrder.at(-1)!);
});

const cursorValido = Buffer.from(JSON.stringify({ em: "2026-10-01T00:00:00.000Z", id: "x" })).toString("base64url");

describe("InboxPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
    mocks.operacao.mockReturnValue(operacao);mocks.resumo.mockResolvedValue(resumo);mocks.admin.mockReturnValue(false); mocks.contar.mockResolvedValue({ todas: 8, minhas: 2, naoLidas: 1, prazo: 3, fila: 4 });
    mocks.triagem.mockResolvedValue([]); mocks.revisoes.mockResolvedValue([]);
    mocks.pagina.mockResolvedValue({ itens: [], proximo: null }); mocks.opcoes.mockResolvedValue({ destinos: [], numeros: [] });
    mocks.filtro.mockResolvedValue({ setores: ["SECRETARIA"], numeros: [{ id: "n1", rotulo: "Secretaria" }] });
    sino.listar.mockResolvedValue([]); sino.fuso.mockResolvedValue("America/Sao_Paulo");
  });

  it("serializa um agoraInicial para SSR e hidratação, capturado na página", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    const T = Date.UTC(2026, 9, 22, 12);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(T);
      const elemento = await Page({ searchParams: Promise.resolve({}) });
      vi.setSystemTime(T + 60_000);
      expect(renderToStaticMarkup(elemento)).toContain("agora:" + T);
    } finally { vi.useRealTimers(); }
  });

  it("casca anula padding do main e passa sino/Novo sem removê-los", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    const raiz = h.match(/^<div class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(raiz).toEqual(expect.arrayContaining(["-m-4", "md:-m-8", "flex", "flex-col", "min-h-0", "md:h-dvh", "h-[calc(100dvh-3.5625rem)]", "sm:h-[calc(100dvh-3.3125rem)]"]));
    expect(h).not.toContain("<h1"); expect(h).not.toContain("novo-atendimento");
    expect(h).toContain("nova:sim"); expect(h).toContain("Notificações:");
  });

  it("a conta de altura acompanha padding do main e as duas alturas reais da barra mobile", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    const main = layout.match(/<main\b[^>]*className="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(main).toEqual(expect.arrayContaining(["p-4", "md:p-8"]));
    const barra = readFileSync("src/components/BarraMobile.tsx", "utf8");
    const header = barra.match(/<header\b[^>]*className="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(header).toEqual(expect.arrayContaining(["py-1.5", "border-b", "md:hidden"]));
    const botao = barra.match(/const botao = "([^"]*)"/)?.[1].split(" ") ?? [];
    expect(botao).toEqual(expect.arrayContaining(["min-h-10", "max-sm:min-h-11"]));
  });

  it("inbox_mostra_o_sino", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    sino.listar.mockResolvedValue([{ id: "n1", titulo: "Prazo estourado: Maria (Comercial)" }]);
    const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(h).toContain("Notificações:Prazo estourado: Maria (Comercial)|America/Sao_Paulo|America/Sao_Paulo");
    expect(sino.listar).toHaveBeenCalledWith({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
  });

  it("entrega ao InboxNovo os setores e números dos filtros da coluna, consultados com o usuário da sessão", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(h).toContain("setores:SECRETARIA|numeros:n1");
    expect(mocks.filtro).toHaveBeenCalledWith({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
  });

  it("encaminha a preferência somente depois da guarda", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "atendimento" }) }))).toContain("inbox:America/Costa_Rica");
    expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.preferencia.mock.invocationCallOrder[0]!);
  });

  it("triagem vai a quem a consulta aceita (administrador ou responsável do número); a revisão de envio só ao administrador", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.triagem.mockResolvedValue([{ id: "m1" }]);
    mocks.revisoes.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
    const resp = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(resp).toContain("tri:1|rev:nao");
    expect(mocks.revisoes).not.toHaveBeenCalled();
    mocks.admin.mockReturnValue(true);
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("tri:1|rev:2");
  });

  it("quem a triagem recusa (ErroPermissao) abre o inbox sem o painel; outro erro propaga", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.triagem.mockRejectedValue(new ErroPermissaoFalso("restrito"));
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("tri:nao|rev:nao");
    mocks.triagem.mockRejectedValue(new Error("banco fora"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("banco fora");
  });

  it("sem preferência válida, o fuso da escola (antes era UTC: a hora da lista e do balão saía errada no Brasil)", async () => {
    sino.fuso.mockResolvedValue("America/Costa_Rica");
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "preferência indisponível" });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("inbox:America/Costa_Rica");
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("inbox:America/Costa_Rica");
  });

  it("não lê preferência nem lista se a guarda falhar", async () => {
    mocks.sessao.mockRejectedValue(new Error("negado"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.pagina).not.toHaveBeenCalled(); expect(mocks.contar).not.toHaveBeenCalled();expect(mocks.operacao).not.toHaveBeenCalled();expect(mocks.resumo).not.toHaveBeenCalled();
  });

  it("filtros e conversa da URL vão à consulta paginada e à tela; sem ?c= nada é selecionado", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "  ana  ", setor: "FINANCEIRO", c: "x" }) }));
    expect(mocks.pagina).toHaveBeenCalledWith(expect.anything(), { busca: "ana", setor: "FINANCEIRO" }, null,undefined,{operacao});
    expect(html).toContain("sel:x");
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("sel:null");
  });

  it("cursor válido da URL é repassado; inválido é ignorado", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    await Page({ searchParams: Promise.resolve({ cursor: cursorValido }) });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), {}, cursorValido,undefined,{operacao});
    await Page({ searchParams: Promise.resolve({ cursor: "lixo!" }) });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), {}, null,undefined,{operacao});
  });

  it("deep link fora da primeira página: o item é buscado por id e entra na lista", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.pagina.mockResolvedValue({ itens: [{ id: "p1" }], proximo: null });
    mocks.item.mockResolvedValue({ id: "x" });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "x" }) }));
    expect(mocks.item).toHaveBeenCalledWith(expect.anything(), "x",{operacao});
    expect(html).toContain("itens:x,p1");
  });

  it("deep link já presente na página, ou fora do escopo, não duplica nem inventa item", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.pagina.mockResolvedValue({ itens: [{ id: "x" }], proximo: null });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "x" }) }))).toContain("itens:x|");
    expect(mocks.item).not.toHaveBeenCalled();
    mocks.pagina.mockResolvedValue({ itens: [{ id: "p1" }], proximo: null });
    mocks.item.mockResolvedValue(null);
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "y" }) }))).toContain("itens:p1|");
  });
});

it("encaminha instante epoch único da renderização de servidor para hidratação estável",async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-03-29T23:30:00.000Z"));
 try { mocks.sessao.mockResolvedValue({id:"u",papeis:["FINANCEIRO"]});mocks.admin.mockReturnValue(false);mocks.preferencia.mockResolvedValue({ok:false});mocks.triagem.mockResolvedValue([]);mocks.pagina.mockResolvedValue({itens:[],proximo:null});mocks.opcoes.mockResolvedValue({destinos:[],numeros:[]});mocks.filtro.mockResolvedValue({setores:[],numeros:[]});sino.listar.mockResolvedValue([]);sino.fuso.mockResolvedValue("UTC");
  const h=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(h).toContain(`agora:${Date.parse("2026-03-29T23:30:00.000Z")}`);
 } finally {vi.useRealTimers();}
});

it.each([["VENDEDOR",true],["PROFESSOR",false],["FINANCEIRO",false]] as const)("repasse Funil calcula alçada real do papel%s sem conceder por convite",async(papel,esperado)=>{vi.resetAllMocks();mocks.sessao.mockResolvedValue({id:"ator327",papeis:[papel]});mocks.admin.mockReturnValue(false);mocks.pagina.mockResolvedValue({itens:[],proximo:null});mocks.contar.mockResolvedValue({todas:0,minhas:0,naoLidas:0,prazo:0,fila:0});mocks.opcoes.mockResolvedValue({destinos:[],numeros:[]});mocks.filtro.mockResolvedValue({setores:[],numeros:[]});mocks.triagem.mockResolvedValue(null);mocks.preferencia.mockResolvedValue({ok:false});sino.listar.mockResolvedValue([]);sino.fuso.mockResolvedValue("America/Sao_Paulo");const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain('funil:'+esperado);expect(html).toContain('criar329:'+esperado);});

it('328: propaga fuso institucional já consultado separado do pessoal, sem nova consulta',async()=>{vi.resetAllMocks();mocks.sessao.mockResolvedValue({id:'ator328',papeis:['VENDEDOR']});mocks.admin.mockReturnValue(false);mocks.pagina.mockResolvedValue({itens:[],proximo:null});mocks.contar.mockResolvedValue({todas:0,minhas:0,naoLidas:0,prazo:0,fila:0});mocks.opcoes.mockResolvedValue({destinos:[],numeros:[]});mocks.filtro.mockResolvedValue({setores:[],numeros:[]});mocks.triagem.mockResolvedValue(null);mocks.preferencia.mockResolvedValue({ok:true,dado:{fusoExibicao:'Asia/Tokyo'}});sino.listar.mockResolvedValue([]);sino.fuso.mockResolvedValue('America/Costa_Rica');const h=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(h).toContain('fusoEscola:America/Costa_Rica');expect(h).toContain('inbox:Asia/Tokyo');expect(sino.fuso).toHaveBeenCalledOnce();});
it("SSR pede resumo mesmo vazio e sem flag, usando uma operação em todas as consultas",async()=>{mocks.sessao.mockResolvedValue({id:"u",papeis:["FINANCEIRO"]});mocks.preferencia.mockResolvedValue({ok:false});mocks.admin.mockReturnValue(false);mocks.triagem.mockResolvedValue([]);mocks.pagina.mockResolvedValue({itens:[],proximo:null});mocks.opcoes.mockResolvedValue({destinos:[],numeros:[]});mocks.filtro.mockResolvedValue({setores:[],numeros:[]});sino.listar.mockResolvedValue([]);sino.fuso.mockResolvedValue("UTC");const h=renderToStaticMarkup(await Page({searchParams:Promise.resolve({aria:"ia",c:"fora"})}));expect(mocks.operacao).toHaveBeenCalledTimes(1);expect(mocks.resumo).toHaveBeenCalledWith({id:"u",papeis:["FINANCEIRO"]},{aria:"ia"},undefined,{operacao});expect(mocks.item).toHaveBeenCalledWith({id:"u",papeis:["FINANCEIRO"]},"fora",{operacao});expect(h).toContain('resumo:'+JSON.stringify(resumo).replaceAll('"','&quot;'));expect(mocks.sessao.mock.invocationCallOrder.at(-1)!).toBeLessThan(mocks.operacao.mock.invocationCallOrder.at(-1)!);});
