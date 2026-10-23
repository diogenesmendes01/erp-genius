import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DetalheOportunidade } from "@/server/crm/historico";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => "/funil", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/server/crm/oportunidades", () => ({ moverEtapaEmLote: vi.fn() }));
vi.mock("./QuadroFunil", () => ({ QuadroFunil: () => null }));
vi.mock("./ListaFunil", () => ({ ListaFunil: () => null }));
vi.mock("./NovaOportunidade", () => ({ NovaOportunidade: () => null }));
vi.mock("./ModalPerda", () => ({ ModalPerda: () => null }));
vi.mock("./PainelOportunidade", () => ({ PainelOportunidade: (p: { conversa?: { atendimentoId: string; aberta: boolean } | null }) => createElement("span", { "data-conversa": JSON.stringify(p.conversa ?? null) }) }));
import { FunilCliente } from "./FunilCliente";
const oportunidade: DetalheOportunidade = {
  id: "op1", codigo: "L-000001", nome: "Pessoa fictícia", b2b: false, etapa: "NOVO", temperatura: "MORNO",
  valorPrevisto: null, moeda: null, pais: null, dono: null, proximaAcao: null, proximoFollowUp: null,
  dataExperimental: null, motivoPerda: null, criadoEm: new Date("2026-10-22T12:00Z"), pessoaId: null, interesse: null,
  objetivo: null, urgencia: null, orcamento: null, objecao: null, taxaMatricula: null,
  telefoneE164: "+5500000336", paisId: null, segmento: "ADULTO", origemCampanha: null, origemConjunto: null,
  origemAnuncio: null, origemPalavra: null, planoPrevisto: null, comissaoPrevista: null, dataProposta: null, documentos: [],
};
it("#336 FunilCliente repassa conversa autorizada ao painel sem prop órfã", () => {
  const html = renderToStaticMarkup(createElement(FunilCliente, {
    colunas: [], modo: "quadro", filtros: { busca: "", tipo: "", donoId: "", temperatura: "", origem: "", tagId: "", perdidosDias: "todos", ordem: "recentes" }, dirOrdem: "asc", salvos: [],
    aberta: { oportunidade, historico: [], conversa: { atendimentoId: "a1", aberta: true } },
    oportunidadeNaoEncontrada: false, capacidades: [], podeAtribuir: false, vendedores: [], paises: [], vazio: null,
  }));
  expect(html).toContain('data-conversa="{&quot;atendimentoId&quot;:&quot;a1&quot;,&quot;aberta&quot;:true}"');
});
