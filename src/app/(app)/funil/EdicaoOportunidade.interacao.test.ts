import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// B1 da R1 do #216: as edições que só existiam na ficha antiga (/leads/[id]) moram no painel da oportunidade.
// Interação sem DOM (src/test/tela-sem-dom.ts): cada seção é chamada como função e os botões/campos são
// acionados pelas props.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((v: unknown) => m.ganchos!.useRef(v)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
    useEffect: (() => {}) as unknown as typeof real.useEffect,
  };
});
const acoes = vi.hoisted(() => ({
  atualizarResumo: vi.fn(),
  atualizarDatas: vi.fn(),
  editarLead: vi.fn(),
  registrarInteracao: vi.fn(),
  anexarDocumentoLead: vi.fn(),
  arquivarDocumentoLead: vi.fn(),
}));
const refreshMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => acoes);

import type { DetalheOportunidade } from "@/server/crm/historico";
import { UploadArquivo } from "@/components/UploadArquivo";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { campo, campos, clicarBotao, controle, criarGanchos, elementos, texto } from "@/test/tela-sem-dom";
import {
  DadosOportunidade,
  DatasOportunidade,
  DocumentosOportunidade,
  InteracaoOportunidade,
  ResumoOportunidade,
} from "./EdicaoOportunidade";

const op: DetalheOportunidade = {
  id: "op1", codigo: "L-000001", nome: "Maria Souza", b2b: false, etapa: "EM_ATENDIMENTO", temperatura: "QUENTE",
  valorPrevisto: "1500.50", moeda: "BRL", pais: "Brasil", dono: { id: "v1", nome: "Ana" },
  proximaAcao: "Ligar", proximoFollowUp: new Date("2026-10-20T15:00:00Z"), dataExperimental: null, motivoPerda: null,
  criadoEm: new Date("2026-10-01T12:00:00Z"), pessoaId: "p1", interesse: "Inglês", objetivo: null,
  urgencia: null, orcamento: null, objecao: null, taxaMatricula: null,
  telefoneE164: "+5511988887777", paisId: "br", segmento: "ADULTO",
  origemCampanha: "Outubro", origemConjunto: "Conjunto A", origemAnuncio: "Anúncio 1", origemPalavra: "ingles",
  planoPrevisto: "Regular A1", comissaoPrevista: "100.00", dataProposta: null,
  documentos: [{ id: "d1", categoria: "PROPOSTA", nome: "proposta.pdf", url: "/api/files/a.pdf" }],
};

function montar<P>(componente: (p: P) => ReactNode, props: P) {
  m.ganchos = criarGanchos();
  const arvore = () => m.ganchos!.renderizar(componente, props);
  return {
    arvore,
    texto: () => texto(arvore()),
    tem: (rotulo: string) => elementos(arvore()).some((n) => (n.type === "button" || n.type === Botao) && texto(n.props.children).trim() === rotulo),
    async clicar(rotulo: string) { await clicarBotao(arvore(), rotulo); },
    digitar(id: string, valor: string) {
      (controle(campo(arvore(), id)).props.onChange as (e: unknown) => void)({ target: { value: valor, checked: valor === "true" } });
    },
    valor: (id: string) => controle(campo(arvore(), id)).props.value,
  };
}

const ok = { ok: true, dado: undefined };

beforeEach(() => {
  for (const f of Object.values(acoes)) f.mockReset().mockResolvedValue(ok);
  refreshMock.mockReset();
});

describe("ResumoOportunidade", () => {
  it("edita o próximo passo e o resumo com atualizarResumo, mandando os seis campos", async () => {
    const t = montar(ResumoOportunidade, { oportunidade: op, podeEditar: true });
    expect(t.texto()).toContain("Ligar");
    await t.clicar("Editar resumo");
    t.digitar("op-resumo-proximaAcao", "Enviar proposta na sexta");
    await t.clicar("Salvar resumo");
    expect(acoes.atualizarResumo).toHaveBeenCalledWith("op1", {
      interesse: "Inglês", objetivo: "", urgencia: "", orcamento: "", objecao: "", proximaAcao: "Enviar proposta na sexta",
    });
    expect(refreshMock).toHaveBeenCalled();
    expect(t.tem("Salvar resumo")).toBe(false);
  });
  it("recusa do servidor mantém a edição aberta e mostra o erro", async () => {
    acoes.atualizarResumo.mockResolvedValue({ ok: false, erro: "Oportunidade fora da sua carteira." });
    const t = montar(ResumoOportunidade, { oportunidade: op, podeEditar: true });
    await t.clicar("Editar resumo");
    await t.clicar("Salvar resumo");
    expect(t.tem("Salvar resumo")).toBe(true);
    expect(refreshMock).not.toHaveBeenCalled();
  });
  it("sem permissão de edição só mostra", () => {
    const t = montar(ResumoOportunidade, { oportunidade: op, podeEditar: false });
    expect(t.tem("Editar resumo")).toBe(false);
    expect(t.texto()).toContain("Inglês");
  });
});

describe("DatasOportunidade", () => {
  it("salva follow-up, experimental e proposta com atualizarDatas", async () => {
    const t = montar(DatasOportunidade, { oportunidade: op, podeEditar: true, fuso: "America/Sao_Paulo" });
    expect(t.valor("op-datas-followup")).toBe("2026-10-20");
    t.digitar("op-datas-followup", "2026-10-25");
    t.digitar("op-datas-proposta", "2026-10-27");
    await t.clicar("Salvar datas");
    expect(acoes.atualizarDatas).toHaveBeenCalledWith("op1", { proximoFollowUp: "2026-10-25", dataExperimental: "", fusoDataExperimental: "America/Sao_Paulo", dataProposta: "2026-10-27" });
    expect(refreshMock).toHaveBeenCalled();
  });
  // Lote 3 do fuso pessoal: a experimental vai como o texto digitado + o fuso escrito ao lado do campo (pessoal; sem
  // preferência, o da escola); o servidor converte. Antes: `new Date(valor)` no fuso do navegador.
  it("a experimental vai como texto + fuso do campo, sem conversão no navegador; hora preservada", async () => {
    const t = montar(DatasOportunidade, { oportunidade: op, podeEditar: true, fuso: "America/Sao_Paulo" });
    t.digitar("op-datas-experimental", "2026-10-22T18:30");
    await t.clicar("Salvar datas");
    expect(acoes.atualizarDatas).toHaveBeenCalledWith("op1", expect.objectContaining({ dataExperimental: "2026-10-22T18:30", fusoDataExperimental: "America/Sao_Paulo" }));
    const comPreferencia = montar(DatasOportunidade, { oportunidade: op, podeEditar: true, fuso: "America/Sao_Paulo", preferenciaFusoExibicao: "Asia/Tokyo" });
    comPreferencia.digitar("op-datas-experimental", "2026-10-22T18:30");
    await comPreferencia.clicar("Salvar datas");
    expect(acoes.atualizarDatas).toHaveBeenLastCalledWith("op1", expect.objectContaining({ dataExperimental: "2026-10-22T18:30", fusoDataExperimental: "Asia/Tokyo" }));
  });
  it("valor inicial da experimental no fuso do campo (não no do navegador); fuso inválido cai em UTC sem quebrar", () => {
    const comExperimental = { ...op, dataExperimental: "2026-10-23T01:30:00.000Z" } as typeof op;
    expect(montar(DatasOportunidade, { oportunidade: comExperimental, podeEditar: true, fuso: "America/Sao_Paulo" }).valor("op-datas-experimental")).toBe("2026-10-22T22:30");
    expect(montar(DatasOportunidade, { oportunidade: comExperimental, podeEditar: true, fuso: "Lua/Base" }).valor("op-datas-experimental")).toBe("2026-10-23T01:30");
  });
  it("sem permissão não há campos nem botão", () => {
    const t = montar(DatasOportunidade, { oportunidade: op, podeEditar: false, fuso: "America/Sao_Paulo" });
    expect(campos(t.arvore())).toHaveLength(0);
    expect(t.tem("Salvar datas")).toBe(false);
  });
});

describe("DadosOportunidade", () => {
  it("edita nome, segmento e B2B com editarLead sem apagar temperatura nem origem", async () => {
    const t = montar(DadosOportunidade, { oportunidade: op, podeEditar: true, paises: [{ id: "br", nome: "Brasil" }] });
    await t.clicar("Editar dados");
    t.digitar("op-dados-nome", "Maria S. Souza");
    t.digitar("op-dados-segmento", "EMPRESA");
    t.digitar("op-dados-b2b", "true");
    await t.clicar("Salvar dados");
    expect(acoes.editarLead).toHaveBeenCalledWith("op1", expect.objectContaining({
      nome: "Maria S. Souza", segmento: "EMPRESA", b2b: true, temperatura: "QUENTE",
      telefoneE164: "+5511988887777", paisId: "br", origemCampanha: "Outubro", origemConjunto: "Conjunto A",
      origemAnuncio: "Anúncio 1", origemPalavra: "ingles", planoPrevisto: "Regular A1",
      valorPrevisto: "1500,50", comissaoPrevista: "100,00",
    }));
    expect(refreshMock).toHaveBeenCalled();
  });
  it("nome vazio não chega ao servidor", async () => {
    const t = montar(DadosOportunidade, { oportunidade: op, podeEditar: true, paises: [] });
    await t.clicar("Editar dados");
    t.digitar("op-dados-nome", "  ");
    await t.clicar("Salvar dados");
    expect(acoes.editarLead).not.toHaveBeenCalled();
    expect(campo(t.arvore(), "op-dados-nome").props.erro).toBe("Informe o nome");
  });
  it("sem permissão não edita", () => {
    expect(montar(DadosOportunidade, { oportunidade: op, podeEditar: false, paises: [] }).tem("Editar dados")).toBe(false);
  });
});

describe("DocumentosOportunidade", () => {
  it("anexa com a categoria escolhida e arquiva", async () => {
    const t = montar(DocumentosOportunidade, { oportunidade: op, podeEditar: true });
    expect(t.texto()).toContain("proposta.pdf");
    t.digitar("op-documento-categoria", "TESTE_NIVEL");
    const upload = elementos(t.arvore()).find((n) => n.type === UploadArquivo)!;
    expect(upload.props).toMatchObject({ leadId: "op1", categoriaDocumento: "TESTE_NIVEL" });
    await (upload.props.onUpload as (r: unknown) => unknown)({ url: "/api/files/b.pdf", nome: "teste.pdf" });
    expect(acoes.anexarDocumentoLead).toHaveBeenCalledWith("op1", { categoria: "TESTE_NIVEL", nome: "teste.pdf", url: "/api/files/b.pdf" });
    await t.clicar("Arquivar proposta.pdf");
    expect(acoes.arquivarDocumentoLead).toHaveBeenCalledWith("d1");
  });
  it("sem permissão lista, mas não anexa nem arquiva", () => {
    const t = montar(DocumentosOportunidade, { oportunidade: op, podeEditar: false });
    expect(t.texto()).toContain("proposta.pdf");
    expect(elementos(t.arvore()).some((n) => n.type === UploadArquivo)).toBe(false);
    expect(t.tem("Arquivar proposta.pdf")).toBe(false);
  });
});

describe("InteracaoOportunidade", () => {
  it("registra canal e nota com registrarInteracao e limpa depois do sucesso", async () => {
    const t = montar(InteracaoOportunidade, { oportunidadeId: "op1" });
    t.digitar("op-interacao-canal", "Ligação");
    t.digitar("op-interacao-nota", "Pediu proposta");
    await t.clicar("Registrar interação");
    expect(acoes.registrarInteracao).toHaveBeenCalledWith("op1", { canal: "Ligação", nota: "Pediu proposta", chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(t.valor("op-interacao-nota")).toBe("");
  });
  it("chave de idempotência (#166): o reenvio depois do incerto manda a mesma chave; depois do sucesso, outra", async () => {
    const t = montar(InteracaoOportunidade, { oportunidadeId: "op1" });
    t.digitar("op-interacao-nota", "Pediu proposta");
    acoes.registrarInteracao.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await t.clicar("Registrar interação");
    expect(elementos(t.arvore()).find((n) => n.type === FeedbackAcao)?.props.erro).toBe(MSG_RESULTADO_INCERTO);
    expect(t.valor("op-interacao-nota")).toBe("Pediu proposta");
    await t.clicar("Registrar interação");
    t.digitar("op-interacao-nota", "Outra interação");
    await t.clicar("Registrar interação");
    const chaves = acoes.registrarInteracao.mock.calls.map((c) => (c[1] as { chaveIdempotencia?: string }).chaveIdempotencia);
    expect(chaves[1]).toBe(chaves[0]);
    expect(chaves[2]).not.toBe(chaves[0]);
  });
  it("na falha o texto fica para conferir", async () => {
    acoes.registrarInteracao.mockResolvedValue({ ok: false, erro: "Falhou" });
    const t = montar(InteracaoOportunidade, { oportunidadeId: "op1" });
    t.digitar("op-interacao-nota", "Pediu proposta");
    await t.clicar("Registrar interação");
    expect(t.valor("op-interacao-nota")).toBe("Pediu proposta");
  });
});
