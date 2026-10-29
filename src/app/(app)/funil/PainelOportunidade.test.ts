// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render as renderDom } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CONTROLE_CAMPO } from "@/components/Campo";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { DetalheOportunidade } from "@/server/crm/historico";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/server/comercial/acoes", () => ({
  atribuirDono: vi.fn(), definirTemperatura: vi.fn(), agendarExperimental: vi.fn(),
  enviarProposta: vi.fn(), registrarNotaInterna: vi.fn(), marcarPerdido: vi.fn(),
  atualizarResumo: vi.fn(), atualizarDatas: vi.fn(), editarLead: vi.fn(), registrarInteracao: vi.fn(),
  anexarDocumentoLead: vi.fn(), arquivarDocumentoLead: vi.fn(),
}));
vi.mock("@/server/matricula/acoes", () => ({ registrarLinkPagamento: vi.fn() }));
vi.mock("@/server/inbox/acoes-fechamento-painel", () => ({
  definirPrevisaoOportunidade: vi.fn(), criarTarefaOportunidade: vi.fn(), concluirTarefaOportunidade: vi.fn(), reabrirTarefaOportunidade: vi.fn(),
}));

import { PainelOportunidade } from "./PainelOportunidade";
import { ModalPerda, validarPerda } from "./ModalPerda";

const base: DetalheOportunidade = {
  id: "op1", codigo: "L-000001", nome: "Maria Souza", b2b: false, etapa: "NOVO", temperatura: "MORNO",
  probabilidadePct: null, previsaoFechamento: null,
  valorPrevisto: "85000.00", moeda: "CRC", pais: "Costa Rica", dono: { id: "v1", nome: "Ana Vendedora" },
  proximaAcao: "Ligar", proximoFollowUp: null, dataExperimental: null, motivoPerda: null,
  criadoEm: new Date("2026-10-01T12:00:00Z"), pessoaId: "p1", interesse: null, objetivo: null,
  urgencia: null, orcamento: null, objecao: null, taxaMatricula: null,
  telefoneE164: "+50688887777", paisId: "cr", segmento: "ADULTO", origemCampanha: null, origemConjunto: null,
  origemAnuncio: null, origemPalavra: null, planoPrevisto: null, comissaoPrevista: null, dataProposta: null,
  professorExperimental: null, experimentalConfirmadaEm: null,
  documentos: [{ id: "d1", categoria: "PROPOSTA", nome: "proposta.pdf", url: "/api/files/a.pdf" }],
  b2bDetalhes: null, tarefas: [],
};
const detalheEmProposta: DetalheOportunidade = { ...base, etapa: "PROPOSTA" };
const detalheEmExperimental: DetalheOportunidade = { ...base, etapa: "EXPERIMENTAL_AGENDADA", dataExperimental: new Date("2026-10-20T18:00:00Z") };
const detalheComTaxaPendente: DetalheOportunidade = {
  ...base, etapa: "AGUARDANDO_MATRICULA",
  taxaMatricula: { cobrancaId: "c1", status: "PENDENTE", linkPagamento: null, linkEnviadoEm: null },
};

const GERENTE: CapacidadeCrm[] = ["funil.ver", "funil.mover", "funil.atribuir"];
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  }
  const proto = Element.prototype as Element & { scrollIntoView?: () => void; hasPointerCapture?: () => boolean; setPointerCapture?: () => void; releasePointerCapture?: () => void };
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
});

const render = (d: DetalheOportunidade, capacidades: CapacidadeCrm[] = GERENTE, extra: object = {}) => {
  cleanup();
  renderDom(createElement(PainelOportunidade, {
    oportunidade: d, historico: [], capacidades, vendedores: [{ id: "v1", nome: "Ana Vendedora" }, { id: "v2", nome: "Beto" }],
    aoFechar: () => {}, ...extra,
  }));
  return document.body.innerHTML;
};
const renderPerda = () => renderToStaticMarkup(createElement(ModalPerda, { oportunidadeId: "op1", nome: "Maria", aoFechar: () => {} }));
const clicarConfirmar = (v: { motivoPerda: string; observacao: string }) => validarPerda(v as never);

describe("PainelOportunidade", () => {
  it("abas Oportunidade, Detalhes e Atividade; ganho leva à contratação", () => {
    const html = render(detalheEmProposta);
    expect(html).toMatch(/role="tab"[^>]*>Oportunidade<[\s\S]*>Detalhes<[\s\S]*>Atividade</);
    expect(html).toContain(`href="/oportunidades/${detalheEmProposta.id}/contratacao"`);
    expect(html).toContain("Preparar contratação");
  });
  it("modal de perda: 9 motivos do ERP; Outro exige observação", () => {
    const html = renderPerda();
    expect(html.match(/role="radio"/g)).toHaveLength(9);
    expect(html).toContain('name="motivoPerda"');
    expect(clicarConfirmar({ motivoPerda: "OUTRO", observacao: "" }).erro).toBe("Observação obrigatória quando o motivo é Outro");
    expect(clicarConfirmar({ motivoPerda: "PRECO", observacao: "" }).input).toEqual({ motivoPerda: "PRECO", observacao: undefined });
    expect(clicarConfirmar({ motivoPerda: "", observacao: "" }).input).toBeNull();
  });
  it("vendedor não vê seletor de responsável; check-in da experimental não aparece", () => {
    const html = render(detalheEmExperimental, ["funil.ver", "funil.mover"]);
    expect(html).not.toContain('aria-label="Responsável"');
    expect(html).not.toMatch(/>Realizada</);
    expect(html).toContain("Confirmar presença");
    expect(html).toContain('aria-label="Professor da experimental"');
    expect(render(detalheEmExperimental)).toContain('aria-label="Responsável"');
  });
  it("oportunidade com taxa de matrícula pendente mostra Registrar link de pagamento (D10)", () => {
    expect(render(detalheComTaxaPendente)).toContain("Registrar link de pagamento");
    expect(render(base)).not.toContain("Registrar link de pagamento");
  });
  it("só leitura (sem funil.mover) não mostra ações; aba Atividade lista o histórico, mais recente primeiro", () => {
    const so = render(detalheEmProposta, ["funil.ver"]);
    expect(so).not.toContain("Preparar contratação");
    expect(so).not.toContain("Marcar como perdida");
    const html = render(base, GERENTE, {
      abaInicial: "atividade",
      historico: [
        { id: "e1", tipo: "LeadCriado", rotulo: "Oportunidade criada", autor: "Ana", em: new Date("2026-10-01T12:00:00Z") },
        { id: "e2", tipo: "LeadPerdido", rotulo: "Perdida: Preço", autor: null, em: new Date("2026-10-02T12:00:00Z") },
      ],
    });
    expect(html.indexOf("Perdida: Preço")).toBeGreaterThan(-1);
    expect(html.indexOf("Perdida: Preço")).toBeLessThan(html.indexOf("Oportunidade criada"));
  });
  it("edições da ficha antiga no painel: resumo, datas, dados e documentos em Detalhes; interação em Atividade (B1 da R1 do #216)", () => {
    const detalhes = render(base, GERENTE, { abaInicial: "detalhes" });
    for (const t of ["Editar resumo", "Salvar datas", "Editar dados", "Anexar documento", "proposta.pdf", "Próximo follow-up"]) expect(detalhes).toContain(t);
    expect(render(base, GERENTE, { abaInicial: "atividade" })).toContain("Registrar interação");
    const vendedor = render(base, ["funil.ver", "funil.mover"], { abaInicial: "detalhes" });
    expect(vendedor).toContain("Editar resumo");
    expect(vendedor).toContain("Salvar datas");
  });
  it("só leitura não edita resumo, datas, dados, documentos nem registra interação", () => {
    const so = render(base, ["funil.ver"], { abaInicial: "detalhes" });
    for (const t of ["Editar resumo", "Salvar datas", "Editar dados", "Anexar documento", ">Arquivar"]) expect(so).not.toContain(t);
    expect(so).toContain("proposta.pdf");
    expect(render(base, ["funil.ver"], { abaInicial: "atividade" })).not.toContain("Registrar interação");
  });
});

describe("PainelOportunidade: fuso pessoal de exibição", () => {
  const op: DetalheOportunidade = { ...base, criadoEm: new Date("2026-10-21T02:30:00Z"), proximoFollowUp: new Date("2026-10-21T15:00:00Z") };
  const detalhes = (extra: object) => render(op, GERENTE, { abaInicial: "detalhes", fuso: "America/Sao_Paulo", ...extra });

  it("criação no fuso pessoal; sem preferência, no da escola", () => {
    expect(detalhes({ preferenciaFusoExibicao: "America/Costa_Rica" })).toContain("20/10/2026, 20:30");
    expect(detalhes({ preferenciaFusoExibicao: null })).toContain("20/10/2026, 23:30");
  });

  it("follow-up é o dia civil da escola, igual para qualquer preferência", () => {
    for (const preferencia of ["America/Costa_Rica", "Asia/Tokyo", null]) {
      const html = detalhes({ preferenciaFusoExibicao: preferencia });
      expect(html).toMatch(/Próximo follow-up<\/dt><dd[^>]*>21\/10\/2026</);
    }
  });
  it("fuso da escola inválido não derruba o painel: follow-up no dia UTC, instantes no fallback do helper", () => {
    const html = detalhes({ fuso: "Fuso/Invalido", preferenciaFusoExibicao: null });
    expect(html).toMatch(/Próximo follow-up<\/dt><dd[^>]*>21\/10\/2026</);
    expect(html).toContain("21/10/2026, 02:30");
  });
});


it("335: Abrir contato usa a ficha existente /contatos?c= e codifica a pessoa sem trocar identidade", () => {
  const t = render({ ...base, pessoaId: "p ?/335" }, GERENTE, { abaInicial: "detalhes" });
  expect(t).toMatch(/href="\/contatos\?c=p%20%3F%2F335"[^>]*>Abrir contato<\/a>/);
  expect(t).not.toContain("/contatos/p");
  expect(render({ ...base, pessoaId: null }, GERENTE, { abaInicial: "detalhes" })).not.toContain("Abrir contato");
});

const FONTES_PAINEL = [
  "src/app/(app)/funil/PainelOportunidade.tsx",
  "src/app/(app)/funil/SecoesParidadeFunil.tsx",
  "src/app/(app)/funil/EdicaoOportunidade.tsx",
];
const BADGES_AD_HOC = ["bg-amber-50", "bg-red-100", "bg-yellow-100", "bg-blue-100", "bg-green-100"];

describe("PainelOportunidade: design system", () => {
  it("cabeçalho rico, abas e barra de etapas usam os primitivos globais", () => {
    const html = render(base);
    expect(html).toContain("#L-000001");
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
    expect(html).toContain(">MS<");
    expect(html).toContain('aria-label="Temperatura: Morno"');
    expect(html).toContain('aria-label="Etapas da oportunidade"');
    expect(html).toContain("bg-surface-muted");
    expect(html).toMatch(/role="tab"[^>]*data-state="active"[^>]*>Oportunidade</);
    expect(html).toMatch(/role="tab"[^>]*>Oportunidade</);
  });

  it("detalhes mantêm follow-up, contato, responsável e campanha com controle do sistema", () => {
    const html = render(
      { ...base, origemCampanha: "Outubro", proximoFollowUp: new Date("2026-10-21T15:00:00Z") },
      GERENTE,
      { abaInicial: "detalhes", fuso: "America/Sao_Paulo" },
    );
    expect(html).toMatch(/Próximo follow-up<\/dt><dd[^>]*font-mono tabular-nums[^>]*>/);
    expect(html).toContain(">Abrir contato</a>");
    expect(html).toContain("+50688887777");
    expect(html).toContain("Ana Vendedora");
    expect(html).toContain("Outubro");
    expect(html).toContain(CONTROLE_CAMPO);
  });

  it("arquivos do painel importam CONTROLE_CAMPO e não usam borda nem badge ad-hoc", () => {
    for (const arquivo of FONTES_PAINEL) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte, arquivo).toContain("CONTROLE_CAMPO");
      expect(fonte, arquivo).not.toContain("border-gray-300");
      for (const proibido of BADGES_AD_HOC) expect(fonte, `${arquivo} ${proibido}`).not.toContain(proibido);
    }
    const painel = readFileSync(FONTES_PAINEL[0]!, "utf8");
    expect(painel).toContain("Avatar");
    expect(painel).toContain("BadgeEstado");
    expect(painel).toContain("BarraEtapas");
    expect(painel).toContain("font-mono");
    expect(painel).toContain("tabular-nums");
  });
});

describe("entradas autorizadas da conversa (#336)", () => {
  it("aberta mostra Abrir e Agendar com ID codificado", () => {
    const html = render(base, GERENTE, { conversa: { atendimentoId: "ação/1?x&y", aberta: true } });
    expect(html).toContain('href="/inbox?c=a%C3%A7%C3%A3o%2F1%3Fx%26y"');
    expect(html).toContain('href="/inbox?c=a%C3%A7%C3%A3o%2F1%3Fx%26y&amp;agendar=1"');
    expect(html).toContain("Abrir conversa"); expect(html).toContain("Agendar mensagem");
  });
  it("encerrada permite somente Abrir, e prop ausente/null não inventa conversa", () => {
    const html = render(base, GERENTE, { conversa: { atendimentoId: "a1", aberta: false } });
    expect(html).toContain('href="/inbox?c=a1"'); expect(html).not.toContain("Agendar mensagem");
    expect(render(base)).not.toContain("Abrir conversa");
    expect(render(base, GERENTE, { conversa: null })).not.toContain("Abrir conversa");
  });
});
