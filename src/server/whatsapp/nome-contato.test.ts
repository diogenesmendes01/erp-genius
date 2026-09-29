import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tx: {} as Record<string, Record<string, ReturnType<typeof vi.fn>>> }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  numeroWhatsApp: { findFirst: vi.fn().mockResolvedValue({ id: "linha", finalidade: "VENDAS", donoId: "v1" }) },
  $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
} }));
vi.mock("./despachante", () => ({ despacharFila: vi.fn() }));

import { nomeExibicaoAtualizado } from "./identidade";
import { processarMensagemNormalizada } from "./inbound";
import { nomeDoAtendimento } from "./consultas-inbox";

// Nome do contato na inbox (bug de produção 29/09/2026): a mensagem enviada pelo celular da linha
// (fromMe) traz no pushName o perfil de QUEM ENVIOU. Gravado como nome do contato, todas as
// conversas iniciadas pelo celular apareciam com o nome do dono da linha.

const semVinculo = { nomeExibicao: null, alunoId: null, responsavelId: null, leadId: null };

describe("nomeExibicaoAtualizado", () => {
  it("perfil do contato preenche nome vazio e atualiza contato sem vínculo", () => {
    expect(nomeExibicaoAtualizado(semVinculo, { nomePerfil: "Victor" })).toBe("Victor");
    expect(nomeExibicaoAtualizado({ ...semVinculo, nomeExibicao: "Diogenes Mendes" }, { nomePerfil: "Victor" })).toBe("Victor");
  });

  it("contato vinculado no ERP mantém o nome do cadastro", () => {
    expect(nomeExibicaoAtualizado({ ...semVinculo, nomeExibicao: "Ana Souza", responsavelId: "r1" }, { nomePerfil: "Aninha" })).toBe("Ana Souza");
    expect(nomeExibicaoAtualizado({ ...semVinculo, leadId: "l1" }, { nomePerfil: "Aninha" })).toBe("Aninha");
  });

  it("sem perfil, nome do cadastro só preenche vazio; perfil em branco não conta", () => {
    expect(nomeExibicaoAtualizado({ ...semVinculo, nomeExibicao: "Antigo" }, { nomeExibicao: "Novo" })).toBe("Antigo");
    expect(nomeExibicaoAtualizado(semVinculo, { nomeExibicao: "Novo" })).toBe("Novo");
    expect(nomeExibicaoAtualizado({ ...semVinculo, nomeExibicao: "Antigo" }, { nomePerfil: "  " })).toBe("Antigo");
  });
});

describe("processarMensagemNormalizada — pushName", () => {
  const parar = new Error("fim do recorte");
  beforeEach(() => {
    m.tx = {
      contatoWhatsApp: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "contato" }), update: vi.fn() },
      // O recorte termina depois do contato: o resto da ingestão não interessa aqui.
      conversaWhatsApp: { upsert: vi.fn().mockRejectedValue(parar) },
    };
  });
  const mensagem = (fromMe: boolean) => processarMensagemNormalizada({
    numeroProviderRef: "linha", contatoWaId: "5511911600554", nomeExibicao: "Diogenes Mendes",
    providerMessageId: "M1", corpo: "Bom dia", tipo: "TEXTO", driver: "BAILEYS", fromMe, quando: new Date(),
  });

  it("mensagem enviada pelo celular da linha (fromMe) não dá nome ao contato", async () => {
    await expect(mensagem(true)).rejects.toBe(parar);
    expect(m.tx.contatoWhatsApp.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nomeExibicao: null }) });
  });

  it("mensagem recebida do contato usa o nome de perfil dele", async () => {
    await expect(mensagem(false)).rejects.toBe(parar);
    expect(m.tx.contatoWhatsApp.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nomeExibicao: "Diogenes Mendes" }) });
  });
});

describe("nomeDoAtendimento", () => {
  const contato = { nomeExibicao: null as string | null, telefoneE164: "+5511911600554", responsavel: null as { nome: string } | null };
  const at = (over: Partial<Parameters<typeof nomeDoAtendimento>[0]> = {}, c: Partial<typeof contato> = {}) =>
    nomeDoAtendimento({ finalidade: "COMERCIAL", aluno: null, lead: null, conversa: { contato: { ...contato, ...c } }, ...over });

  it("cadastro do ERP primeiro: aluno, lead, responsável do contato", () => {
    expect(at({ aluno: { primeiroNome: "Ana", sobrenome: "Souza" }, lead: { nome: "Lead" } }, { nomeExibicao: "Perfil" })).toBe("Ana Souza");
    expect(at({ lead: { nome: "Lead" } }, { nomeExibicao: "Perfil", responsavel: { nome: "Resp" } })).toBe("Lead");
    expect(at({}, { nomeExibicao: "Perfil", responsavel: { nome: "Resp" } })).toBe("Resp");
  });

  it("sem cadastro: nome de perfil; sem perfil: o número — nunca um rótulo genérico", () => {
    expect(at({}, { nomeExibicao: "Victor" })).toBe("Victor");
    expect(at()).toBe("+5511911600554");
    expect(at({}, { nomeExibicao: "  " })).toBe("+5511911600554");
  });

  it("pedagógico sem cadastro não expõe perfil nem telefone", () => {
    expect(at({ finalidade: "PEDAGOGICO" }, { nomeExibicao: "Perfil" })).toBe("Atendimento pedagógico");
  });
});
