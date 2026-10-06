import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

// Resíduo N2 da revisão da #111: a trava de datas civis (src/app/datas-civis.test.ts) só reconhece
// inicio/fim sob cobertura/compensação/período — as datas desta tela escapavam. Prova por renderização:
// texto em dd/mm/aaaa, nenhuma data ISO fora dos campos de data, e os <input type="date"> com ISO
// (o navegador descarta outro formato e o campo abre vazio).
//
// Fuso negativo fixo: `new Date("2026-03-01").toLocaleDateString()` vira 28/02 só a oeste de UTC — sem
// isto o teste pegaria esse bug ou não conforme a máquina (revisão R1 da #137, B1).
const tzAnterior = process.env.TZ;
process.env.TZ = "America/Sao_Paulo";
afterAll(() => { process.env.TZ = tzAnterior; });

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/server/comercial/acoes", () => ({ arquivarDocumentoLead: vi.fn() }));
vi.mock("@/server/secretaria/acoes", () => ({
  assumirMatricula: vi.fn(), solicitarCorrecaoCadastro: vi.fn(), resolverCorrecaoCadastro: vi.fn(),
  confirmarContratoMatricula: vi.fn(), anexarDocumentoMatricula: vi.fn(), arquivarDocumentoMatricula: vi.fn(),
}));
vi.mock("@/server/matricula/acoes", () => ({ concluirMatricula: vi.fn() }));
vi.mock("@/server/secretaria/cobertura", () => ({ conferirCoberturaInicial: vi.fn() }));

import { SecretariaPainel } from "./SecretariaPainel";

type Matricula = Parameters<typeof SecretariaPainel>[0]["matriculas"][number];
type Mensalidade = Matricula["mensalidadesExibidas"][number];
const SEM_COBERTURA: Matricula["cobertura"] = { cobrancaId: null, versao: null, vencimento: null, referencia: null, inicio: null, fim: null };
const render = (mensalidades: Mensalidade[], cobertura: Matricula["cobertura"] = SEM_COBERTURA) =>
  renderToStaticMarkup(createElement(SecretariaPainel, { secretaria: true, matriculas: [{
    exigeAssinaturaIntegrada: false, mensalidadesExibidas: mensalidades, cobertura,
    id: "m1", codigo: "MAT-1", leadId: null, alunoId: null, nome: "Ana", status: "AGUARDANDO", assumida: true, contratoConfirmado: false,
    documentos: [], correcoes: [],
  }] }));
const mensalidade = (inicio: string | null, fim: string | null): Mensalidade => ({ id: "c1", versao: 1, valor: "350.00", moeda: "BRL", inicio, fim, vencimento: "2026-03-10" });
const ISO = /\d{4}-\d{2}-\d{2}/;
/** O HTML sem o valor dos <input type="date"> (lá a ISO é obrigatória). */
const foraDosCamposDeData = (html: string) => html.replace(/(<input[^>]*type="date"[^>]*?)\svalue="[^"]*"/g, "$1");

describe("SecretariaPainel — datas civis da tela inteira", () => {
  it("mensalidade: período e vencimento em dd/mm/aaaa, nenhuma ISO no painel", () => {
    const html = render([mensalidade("2026-03-01", "2026-03-31")]);
    expect(html).toContain("01/03/2026 até 31/03/2026");
    expect(html).toContain("10/03/2026");
    expect(foraDosCamposDeData(html)).not.toMatch(ISO);
  });

  it("mensalidade sem fim: cobertura pendente, sem data crua em lugar nenhum do painel", () => {
    const html = render([mensalidade("2026-03-01", null)]);
    expect(html).toContain("Cobertura pendente de conferência");
    expect(foraDosCamposDeData(html)).not.toMatch(ISO);
  });

  it("mensalidade sem início: cobertura pendente (não '— até 31/03/2026')", () => {
    const html = render([mensalidade(null, "2026-03-31")]);
    expect(html).toContain("Cobertura pendente de conferência");
    expect(html).not.toContain("31/03/2026");
    expect(foraDosCamposDeData(html)).not.toMatch(ISO);
  });

  it("cobertura preenchida: texto em dd/mm/aaaa; os campos de data abrem com a ISO (preenchidos)", () => {
    const html = render([], { cobrancaId: "cob1", versao: 2, vencimento: "2026-03-10", referencia: "MES_CIVIL", inicio: "2026-03-01", fim: "2026-03-31" });
    expect(html).toContain("Mês civil · 01/03/2026 até 31/03/2026.");
    expect(html).toMatch(/<input[^>]*name="inicio"[^>]*type="date"[^>]*value="2026-03-01"/);
    expect(html).toMatch(/<input[^>]*name="vencimento"[^>]*type="date"[^>]*value="2026-03-10"/);
    expect(foraDosCamposDeData(html)).not.toMatch(ISO);
  });
});
