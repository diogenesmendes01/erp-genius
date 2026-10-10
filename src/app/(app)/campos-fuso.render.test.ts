import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// docs/43 §6 item 6: os campos de fuso migrados para o CampoFuso, renderizados de verdade. Cada um sai com a
// lista de sugestões própria do CampoFuso (`list="fusos-…"`), com o valor inicial esperado (o fuso da escola,
// do registro ou da preferência; vazio quando não há um conhecido) e com o `name` que a action lê.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/agenda/indisponibilidade", () => ({ solicitarIndisponibilidadeLocal: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-ocorrencia-local", () => ({ registrarOcorrenciaSegundaChamadaLocal: vi.fn() }));
vi.mock("@/server/operacao/acoes", () => ({ salvarConfiguracaoOperacional: vi.fn() }));
vi.mock("@/server/agenda/remarcacao-particular", () => ({ consultarRemarcacoesParticular: vi.fn(), proporRemarcacaoParticular: vi.fn(), decidirRemarcacaoParticular: vi.fn() }));
vi.mock("@/server/matricula/fechamento-horas-consulta", () => ({ consultarFechamentosHoras: vi.fn() }));
vi.mock("@/server/matricula/fechamento-horas-rascunho", () => ({ prepararFechamentoHoras: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ salvarPreferenciaFusoEquipe: vi.fn() }));
vi.mock("@/server/portal-aluno/preferencia-fuso", () => ({ salvarPreferenciaFusoPortalAluno: vi.fn() }));
vi.mock("@/server/paises/acoes", () => ({ criarPais: vi.fn(), editarPais: vi.fn() }));

import { SolicitarAusencia } from "./academico/indisponibilidades/SolicitarAusencia";
import { FormularioOcorrencia } from "./academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/FormularioOcorrencia";
import { OperacaoFormulario } from "./configuracao/operacao/OperacaoFormulario";
import { RemarcacaoParticular } from "./diario/encontros/[id]/remarcacao/RemarcacaoParticular";
import { PrepararFechamento } from "./matriculas/[id]/fechamentos-horas/PrepararFechamento";
import { FusoExibicaoFormulario } from "./preferencias/FusoExibicaoFormulario";
import { PreferenciasFusoPortalFormulario } from "../portal-aluno/preferencias-formulario";
import { PaisFormulario } from "./configuracao/paises/PaisFormulario";

/** A tag do <input> com o `name` dado (o CampoFuso), ou "". */
const campo = (html: string, name: string) => new RegExp(`<input[^>]*name="${name}"[^>]*>`).exec(html)?.[0] ?? "";
const render = <P extends object>(c: ComponentType<P>, props: P) => renderToStaticMarkup(createElement(c, props));

describe("campos de fuso migrados para o CampoFuso", () => {
  type Caso = { nome: string; html: () => string; name: string; valor: string; obrigatorio: boolean };
  const casos: Caso[] = [
    { nome: "SolicitarAusencia", html: () => render(SolicitarAusencia, { professores: [{ id: "p", nome: "Ana" }], fusoInicial: "America/Sao_Paulo" }), name: "fuso", valor: "America/Sao_Paulo", obrigatorio: true },
    { nome: "FormularioOcorrencia", html: () => render(FormularioOcorrencia, { reservaId: "r", fuso: "America/Costa_Rica" }), name: "fuso", valor: "America/Costa_Rica", obrigatorio: true },
    { nome: "OperacaoFormulario (opcional: em branco mantém o atual)", html: () => render(OperacaoFormulario, { exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 48, fusoInstitucional: null, prazoReservaMinutos: null }), name: "fuso", valor: "", obrigatorio: false },
    { nome: "PrepararFechamento", html: () => render(PrepararFechamento, { alunoId: "a", matriculaId: "m", fusoInicial: "America/Sao_Paulo" }), name: "fuso", valor: "America/Sao_Paulo", obrigatorio: true },
    { nome: "PrepararFechamento sem fuso conhecido", html: () => render(PrepararFechamento, { alunoId: "a", matriculaId: "m" }), name: "fuso", valor: "", obrigatorio: true },
    { nome: "FusoExibicaoFormulario (sem preferência é válido)", html: () => render(FusoExibicaoFormulario, { atual: "America/Costa_Rica" }), name: "fusoExibicao", valor: "America/Costa_Rica", obrigatorio: false },
    { nome: "preferência do portal", html: () => render(PreferenciasFusoPortalFormulario, { atual: null }), name: "fusoExibicao", valor: "", obrigatorio: false },
  ];

  it("cada um sai pelo CampoFuso, com o valor inicial e a obrigatoriedade de antes", () => {
    for (const c of casos) {
      const html = c.html();
      const tag = campo(html, c.name);
      expect(tag, c.nome).toMatch(/list="fusos-/);
      expect(tag, c.nome).toContain(`value="${c.valor}"`);
      expect(/\srequired=""/.test(tag), c.nome).toBe(c.obrigatorio);
      expect(html, c.nome).not.toMatch(/<datalist id="fusos-(?:avaliacao|grade|exibicao|portal)"/);
    }
  });

  it("remarcação do encontro particular: o fuso do encontro como valor inicial", () => {
    const dados = { duracaoMinutos: 60, podePropor: true, professores: [{ id: "p", nome: "Ana" }], fuso: "America/Sao_Paulo", propostas: [] };
    const tag = campo(render(RemarcacaoParticular, { encontroOriginalId: "e", dados, fusoExibicao: "America/Sao_Paulo" } as never), "fuso");
    expect(tag).toMatch(/list="fusos-/);
    expect(tag).toContain('value="America/Sao_Paulo"');
  });

  it("país: o fuso passa pelo CampoFuso, ligado ao rótulo, com o padrão de sempre", () => {
    const html = render(PaisFormulario, { onClose: () => {} });
    const tag = campo(html, "fuso");
    expect(tag).toContain('id="pais-fuso"');
    expect(tag).toContain('value="America/Sao_Paulo"');
    expect(tag).toMatch(/list="fusos-/);
    expect(html).toContain('<label class="mb-1 block text-xs text-gray-600" for="pais-fuso">Fuso horário</label>');
  });

  it("preferência: as sugestões trazem a opção de não ter preferência e todos os fusos do ambiente", () => {
    const html = render(FusoExibicaoFormulario, { atual: null });
    expect(html).toContain('<option value="">Usar fuso de origem do encontro</option>');
    expect(html).toContain('<option value="US/Eastern">Estados Unidos — Leste</option>');
    expect(html).toContain('<option value="Europe/Lisbon">');
  });
});
