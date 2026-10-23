import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelarEnvelopeSemPresumir, consultarEnvelopeSemPresumir, criarEnvelopeSemPresumir, DestinoAssinaturaSchema,
  hashEvidenciaAssinatura, resultadoConciliacaoEnvio, conciliacaoLiberada, PRAZO_CONCILIACAO_ENVIANDO_MS, TIMEOUT_CRIACAO_ENVELOPE_MS, type ProvedorAssinatura, type SituacaoEnvelope,
} from "./provedor-assinatura";
import { armazemSimuladoEmMemoria, criarProvedorSimulado, referenciaSimulada } from "./provedor-assinatura-simulado";
import { lerDriverAssinatura } from "./provedor-assinatura-ativo";

const pdf = new TextEncoder().encode("%PDF-simulado"), pdfHash = createHash("sha256").update(pdf).digest("hex");
const envelope = (ajustes: Record<string, unknown> = {}) => ({ chave: "tentativa:t1", nome: "Contrato M-1", pdf, pdfHash,
  signatarios: [{ papel: "ALUNO", etapa: 1, nome: "Ana", email: "ana@example.com" }, { papel: "REPRESENTANTE_ESCOLA", etapa: 2, nome: "Escola", email: "escola@example.com" }], ...ajustes });
const simulado = () => criarProvedorSimulado(armazemSimuladoEmMemoria());

describe("provedor simulado", () => {
  it("identifica-se como SIMULADO em SANDBOX: nunca se passa por fornecedor real nem por produção", () => {
    expect(simulado()).toMatchObject({ fornecedor: "SIMULADO", ambiente: "SANDBOX" });
  });

  it("cria uma única vez por chave e devolve a mesma referência na repetição", async () => {
    const p = simulado();
    const primeiro = await p.criarEnvelope(envelope()), repetido = await p.criarEnvelope(envelope());
    expect(primeiro).toEqual({ resultado: "REGISTRADO", referenciaExterna: referenciaSimulada("tentativa:t1"), evidencia: { simulado: true, signatarios: 2 } });
    expect(referenciaSimulada("tentativa:t1")).toMatch(/^sim_[a-f0-9]{24}$/);
    expect(repetido).toMatchObject({ resultado: "REGISTRADO", referenciaExterna: referenciaSimulada("tentativa:t1"), evidencia: { repetido: true } });
    expect(await p.consultarPorChave("tentativa:t1")).toMatchObject({ resultado: "ENCONTRADO", situacao: "EM_ASSINATURA", referenciaExterna: referenciaSimulada("tentativa:t1") });
    expect(await p.consultarPorChave("tentativa:outra")).toMatchObject({ resultado: "AUSENTE" });
  });

  it("recusa com prova positiva PDF divergente, envelope sem signatários e chave reutilizada com outro documento", async () => {
    const p = simulado();
    expect(await p.criarEnvelope(envelope({ pdfHash: "0".repeat(64) }))).toMatchObject({ resultado: "NAO_CRIADO", evidencia: { motivo: "PDF_DIVERGENTE" } });
    expect(await p.criarEnvelope(envelope({ signatarios: [] }))).toMatchObject({ resultado: "NAO_CRIADO", evidencia: { motivo: "SEM_SIGNATARIOS" } });
    await p.criarEnvelope(envelope());
    const outro = new TextEncoder().encode("%PDF-outro");
    expect(await p.criarEnvelope(envelope({ pdf: outro, pdfHash: createHash("sha256").update(outro).digest("hex") })))
      .toMatchObject({ resultado: "NAO_CRIADO", evidencia: { motivo: "CHAVE_USADA_COM_OUTRO_DOCUMENTO" } });
  });

  it("cancela enquanto em assinatura (de forma idempotente), entrega o assinado e não cancela depois de assinado", async () => {
    const p = simulado();
    const { referenciaExterna } = await p.criarEnvelope(envelope()) as { referenciaExterna: string };
    expect(await p.baixarAssinado(referenciaExterna)).toBeNull();
    await p.simularAssinatura(referenciaExterna);
    expect((await p.baixarAssinado(referenciaExterna))?.pdf).toEqual(pdf);
    expect(await p.cancelarEnvelope(referenciaExterna)).toMatchObject({ resultado: "NAO_CANCELAVEL" });
    const b = await p.criarEnvelope(envelope({ chave: "tentativa:t2" })) as { referenciaExterna: string };
    expect(await p.cancelarEnvelope(b.referenciaExterna)).toMatchObject({ resultado: "CANCELADO" });
    // Repetição devolve exatamente a mesma evidência (o hash gravado não varia entre chamadas iguais).
    expect(await p.cancelarEnvelope(b.referenciaExterna)).toEqual({ resultado: "CANCELADO", evidencia: { simulado: true } });
    expect(await p.consultarPorChave("tentativa:t2")).toMatchObject({ situacao: "CANCELADO" });
    expect(await p.cancelarEnvelope("desconhecida")).toMatchObject({ resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_DESCONHECIDA" } });
  });
});

describe("chamadas sem presunção", () => {
  const quebrado = {
    ...simulado(),
    criarEnvelope: async () => { throw new Error("timeout"); },
    consultarPorChave: async () => { throw new Error("rede"); },
    cancelarEnvelope: async () => { throw new Error("rede"); },
  } as ProvedorAssinatura;
  it("exceção do driver é incerteza, nunca ausência", async () => {
    expect(await criarEnvelopeSemPresumir(quebrado, envelope())).toEqual({ resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER", mensagem: "timeout" } });
    expect(await consultarEnvelopeSemPresumir(quebrado, "tentativa:t1")).toMatchObject({ resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER" } });
    expect(await cancelarEnvelopeSemPresumir(quebrado, "sim_x")).toMatchObject({ resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER" } });
  });
  it("criação que passa do prazo é INCERTO (timeout explícito do port)", async () => {
    const lento = { ...simulado(), criarEnvelope: () => new Promise(() => {}) } as unknown as ProvedorAssinatura;
    expect(await criarEnvelopeSemPresumir(lento, envelope(), 20)).toEqual({ resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER", mensagem: "TIMEOUT_CRIACAO_ENVELOPE" } });
  });
  it("referência vazia não confirma criação nem localização", async () => {
    const vazio = { ...simulado(),
      criarEnvelope: async () => ({ resultado: "REGISTRADO" as const, referenciaExterna: " ", evidencia: {} }),
      consultarPorChave: async () => ({ resultado: "ENCONTRADO" as const, referenciaExterna: "", situacao: "EM_ASSINATURA" as const, evidencia: {} }),
    } as ProvedorAssinatura;
    expect(await criarEnvelopeSemPresumir(vazio, envelope())).toMatchObject({ resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA" } });
    expect(await consultarEnvelopeSemPresumir(vazio, "tentativa:t1")).toMatchObject({ resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA" } });
  });
  it("hash de evidência é estável e hexadecimal", () => {
    expect(hashEvidenciaAssinatura({ a: 1 })).toBe(hashEvidenciaAssinatura({ a: 1 }));
    expect(hashEvidenciaAssinatura(undefined)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("conciliação do envio pela situação do envelope (R1 C2)", () => {
  // Driver fake que devolve cada situação na consulta pela chave.
  const fake = (situacao: SituacaoEnvelope) => ({ ...simulado(),
    consultarPorChave: async () => ({ resultado: "ENCONTRADO" as const, referenciaExterna: "ref-1", situacao, evidencia: { fake: true } }) }) as ProvedorAssinatura;
  it.each(["EM_ASSINATURA", "ASSINADO"] as const)("%s confirma o envio com a referência", async (situacao) => {
    expect(resultadoConciliacaoEnvio(await consultarEnvelopeSemPresumir(fake(situacao), "tentativa:t1"))).toEqual({ resultado: "REGISTRADO", referenciaExterna: "ref-1", evidencia: { fake: true } });
  });
  it.each([["CANCELADO", "ENVELOPE_CANCELADO_NO_SERVICO"], ["RECUSADO", "ENVELOPE_RECUSADO_NO_SERVICO"]] as const)("%s não vira ENVIADO: fica INCERTO com motivo explícito", async (situacao, motivo) => {
    expect(resultadoConciliacaoEnvio(await consultarEnvelopeSemPresumir(fake(situacao), "tentativa:t1"))).toEqual({ resultado: "INCERTO", referenciaExterna: null,
      evidencia: { motivo, referenciaExterna: "ref-1", situacao, original: { fake: true } } });
  });
  it("ausência positiva é NAO_CRIADO; dúvida segue INCERTO", () => {
    expect(resultadoConciliacaoEnvio({ resultado: "AUSENTE", evidencia: {} })).toMatchObject({ resultado: "NAO_CRIADO", referenciaExterna: null });
    expect(resultadoConciliacaoEnvio({ resultado: "INCERTO", evidencia: {} })).toMatchObject({ resultado: "INCERTO", referenciaExterna: null });
  });
});

describe("conciliação liberada (B-1 da revisão rigorosa)", () => {
  const agora = new Date("2026-10-21T12:00:00Z");
  it("o prazo de ENVIANDO é maior que o timeout da criação", () => {
    expect(PRAZO_CONCILIACAO_ENVIANDO_MS).toBeGreaterThan(TIMEOUT_CRIACAO_ENVELOPE_MS);
  });
  it("ENVIO_INCERTO sempre; ENVIANDO só depois do prazo; outros estados nunca", () => {
    expect(conciliacaoLiberada("ENVIO_INCERTO", agora, agora)).toEqual({ liberada: true });
    expect(conciliacaoLiberada("ENVIANDO", new Date(agora.getTime() - 60_000), agora)).toEqual({ liberada: false, minutos: 9 });
    expect(conciliacaoLiberada("ENVIANDO", new Date(agora.getTime() - PRAZO_CONCILIACAO_ENVIANDO_MS), agora)).toEqual({ liberada: true });
    expect(conciliacaoLiberada("ENVIANDO", null, agora)).toEqual({ liberada: false, minutos: null });
    expect(conciliacaoLiberada("ENVIADO", agora, agora)).toEqual({ liberada: false, minutos: null });
  });
});

describe("destino do processo", () => {
  it("SIMULADO só existe em SANDBOX", () => {
    expect(DestinoAssinaturaSchema.safeParse({ fornecedor: "SIMULADO", ambiente: "SANDBOX" }).success).toBe(true);
    expect(DestinoAssinaturaSchema.safeParse({ fornecedor: "SIMULADO", ambiente: "PRODUCAO" }).success).toBe(false);
    expect(DestinoAssinaturaSchema.safeParse({ fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }).success).toBe(true);
    expect(DestinoAssinaturaSchema.safeParse({ fornecedor: "OUTRO", ambiente: "SANDBOX" }).success).toBe(false);
  });
});

describe("driver ativo (ASSINATURA_DRIVER)", () => {
  afterEach(() => vi.restoreAllMocks());
  it("vazio é registro manual; simulado só por valor explícito; desconhecido falha alto sem expor o valor", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(lerDriverAssinatura({})).toEqual({ tipo: "MANUAL" });
    expect(lerDriverAssinatura({ ASSINATURA_DRIVER: "  " })).toEqual({ tipo: "MANUAL" });
    expect(lerDriverAssinatura({ ASSINATURA_DRIVER: "simulado", NODE_ENV: "test" })).toEqual({ tipo: "SIMULADO" });
    expect(lerDriverAssinatura({ ASSINATURA_DRIVER: " SIMULADO " })).toEqual({ tipo: "SIMULADO" });
    expect(() => lerDriverAssinatura({ ASSINATURA_DRIVER: "zapsign" })).toThrow(/Q155/);
    expect(() => lerDriverAssinatura({ ASSINATURA_DRIVER: "valor-secreto" })).toThrow(/mal configurada/);
    expect(() => lerDriverAssinatura({ ASSINATURA_DRIVER: "valor-secreto" })).not.toThrow(/valor-secreto/);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("valor-secreto"));
  });
  it("em produção o simulado continua explícito e avisa no log, sem se passar por fornecedor real", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(lerDriverAssinatura({ ASSINATURA_DRIVER: "simulado", NODE_ENV: "production" })).toEqual({ tipo: "SIMULADO" });
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("SIMULADO"));
  });
});
