import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-documental", () => ({ consultarDocumentosDesistenciaPreparacao: mocks.consulta }));
import Page from "./page";
const dado = {
  matricula: { id: "m", codigo: "MAT-596" }, pedido: { id: "pedido", versao: 2 },
  documentos: [{ id: "documento-interno", categoria: "CONTRATO", nome: "Contrato original" }],
  processos: [{ id: "processo-interno", estado: "CANCELADO", fornecedor: "Serviço de teste", ambiente: "SANDBOX",
    referenciaExternaPresente: true, conclusaoRegistrada: true, cancelamentoSubstituicao: { situacao: "RESULTADO_CONFIRMADO" } }],
  pendencias: ["Conferir a conclusão contratual registrada."], possuiPendenciaDocumental: true,
};
describe("conferência documental da desistência", () => {
  it("restringe Secretaria/Admin e distingue cancelamento de substituição de desistência", async () => {
    mocks.consulta.mockResolvedValue({ ok: true, dado });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m/a?" }) }));
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consulta).toHaveBeenCalledWith({ matriculaId: "m/a?" });
    expect(html).toContain("MAT-596");
    expect(html).toContain("Contrato original");
    expect(html).toContain("Conferir a conclusão contratual registrada.");
    expect(html).toContain("Essa confirmação não autoriza a desistência");
    expect(html).toContain("Conclusão das assinaturas registrada");
    expect(html).toContain("Ambiente: Teste");
    expect(html).toContain("/matriculas/m%2Fa%3F/desistencia");
    expect(html).not.toContain("processo-interno");
    expect(html).not.toContain("documento-interno");
    expect(html).not.toContain("<form");
  });
  it("não transforma ausência de registros em autorização", async () => {
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, pedido: null, documentos: [], processos: [], pendencias: [], possuiPendenciaDocumental: false } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).toContain("Ainda não existe pedido");
    expect(html).toContain("conferir os canais externos");
    expect(html).toContain("Nenhum processo de assinatura");
    expect(html).not.toContain("<form");
  });
  it("mostra erro sem documentos nem estados de autorização", async () => {
    mocks.consulta.mockResolvedValue({ ok: false, erro: "Acesso negado." });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Acesso negado.");
    expect(html).not.toContain("Contrato original");
    expect(html).not.toContain("Nenhuma pendência");
  });
});
