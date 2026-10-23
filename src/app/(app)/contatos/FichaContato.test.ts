import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { DetalheContato } from "@/server/crm/contatos";
import type { CampoDaFicha, ParDuplicado } from "@/server/crm/ficha-dados";
import type { LinhaContato } from "@/server/crm/contatos";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
vi.mock("@/server/crm/contatos-acoes", () => ({
  editarPessoaDaFicha: vi.fn(), registrarNotaDaFicha: vi.fn(), registrarOptOutDaFicha: vi.fn(),
  atribuirTagDaFicha: vi.fn(), removerTagDaFicha: vi.fn(), definirCampoDaFicha: vi.fn(), mesclarContatosDaLista: vi.fn(), previaMesclaDaLista: vi.fn(),
}));
vi.mock("@/server/comercial/acoes", () => ({ criarLead: vi.fn(), moverEtapa: vi.fn() }));
vi.mock("@/server/crm/oportunidades", () => ({ buscarPossiveisDuplicados: vi.fn() }));

import { FichaContato, mensagemFalhaParcialCampos } from "./FichaContato";
import { ListaContatos } from "./ListaContatos";
import { MesclarContatos, escolhasDaMescla } from "./MesclarContatos";

const detalhe: DetalheContato = {
  id: "p1", codigo: "P-000001", nome: "Ana Souza", email: "ana@exemplo.com", cidade: "Recife", cargo: null, linkedin: null,
  origemCanal: "INDICACAO", empresa: null, telefones: [{ telefone: "+5581999990000", optOut: false }], optOut: false, ehAluno: false,
  tags: [{ id: "t1", nome: "Quente", cor: "ALERTA" }],
  oportunidades: [{ id: "o1", nome: "Ana Souza", etapa: "NOVO", temperatura: "MORNO", dono: "Bia" }],
  criadoEm: new Date("2026-10-01T12:00:00Z"),
};
const detalheAluno: DetalheContato = { ...detalhe, id: "p2", nome: "Aluno Lima", ehAluno: true, oportunidades: [], tags: [] };
const classesCor = { NEUTRA: "a", MARCA: "b", INFO: "c", SUCESSO: "d", ALERTA: "e", PERIGO: "f", IA: "g" };

function renderFicha(d: DetalheContato, capacidades: CapacidadeCrm[], campos: CampoDaFicha[] = [], extra: object = {}) {
  return renderToStaticMarkup(
    createElement(FichaContato, {
      detalhe: d, historico: [], campos, tagsDisponiveis: [{ id: "t2", nome: "Frio", cor: "INFO" }], classesCor,
      capacidades, vendedores: [{ id: "v1", nome: "Bia" }], paises: [], ...extra,
    }),
  );
}

const linhas: LinhaContato[] = [
  { id: "p1", codigo: "P-000001", tipo: "pessoa", nome: "Ana", cidade: "Recife", origem: null, subtitulo: null, telefone: "+5581999990000", tags: [], oportunidade: null, optOut: false, ultimaInteracaoEm: null },
  { id: "e1", codigo: null, tipo: "empresa", nome: "Acme", cidade: null, origem: null, subtitulo: null, telefone: null, tags: [], oportunidade: null, optOut: false, ultimaInteracaoEm: null },
];
const filtros = { busca: "", tipo: "todos", tagId: "", donoId: "", etapa: "", origem: "", pagina: 1 } as const;
function renderLista(itens: LinhaContato[], extra: object = {}) {
  return renderToStaticMarkup(
    createElement(ListaContatos, {
      itens, total: itens.length, possuiMais: false, filtros, abertoId: "", tags: [], vendedores: [], comercial: true,
      podeImportar: false, podeMesclar: false, podeExportar: false, pares: [], mesclaveis: {}, filtrando: false, ...extra,
    }),
  );
}

describe("FichaContato", () => {
  it("abas Visão geral, Histórico, Oportunidades e Campos; opt-out sem Desfazer", () => {
    const html = renderFicha(detalhe, ["contatos.ver", "contatos.editar", "funil.ver"]);
    expect(html).toMatch(/>Visão geral<[\s\S]*>Histórico<[\s\S]*>Oportunidades<[\s\S]*>Campos</);
    expect(html).toContain("Registrar opt-out");
    expect(html).not.toContain("Desfazer");
  });

  it("secretaria não vê Importar, Mesclar, Nova oportunidade nem campos de funil", () => {
    const html = renderFicha(detalheAluno, ["contatos.ver"]);
    for (const t of ["Importar", "Mesclar", "Nova oportunidade", "Temperatura"]) expect(html).not.toContain(t);
    expect(html).not.toContain("Registrar opt-out");
    expect(html).not.toContain("Salvar dados");
  });

  it("secretaria não vê a aba Oportunidades nem dados de funil, nem forçando a aba", () => {
    for (const aba of ["geral", "oportunidades"] as const) {
      const html = renderFicha(detalhe, ["contatos.ver"], [], { abaInicial: aba });
      expect(html).not.toContain(">Oportunidades<");
      for (const t of ["Temperatura", "Morno", "Novo", "Bia", "Nenhuma oportunidade"]) expect(html).not.toContain(t);
    }
  });

  it("quem tem funil.ver vê a aba e a oportunidade com etapa e temperatura", () => {
    const html = renderFicha(detalhe, ["contatos.ver", "funil.ver"], [], { abaInicial: "oportunidades" });
    expect(html).toContain(">Oportunidades<");
    expect(html).toContain("Bia");
  });

  it("vendedor vê Nova oportunidade; sem a capacidade de mover o botão some", () => {
    expect(renderFicha(detalhe, ["contatos.ver", "contatos.editar", "funil.mover"])).toContain("Nova oportunidade");
    expect(renderFicha(detalhe, ["contatos.ver", "contatos.editar"])).not.toContain("Nova oportunidade");
  });

  it("opt-out já registrado não oferece registrar de novo", () => {
    const html = renderFicha({ ...detalhe, optOut: true }, ["contatos.ver", "contatos.editar"]);
    expect(html).not.toContain("Registrar opt-out");
    expect(html).toContain("Opt-out registrado");
  });

  it("campos personalizados por tipo: select, checkbox, date e decimal", () => {
    const campos: CampoDaFicha[] = [
      { id: "c1", nome: "Nível", tipo: "SELECAO", opcoes: ["A1", "B2"], obrigatorio: false, valor: "B2" },
      { id: "c2", nome: "Aceita visita", tipo: "BOOLEANO", opcoes: [], obrigatorio: false, valor: true },
      { id: "c3", nome: "Nascimento", tipo: "DATA", opcoes: [], obrigatorio: false, valor: "2000-01-31" },
      { id: "c4", nome: "Renda", tipo: "NUMERO", opcoes: [], obrigatorio: false, valor: 12.5 },
    ];
    const html = renderToStaticMarkup(
      createElement(FichaContato, {
        detalhe, historico: [], campos, tagsDisponiveis: [], classesCor, capacidades: ["contatos.ver", "contatos.editar"],
        vendedores: [], paises: [], abaInicial: "campos",
      }),
    );
    expect(html).toMatch(/<select[^>]*>[\s\S]*<option value="B2" selected/);
    expect(html).toMatch(/type="checkbox"[^>]*checked/);
    expect(html).toContain('type="date"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("Salvar campos");
  });
});

describe("ListaContatos", () => {
  it("ações da linha visíveis sem hover e seleção por caixa sempre presente", () => {
    expect(renderLista(linhas)).toMatch(/type="checkbox"[^>]*aria-label="Selecionar Ana"/);
    const html = renderLista(linhas);
    expect(html).toContain('href="/contatos?c=p1"');
    expect(html).not.toContain("hover:opacity");
  });

  it("Importar e Exportar só com a capacidade; empresa não abre ficha", () => {
    const sem = renderLista(linhas);
    expect(sem).not.toContain("Importar");
    expect(sem).not.toContain("Exportar");
    expect(sem).not.toContain("c=e1");
    const com = renderLista(linhas, { podeImportar: true, podeExportar: true });
    expect(com).toContain("Importar");
    expect(com).toContain('href="/api/exportacoes/contatos"');
  });

  it("vazio duplo: sem contatos × filtro sem resultado", () => {
    expect(renderLista([])).toContain("Nenhum contato na sua carteira.");
    const f = renderLista([], { filtrando: true });
    expect(f).toContain("Nenhum contato com esses filtros.");
    expect(f).toContain("Limpar filtros");
  });
});

describe("MesclarContatos", () => {
  const a = { id: "a", nome: "Ana", email: "a@x.com", cidade: "Recife", cargo: null };
  const b = { id: "b", nome: "Ana S.", email: null, cidade: "Recife", cargo: "Gerente" };
  const pares: ParDuplicado[] = [{ a, b, motivos: ["telefone"] }];

  it("lista os pares sugeridos com o motivo e a ação Mesclar", () => {
    const html = renderToStaticMarkup(createElement(MesclarContatos, { pares, selecionado: null }));
    expect(html).toContain("Possíveis duplicados");
    expect(html).toContain("mesmo telefone");
    expect(html).toContain('aria-label="Mesclar Ana e Ana S."');
  });

  it("sem pares nem seleção não renderiza nada", () => {
    expect(renderToStaticMarkup(createElement(MesclarContatos, { pares: [], selecionado: null }))).toBe("");
  });

  it("escolhas são relativas à pessoa principal", () => {
    const todas = { nome: "a", email: "b", cidade: "a", cargo: "b" } as const;
    expect(escolhasDaMescla("a", todas)).toEqual({ nome: "principal", email: "secundaria", cidade: "principal", cargo: "secundaria" });
    expect(escolhasDaMescla("b", todas)).toEqual({ nome: "secundaria", email: "principal", cidade: "secundaria", cargo: "principal" });
  });
});

describe("mensagemFalhaParcialCampos", () => {
  it("diz quantos campos ficaram salvos antes do erro", () => {
    expect(mensagemFalhaParcialCampos(1, 3, "Curso", "Valor inválido.")).toBe("1 campo salvo de 3. Curso não foi salvo: Valor inválido.");
    expect(mensagemFalhaParcialCampos(2, 3, "Curso", "Valor inválido.")).toBe("2 campos salvos de 3. Curso não foi salvo: Valor inválido.");
  });
});

// Fuso pessoal nas telas (pendência da Q176): o cadastro sai no fuso pessoal; sem ele, no da escola.
describe("FichaContato: fuso pessoal de exibição", () => {
  const d: DetalheContato = { ...detalhe, criadoEm: new Date("2026-10-21T02:30:00Z") };
  it("Costa Rica pela preferência; sem preferência, São Paulo (escola) — igual em TZ=UTC e America/Sao_Paulo", () => {
    expect(renderFicha(d, ["funil.ver"], [], { fuso: "America/Sao_Paulo", preferenciaFusoExibicao: "America/Costa_Rica" })).toContain("20/10/2026, 20:30");
    expect(renderFicha(d, ["funil.ver"], [], { fuso: "America/Sao_Paulo", preferenciaFusoExibicao: null })).toContain("20/10/2026, 23:30");
  });
});
