import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consultarEnvelopeSemPresumir, criarEnvelopeSemPresumir, criarProvedorSimulado, hashEvidenciaAssinatura, provedorAssinaturaAtivo, type ProvedorAssinatura } from "./provedor-assinatura";

const pdf = new TextEncoder().encode("%PDF-simulado"), pdfHash = createHash("sha256").update(pdf).digest("hex");
const envelope = (ajustes: Record<string, unknown> = {}) => ({ chave: "tentativa:t1", nome: "Contrato M-1", pdf, pdfHash,
  signatarios: [{ papel: "ALUNO", etapa: 1, nome: "Ana", email: "ana@example.com" }, { papel: "REPRESENTANTE_ESCOLA", etapa: 2, nome: "Escola", email: "escola@example.com" }], ...ajustes });

describe("provedor simulado", () => {
  it("cria uma única vez por chave e devolve a mesma referência na repetição", async () => {
    const p = criarProvedorSimulado();
    const primeiro = await p.criarEnvelope(envelope()), repetido = await p.criarEnvelope(envelope());
    expect(primeiro).toMatchObject({ resultado: "REGISTRADO" });
    expect(repetido).toMatchObject({ resultado: "REGISTRADO", referenciaExterna: (primeiro as { referenciaExterna: string }).referenciaExterna });
    expect(await p.consultarPorChave("tentativa:t1")).toMatchObject({ resultado: "ENCONTRADO", situacao: "EM_ASSINATURA" });
    expect(await p.consultarPorChave("tentativa:outra")).toMatchObject({ resultado: "AUSENTE" });
  });

  it("recusa com prova positiva PDF divergente, envelope sem signatários e chave reutilizada", async () => {
    const p = criarProvedorSimulado();
    expect(await p.criarEnvelope(envelope({ pdfHash: "0".repeat(64) }))).toMatchObject({ resultado: "NAO_CRIADO", evidencia: { motivo: "PDF_DIVERGENTE" } });
    expect(await p.criarEnvelope(envelope({ signatarios: [] }))).toMatchObject({ resultado: "NAO_CRIADO" });
    await p.criarEnvelope(envelope());
    const outro = new TextEncoder().encode("%PDF-outro");
    expect(await p.criarEnvelope(envelope({ pdf: outro, pdfHash: createHash("sha256").update(outro).digest("hex") }))).toMatchObject({ resultado: "NAO_CRIADO", evidencia: { motivo: "CHAVE_USADA_COM_OUTRO_DOCUMENTO" } });
  });

  it("cancela enquanto em assinatura, entrega o assinado e não cancela depois de assinado", async () => {
    const p = criarProvedorSimulado();
    const { referenciaExterna } = await p.criarEnvelope(envelope()) as { referenciaExterna: string };
    expect(await p.baixarAssinado(referenciaExterna)).toBeNull();
    p.assinarTudo(referenciaExterna);
    expect((await p.baixarAssinado(referenciaExterna))?.pdf).toEqual(pdf);
    expect(await p.cancelarEnvelope(referenciaExterna)).toMatchObject({ resultado: "NAO_CANCELAVEL" });
    const b = await p.criarEnvelope(envelope({ chave: "tentativa:t2" })) as { referenciaExterna: string };
    expect(await p.cancelarEnvelope(b.referenciaExterna)).toMatchObject({ resultado: "CANCELADO" });
    expect(await p.cancelarEnvelope("desconhecida")).toMatchObject({ resultado: "INCERTO" });
  });
});

describe("chamadas sem presunção", () => {
  const quebrado = { ...criarProvedorSimulado(), criarEnvelope: async () => { throw new Error("timeout"); }, consultarPorChave: async () => { throw new Error("rede"); } } as ProvedorAssinatura;
  it("exceção do driver é incerteza, nunca ausência", async () => {
    expect(await criarEnvelopeSemPresumir(quebrado, envelope())).toEqual({ resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER", mensagem: "timeout" } });
    expect(await consultarEnvelopeSemPresumir(quebrado, "tentativa:t1")).toMatchObject({ resultado: "INCERTO" });
  });
  it("referência vazia não confirma criação", async () => {
    const vazio = { ...criarProvedorSimulado(), criarEnvelope: async () => ({ resultado: "REGISTRADO" as const, referenciaExterna: " ", evidencia: {} }) } as ProvedorAssinatura;
    expect(await criarEnvelopeSemPresumir(vazio, envelope())).toMatchObject({ resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA" } });
  });
  it("hash de evidência é estável e hexadecimal", () => {
    expect(hashEvidenciaAssinatura({ a: 1 })).toBe(hashEvidenciaAssinatura({ a: 1 }));
    expect(hashEvidenciaAssinatura(undefined)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("provedorAssinaturaAtivo", () => {
  it("sem driver não há integração; simulado só fora de produção; desconhecido falha", () => {
    expect(provedorAssinaturaAtivo({})).toBeNull();
    expect(provedorAssinaturaAtivo({ ASSINATURA_DRIVER: "simulado", NODE_ENV: "test" })).toMatchObject({ fornecedor: "ZAPSIGN", ambiente: "SANDBOX" });
    expect(() => provedorAssinaturaAtivo({ ASSINATURA_DRIVER: "simulado", NODE_ENV: "production" })).toThrow(/produção/);
    expect(() => provedorAssinaturaAtivo({ ASSINATURA_DRIVER: "zapsign" })).toThrow(/Q155/);
  });
});
