import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, acao } = vi.hoisted(() => ({ authMock: vi.fn(), acao: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./acoes", () => ({ executarAcaoMotor: acao }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "../atendimentos";
import { alterarParticipantesGrupo, bloquearContatoWhatsApp, criarGrupoWhatsApp } from "./acoes-mensagem";
import { ErroMotor } from "./cliente";
import { MSG_MOTOR_DESCONECTADO } from "./capacidades";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); acao.mockReset(); acao.mockResolvedValue({}); });
const comoUsuario = async <T,>(u: { id: string }, f: () => Promise<T>) => { authMock.mockResolvedValue({ user: { id: u.id } }); return f(); };
const evento = (tipo: string) => prisma.evento.findFirst({ where: { tipo } });

async function cenario() {
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990002", setores: ["COMERCIAL", "FINANCEIRO", "SECRETARIA"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono")).id });
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: numero.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777", waId: "50688887777" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: vendedor.id }));
  return { gerente, vendedor, financeiro, secretaria, numero, contato, at };
}

describe("bloquear contato pelo motor", () => {
  it("VENDEDOR não bloqueia: 'Sem permissão para bloquear contatos.' e o motor não é chamado", async () => {
    const c = await cenario();
    const r = await comoUsuario(c.vendedor, () => bloquearContatoWhatsApp({ atendimentoId: c.at.id, motivo: "Mensagens ofensivas repetidas" }));
    expect(r).toMatchObject({ ok: false, erro: "Sem permissão para bloquear contatos." });
    expect(acao).not.toHaveBeenCalled();
    expect(await evento("ContatoWhatsAppBloqueado")).toBeNull();
  });
  it("bloquear sem motivo: 'Informe o motivo do bloqueio (mínimo 10 caracteres).'", async () => {
    const c = await cenario();
    const r = await comoUsuario(c.gerente, () => bloquearContatoWhatsApp({ atendimentoId: c.at.id, motivo: "curto" }));
    expect(r).toMatchObject({ ok: false, erro: "Informe o motivo do bloqueio (mínimo 10 caracteres)." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("gerente bloqueia: contact.block com o JID do contato e Evento com motivo", async () => {
    const c = await cenario();
    const r = await comoUsuario(c.gerente, () => bloquearContatoWhatsApp({ atendimentoId: c.at.id, motivo: "Mensagens ofensivas repetidas" }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(c.numero.id, "contact.block", { contactId: "50688887777@s.whatsapp.net", value: true });
    expect(await evento("ContatoWhatsAppBloqueado")).toMatchObject({ payload: { motivo: "Mensagens ofensivas repetidas" } });
  });
  it("desbloquear envia value=false e grava ContatoWhatsAppDesbloqueado", async () => {
    const c = await cenario();
    const r = await comoUsuario(c.gerente, () => bloquearContatoWhatsApp({ atendimentoId: c.at.id, motivo: "Acordo com a família", desbloquear: true }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(c.numero.id, "contact.block", { contactId: "50688887777@s.whatsapp.net", value: false });
    expect(await evento("ContatoWhatsAppDesbloqueado")).toMatchObject({ payload: { motivo: "Acordo com a família" } });
  });
  it("falha do motor vira mensagem amigável e não grava Evento", async () => {
    const c = await cenario();
    acao.mockRejectedValue(new ErroMotor("NAO_ENVIADO", 503));
    const r = await comoUsuario(c.gerente, () => bloquearContatoWhatsApp({ atendimentoId: c.at.id, motivo: "Mensagens ofensivas repetidas" }));
    expect(r.ok).toBe(false);
    expect(await evento("ContatoWhatsAppBloqueado")).toBeNull();
  });
});

describe("gerir grupo pelo motor", () => {
  it("Secretaria cria grupo ligado à turma e grava GrupoWhatsApp", async () => {
    const c = await cenario();
    const catalogo = await seedCatalogoMinimo();
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
    const pro = await criarUsuario([Papel.PROFESSOR]);
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, professorId: pro.id } });
    acao.mockResolvedValue({ id: "120363000000000001@g.us", subject: "Turma A1" });
    const r = await comoUsuario(c.secretaria, () => criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "Turma A1", participantesE164: ["+50688887777", "+50688886666"], turmaId: turma.id }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(c.numero.id, "group.create", { subject: "Turma A1", participants: ["50688887777@s.whatsapp.net", "50688886666@s.whatsapp.net"] });
    const g = await prisma.grupoWhatsApp.findFirstOrThrow({ where: { numeroId: c.numero.id } });
    expect(g).toMatchObject({ grupoJid: "120363000000000001@g.us", nome: "Turma A1", turmaId: turma.id });
    if (r.ok) expect(r.dado).toEqual({ grupoId: g.id });
    expect(await evento("GrupoWhatsAppCriado")).toMatchObject({ agregadoId: g.id });
  });
  it("VENDEDOR não cria grupo e o motor não é chamado", async () => {
    const c = await cenario();
    const r = await comoUsuario(c.vendedor, () => criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "X Grupo", participantesE164: ["+50688887777"] }));
    expect(r).toMatchObject({ ok: false, erro: "Sem permissão para gerir grupos." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("C6: gerente não cria grupo em número ou turma fora do escopo de grupos, e o motor não é chamado", async () => {
    const c = await cenario();
    const fin = await criarNumeroSetor({ telefoneE164: "+5511999990003", setores: ["FINANCEIRO"], finalidade: "COBRANCA" });
    await prisma.numeroWhatsApp.update({ where: { id: fin.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: fin.id } });
    const r1 = await comoUsuario(c.gerente, () => criarGrupoWhatsApp({ numeroId: fin.id, nome: "Grupo fora", participantesE164: ["+50688887777"] }));
    expect(r1).toMatchObject({ ok: false, erro: "Número ou turma fora do seu escopo." });
    const catalogo = await seedCatalogoMinimo();
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, professorId: (await criarUsuario([Papel.PROFESSOR])).id } });
    const r2 = await comoUsuario(c.gerente, () => criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "Turma fora", participantesE164: ["+50688887777"], turmaId: turma.id }));
    expect(r2).toMatchObject({ ok: false, erro: "Número ou turma fora do seu escopo." });
    expect(acao).not.toHaveBeenCalled();
    expect(await prisma.grupoWhatsApp.count()).toBe(0);
    // No número que serve ao setor dele, sem turma, o mesmo gerente cria (e o grupo cai no escopoGrupos dele).
    acao.mockResolvedValue({ id: "120363000000000009@g.us", subject: "Comercial" });
    const r3 = await comoUsuario(c.gerente, () => criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "Comercial", participantesE164: ["+50688887777"] }));
    expect(r3.ok).toBe(true);
  });
  it("atendente FINANCEIRO não altera participantes", async () => {
    const c = await cenario();
    const g = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "120363000000000002@g.us", nome: "G" } });
    const r = await comoUsuario(c.financeiro, () => alterarParticipantesGrupo({ grupoId: g.id, acao: "adicionar", participantesE164: ["+50688887777"] }));
    expect(r).toMatchObject({ ok: false, erro: "Sem permissão para gerir grupos." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("gerente remove participante: group.participants com operation e Evento", async () => {
    const c = await cenario();
    const g = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "120363000000000002@g.us", nome: "G" } });
    const r = await comoUsuario(c.gerente, () => alterarParticipantesGrupo({ grupoId: g.id, acao: "rebaixar", participantesE164: ["+50688887777"] }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(c.numero.id, "group.participants", { id: "120363000000000002@g.us", participants: ["50688887777@s.whatsapp.net"], operation: "demote" });
    expect(await evento("ParticipantesGrupoAlterados")).toMatchObject({ agregadoId: g.id, payload: { acao: "rebaixar", participantesE164: ["+50688887777"] } });
  });
  it("participante inválido e lista vazia são recusados sem chamar o motor", async () => {
    const c = await cenario();
    const r1 = await comoUsuario(c.gerente, () => criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "Grupo ok", participantesE164: ["abc"] }));
    const r2 = await comoUsuario(c.gerente, () => criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "Grupo ok", participantesE164: [] }));
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("trava de sessão do motor", () => {
  it("sessão CAIU: bloquear, criar grupo e alterar participantes recusam sem chamar o motor", async () => {
    const c = await cenario();
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { sessao: "CAIU" } });
    const g = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "120363000000000003@g.us", nome: "G" } });
    const recusa = { ok: false, erro: MSG_MOTOR_DESCONECTADO };
    await comoUsuario(c.gerente, async () => {
      expect(await bloquearContatoWhatsApp({ atendimentoId: c.at.id, motivo: "Mensagens ofensivas repetidas" })).toEqual(recusa);
      expect(await criarGrupoWhatsApp({ numeroId: c.numero.id, nome: "Grupo novo", participantesE164: ["+50688887777"] })).toEqual(recusa);
      expect(await alterarParticipantesGrupo({ grupoId: g.id, acao: "adicionar", participantesE164: ["+50688887777"] })).toEqual(recusa);
    });
    expect(acao).not.toHaveBeenCalled();
    expect(await prisma.evento.count({ where: { tipo: { in: ["ContatoWhatsAppBloqueado", "GrupoWhatsAppCriado", "ParticipantesGrupoAlterados"] } } })).toBe(0);
  });
});
