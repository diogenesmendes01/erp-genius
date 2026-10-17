import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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

import { PainelOportunidade } from "./PainelOportunidade";
import { ModalPerda, validarPerda } from "./ModalPerda";

const base: DetalheOportunidade = {
  id: "op1", codigo: "L-000001", nome: "Maria Souza", b2b: false, etapa: "NOVO", temperatura: "MORNO",
  valorPrevisto: "85000.00", moeda: "CRC", pais: "Costa Rica", dono: { id: "v1", nome: "Ana Vendedora" },
  proximaAcao: "Ligar", proximoFollowUp: null, dataExperimental: null, motivoPerda: null,
  criadoEm: new Date("2026-10-01T12:00:00Z"), pessoaId: "p1", interesse: null, objetivo: null,
  urgencia: null, orcamento: null, objecao: null, taxaMatricula: null,
  telefoneE164: "+50688887777", paisId: "cr", segmento: "ADULTO", origemCampanha: null, origemConjunto: null,
  origemAnuncio: null, origemPalavra: null, planoPrevisto: null, comissaoPrevista: null, dataProposta: null,
  documentos: [{ id: "d1", categoria: "PROPOSTA", nome: "proposta.pdf", url: "/api/files/a.pdf" }],
};
const detalheEmProposta: DetalheOportunidade = { ...base, etapa: "PROPOSTA" };
const detalheEmExperimental: DetalheOportunidade = { ...base, etapa: "EXPERIMENTAL_AGENDADA", dataExperimental: new Date("2026-10-20T18:00:00Z") };
const detalheComTaxaPendente: DetalheOportunidade = {
  ...base, etapa: "AGUARDANDO_MATRICULA",
  taxaMatricula: { cobrancaId: "c1", status: "PENDENTE", linkPagamento: null, linkEnviadoEm: null },
};

const GERENTE: CapacidadeCrm[] = ["funil.ver", "funil.mover", "funil.atribuir"];
const render = (d: DetalheOportunidade, capacidades: CapacidadeCrm[] = GERENTE, extra: object = {}) =>
  renderToStaticMarkup(
    createElement(PainelOportunidade, {
      oportunidade: d, historico: [], capacidades, vendedores: [{ id: "v1", nome: "Ana Vendedora" }, { id: "v2", nome: "Beto" }],
      aoFechar: () => {}, ...extra,
    }),
  );
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
    expect(html.match(/name="motivoPerda"/g)).toHaveLength(9);
    expect(clicarConfirmar({ motivoPerda: "OUTRO", observacao: "" }).erro).toBe("Observação obrigatória quando o motivo é Outro");
    expect(clicarConfirmar({ motivoPerda: "PRECO", observacao: "" }).input).toEqual({ motivoPerda: "PRECO", observacao: undefined });
    expect(clicarConfirmar({ motivoPerda: "", observacao: "" }).input).toBeNull();
  });
  it("vendedor não vê seletor de responsável; check-in da experimental não aparece", () => {
    const html = render(detalheEmExperimental, ["funil.ver", "funil.mover"]);
    expect(html).not.toContain('aria-label="Responsável"');
    expect(html).not.toContain("Realizada");
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
