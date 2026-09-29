import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tx: {} as Record<string, Record<string, ReturnType<typeof vi.fn>>> }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  numeroWhatsApp: { findFirst: vi.fn().mockResolvedValue({ id: "linha", finalidade: "VENDAS", donoId: "v1" }) },
  $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
} }));
vi.mock("./despachante", () => ({ despacharFila: vi.fn() }));

import { garantirContato } from "./identidade";
import { processarMensagemNormalizada } from "./inbound";
import { nomeConhecidoDoContato, nomeDoAtendimento, nomeDoContato } from "./nome-contato";

// Nome do contato (bug de produção 29/09/2026): a mensagem enviada pelo celular da linha (fromMe)
// traz no pushName o perfil de QUEM ENVIOU. Gravado como nome do contato, todas as conversas
// iniciadas pelo celular apareciam com o nome do dono da linha. Agora o nome dado pelo ERP
// (`nomeExibicao`) e o perfil do contato (`nomePerfil`) moram em colunas separadas.

type ContatoGravado = { id: string; telefoneE164: string; waId: string | null; nomeExibicao: string | null;
  nomePerfil: string | null; alunoId: string | null; responsavelId: string | null; leadId: string | null };
const contaminado: ContatoGravado = { id: "contato", telefoneE164: "+5511911600554", waId: "5511911600554", nomeExibicao: null,
  nomePerfil: "Diogenes Mendes", alunoId: null, responsavelId: null, leadId: null };

function txContato(existente: ContatoGravado | null) {
  return {
    findUnique: vi.fn().mockResolvedValue(existente),
    create: vi.fn().mockImplementation(async ({ data }) => ({ id: "contato", ...data })),
    update: vi.fn().mockImplementation(async ({ data }) => ({ ...existente, ...data })),
  };
}

describe("garantirContato — nome do ERP × nome de perfil", () => {
  it("perfil recebido substitui o perfil anterior; nome do ERP não é tocado", async () => {
    const contatoWhatsApp = txContato({ ...contaminado, nomeExibicao: "Financeiro ACME" });
    await garantirContato({ contatoWhatsApp } as never, { telefoneE164: contaminado.telefoneE164, nomePerfil: " Victor " });
    expect(contatoWhatsApp.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nomeExibicao: "Financeiro ACME", nomePerfil: "Victor" }) }));
  });

  it("sem perfil (ou em branco), o perfil gravado fica; nome do ERP só preenche vazio", async () => {
    const contatoWhatsApp = txContato(contaminado);
    await garantirContato({ contatoWhatsApp } as never, { telefoneE164: contaminado.telefoneE164, nomeExibicao: "Gestor comercial", nomePerfil: "  " });
    expect(contatoWhatsApp.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nomeExibicao: "Gestor comercial", nomePerfil: undefined }) }));
  });
});

describe("processarMensagemNormalizada — pushName", () => {
  // O recorte termina logo depois do contato (upsert da conversa rejeita): o resto da ingestão
  // tem cobertura própria; aqui só interessa o que foi gravado no contato.
  const parar = new Error("fim do recorte");
  const preparar = (existente: ContatoGravado | null) => {
    m.tx = { contatoWhatsApp: txContato(existente), conversaWhatsApp: { upsert: vi.fn().mockRejectedValue(parar) } };
  };
  const mensagem = (fromMe: boolean, nome = "Diogenes Mendes") => processarMensagemNormalizada({
    numeroProviderRef: "linha", contatoWaId: "5511911600554", nomeExibicao: nome,
    providerMessageId: "M1", corpo: "Bom dia", tipo: "TEXTO", driver: "BAILEYS", fromMe, quando: new Date(),
  });
  beforeEach(() => preparar(null));

  it("fromMe em contato novo: nem nome do ERP nem perfil", async () => {
    await expect(mensagem(true)).rejects.toBe(parar);
    expect(m.tx.contatoWhatsApp.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nomeExibicao: null, nomePerfil: null }) });
  });

  it("fromMe em contato existente não mexe no perfil", async () => {
    preparar({ ...contaminado, nomePerfil: "Victor" });
    await expect(mensagem(true)).rejects.toBe(parar);
    const { data } = m.tx.contatoWhatsApp.update.mock.calls[0][0];
    expect(data.nomePerfil).toBeUndefined();
    expect(data.nomeExibicao).toBeUndefined();
  });

  it("mensagem recebida corrige o perfil contaminado do contato existente", async () => {
    preparar(contaminado);
    await expect(mensagem(false, "Victor Maruyama")).rejects.toBe(parar);
    expect(m.tx.contatoWhatsApp.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nomePerfil: "Victor Maruyama" }) }));
  });
});

describe("nomeDoContato / nomeConhecidoDoContato", () => {
  const c = { nomeExibicao: null as string | null, nomePerfil: null as string | null, telefoneE164: "+5511911600554" };
  it("nome do ERP → perfil → número", () => {
    expect(nomeDoContato({ ...c, nomeExibicao: "Financeiro ACME", nomePerfil: "Joca" })).toBe("Financeiro ACME");
    expect(nomeDoContato({ ...c, nomeExibicao: " ", nomePerfil: "Joca" })).toBe("Joca");
    expect(nomeDoContato(c)).toBe("+5511911600554");
    expect(nomeConhecidoDoContato(c)).toBeNull();
    expect(nomeConhecidoDoContato({ ...c, nomePerfil: "Joca" })).toBe("Joca");
  });
});

describe("nomeDoAtendimento", () => {
  const contato = { nomeExibicao: null as string | null, nomePerfil: null as string | null, telefoneE164: "+5511911600554",
    responsavel: null as { nome: string } | null };
  const at = (over: Partial<Parameters<typeof nomeDoAtendimento>[0]> = {}, c: Partial<typeof contato> = {}) =>
    nomeDoAtendimento({ finalidade: "SECRETARIA", aluno: null, lead: null, conversa: { contato: { ...contato, ...c } }, ...over });

  it("cadastro do ERP primeiro: aluno, lead, responsável do contato", () => {
    expect(at({ aluno: { primeiroNome: "Ana", sobrenome: "Souza" }, lead: { nome: "Lead" } }, { nomePerfil: "Perfil" })).toBe("Ana Souza");
    expect(at({ lead: { nome: "Lead" } }, { nomePerfil: "Perfil", responsavel: { nome: "Resp" } })).toBe("Lead");
    expect(at({}, { nomePerfil: "Perfil", responsavel: { nome: "Resp" } })).toBe("Resp");
  });

  it("comercial não mostra o nome do responsável do cadastro", () => {
    expect(at({ finalidade: "COMERCIAL" }, { nomePerfil: "Perfil", responsavel: { nome: "Resp" } })).toBe("Perfil");
  });

  it("sem cadastro: perfil; sem perfil: o número — nunca um rótulo genérico", () => {
    expect(at({}, { nomePerfil: "Victor" })).toBe("Victor");
    expect(at()).toBe("+5511911600554");
  });

  it("pedagógico sem cadastro não expõe perfil nem telefone", () => {
    expect(at({ finalidade: "PEDAGOGICO" }, { nomePerfil: "Perfil" })).toBe("Atendimento pedagógico");
  });
});
