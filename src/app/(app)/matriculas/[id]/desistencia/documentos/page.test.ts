import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), integracao: vi.fn().mockResolvedValue({ ok: true, dado: null }), preparacao: vi.fn().mockResolvedValue({ ok: true, dado: null }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-documental", () => ({ consultarDocumentosDesistenciaPreparacao: mocks.consulta }));
vi.mock("@/server/contratos/envio", () => ({ consultarIntegracaoAssinatura: mocks.integracao }));
vi.mock("@/server/matricula/desistencia-preparacao", () => ({ consultarDesistenciaPreparacao: mocks.preparacao }));
vi.mock("./CancelarAssinatura", () => ({ CancelarAssinatura: (p: { pedidoId: string; processoId: string; estadoHash: string }) => `[cancelar:${p.pedidoId}:${p.processoId}:${p.estadoHash.slice(0, 3)}]` }));
import Page from "./page";
const dado = {
  matricula: { id: "m", codigo: "MAT-596" }, pedido: { id: "pedido", versao: 2 },
  documentos: [{ id: "documento-interno", categoria: "CONTRATO", nome: "Contrato original" }],
  processos: [{ id: "processo-interno", estado: "CANCELADO", fornecedor: "Serviço de teste", ambiente: "SANDBOX",
    referenciaExternaPresente: true, conclusaoRegistrada: true, cancelamentoSubstituicao: { situacao: "RESULTADO_CONFIRMADO" }, cancelamentoDesistencia: { situacao: "NAO_INICIADO" } }],
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
  it("oferece o cancelamento integrado só com driver do mesmo serviço, pedido atual sem efetivação e envio aberto sem conclusão", async () => {
    const enviado = { ...dado.processos[0], id: "aberto", estado: "ENVIADO", fornecedor: "SIMULADO", conclusaoRegistrada: false };
    const aberto = { ...dado, processos: [enviado, dado.processos[0], { ...enviado, id: "real", fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }] };
    const preparacao = { ok: true, dado: { efetivacao: null, pedidos: [{ id: "pedido", estadoHash: "abc".padEnd(64, "0") }] } };
    mocks.consulta.mockResolvedValue({ ok: true, dado: aberto });
    mocks.preparacao.mockResolvedValue(preparacao);
    expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }))).not.toContain("[cancelar:");
    mocks.integracao.mockResolvedValue({ ok: true, dado: { fornecedor: "SIMULADO", ambiente: "SANDBOX", simulado: true } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html.match(/\[cancelar:/g)).toEqual(["[cancelar:"]);
    expect(html).toContain("[cancelar:pedido:aberto:abc]");
    expect(html).toContain("Integração de assinatura SIMULADA");
    expect(html).toContain("Simulado (nenhum documento sai do ERP)");
    mocks.preparacao.mockResolvedValue({ ok: true, dado: { ...preparacao.dado, efetivacao: { pedidoId: "pedido" } } });
    expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }))).not.toContain("[cancelar:");
    mocks.preparacao.mockResolvedValue({ ok: true, dado: { efetivacao: null, pedidos: [{ id: "outro", estadoHash: "f".repeat(64) }] } });
    expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }))).not.toContain("[cancelar:");
    mocks.integracao.mockResolvedValue({ ok: true, dado: null }); mocks.preparacao.mockResolvedValue({ ok: true, dado: null });
  });
  it("mostra o andamento do cancelamento por desistência separado do de substituição", async () => {
    const processo = { ...dado.processos[0], estado: "ENVIADO", conclusaoRegistrada: false, cancelamentoSubstituicao: { situacao: "NAO_INICIADO" }, cancelamentoDesistencia: { situacao: "RESULTADO_INCERTO" } };
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, processos: [processo] } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).toContain("Cancelamento por desistência com resultado incerto");
    expect(html).toContain("Nenhum cancelamento para substituição registrado.");
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
