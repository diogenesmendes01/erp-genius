import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Resíduo N2 da revisão da #111: a trava de datas civis (src/app/datas-civis.test.ts) só reconhece
// inicio/fim sob cobertura/compensação/período — o período das mensalidades da Secretaria escapava.
// Prova por renderização: a tabela mostra dd/mm/aaaa, nunca a data ISO do banco.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/server/comercial/acoes", () => ({ arquivarDocumentoLead: vi.fn() }));
vi.mock("@/server/secretaria/acoes", () => ({
  assumirMatricula: vi.fn(), solicitarCorrecaoCadastro: vi.fn(), resolverCorrecaoCadastro: vi.fn(),
  confirmarContratoMatricula: vi.fn(), anexarDocumentoMatricula: vi.fn(), arquivarDocumentoMatricula: vi.fn(),
}));
vi.mock("@/server/matricula/acoes", () => ({ concluirMatricula: vi.fn() }));
vi.mock("@/server/secretaria/cobertura", () => ({ conferirCoberturaInicial: vi.fn() }));

import { SecretariaPainel } from "./SecretariaPainel";

type Props = Parameters<typeof SecretariaPainel>[0];
const matricula = (mensalidades: Props["matriculas"][number]["mensalidadesExibidas"]): Props["matriculas"][number] => ({
  exigeAssinaturaIntegrada: false, mensalidadesExibidas: mensalidades,
  cobertura: { cobrancaId: null, versao: null, vencimento: null, referencia: null, inicio: null, fim: null },
  id: "m1", codigo: "MAT-1", leadId: null, alunoId: null, nome: "Ana", status: "AGUARDANDO", assumida: true, contratoConfirmado: false,
  documentos: [], correcoes: [],
});
const render = (mensalidades: Props["matriculas"][number]["mensalidadesExibidas"]) =>
  renderToStaticMarkup(createElement(SecretariaPainel, { secretaria: true, matriculas: [matricula(mensalidades)] }));
const tabela = (html: string) => html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? "";

describe("SecretariaPainel — período e vencimento das mensalidades", () => {
  it("período e vencimento saem em dd/mm/aaaa, sem data ISO", () => {
    const html = render([{ id: "c1", versao: 1, valor: "350.00", moeda: "BRL", inicio: "2026-03-01", fim: "2026-03-31", vencimento: "2026-03-10" }]);
    const corpo = tabela(html);
    expect(corpo).toContain("01/03/2026 até 31/03/2026");
    expect(corpo).toContain("10/03/2026");
    expect(corpo).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("sem início ou fim, a linha diz que a cobertura está pendente, sem data crua", () => {
    const corpo = tabela(render([{ id: "c1", versao: 1, valor: "350.00", moeda: "BRL", inicio: "2026-03-01", fim: null, vencimento: "2026-03-10" }]));
    expect(corpo).toContain("Cobertura pendente de conferência");
    expect(corpo).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
