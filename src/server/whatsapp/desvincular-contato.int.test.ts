import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarAlunoMinimo, criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { carregarAcoesContatoInbox } from "./consultas-inbox";
import { desvincularContatoWhatsApp } from "./desvincular-contato";

// D8 (#175, L2298): "Desvincular contato" no Inbox. Desfaz o vínculo do contato (e, na linha de vendas, o lead do
// atendimento da linha) com motivo e evento auditado; não apaga lead, aluno, mensagens nem atendimentos.
beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });
const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const sessao = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const MOTIVO = "Vinculado à oportunidade errada pelo atendente";

async function comercial() {
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511988881000", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "inst-dv", donoId: vendedor.id },
  });
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead Errado", vendedorDonoId: vendedor.id, telefoneE164: "+50611113333" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611113333", nomeExibicao: "Cliente", leadId: lead.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: vendedor.id }));
  await prisma.mensagemWhatsApp.create({ data: { conversaId: at.conversaId, atendimentoId: at.id, numeroId: numero.id, direcao: "ENTRADA", status: "LIDA", driver: "MOTOR", corpo: "oi" } });
  return { vendedor, gerente, admin, numero, lead, contato, at };
}

async function secretaria() {
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511988882000", setores: ["SECRETARIA"] });
  const aluno = await criarAlunoMinimo({ telefoneE164: "+50611114444" });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611114444", alunoId: aluno.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "SECRETARIA", alunoId: aluno.id }));
  return { admin, gerente, sec, aluno, contato, at };
}

describe("desvincularContatoWhatsApp", () => {
  it("gerente do setor desvincula a oportunidade: contato e atendimento da linha perdem o lead, nada é apagado, evento com motivo", async () => {
    const c = await comercial();
    comoUsuario(c.gerente);
    const r = await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO });
    expect(r).toEqual({ ok: true });
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.contato.id } })).leadId).toBeNull();
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).leadId).toBeNull();
    // Não apaga dados: o lead, o atendimento e a mensagem continuam.
    expect(await prisma.oportunidade.count({ where: { id: c.lead.id } })).toBe(1);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: c.at.id } })).toBe(1);
    const eventos = await eventosDo("ContatoWhatsApp", c.contato.id);
    expect(eventos.map((e) => e.tipo)).toEqual(["ContatoDesvinculado"]);
    expect(eventos[0]).toMatchObject({ autorId: c.gerente.id });
    expect(eventos[0].payload).toMatchObject({
      alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO, atendimentoId: c.at.id,
      antes: { alunoId: null, responsavelId: null, leadId: c.lead.id }, leadDoAtendimentoRemovido: true,
    });
  });

  it("administrador desvincula o aluno no atendimento da secretaria; o contexto do atendimento fica", async () => {
    const s = await secretaria();
    comoUsuario(s.admin);
    expect(await desvincularContatoWhatsApp({ atendimentoId: s.at.id, alvo: { tipo: "aluno", id: s.aluno.id }, motivo: MOTIVO })).toEqual({ ok: true });
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: s.contato.id } })).alunoId).toBeNull();
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: s.at.id } })).alunoId).toBe(s.aluno.id);
    expect(await prisma.aluno.count({ where: { id: s.aluno.id } })).toBe(1);
  });

  it("quem não é administrador nem gerente do setor é recusado, sem mudar nada nem gravar evento", async () => {
    const c = await comercial();
    comoUsuario(c.vendedor);
    expect(await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO }))
      .toEqual({ ok: false, erro: "Só a administração ou o gerente do setor desvinculam o contato." });
    const s = await secretaria();
    for (const u of [s.sec, s.gerente]) {
      comoUsuario(u);
      expect((await desvincularContatoWhatsApp({ atendimentoId: s.at.id, alvo: { tipo: "aluno", id: s.aluno.id }, motivo: MOTIVO })).ok).toBe(false);
    }
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.contato.id } })).leadId).toBe(c.lead.id);
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: s.contato.id } })).alunoId).toBe(s.aluno.id);
    expect(await prisma.evento.count({ where: { tipo: "ContatoDesvinculado" } })).toBe(0);
  });

  it("motivo é obrigatório", async () => {
    const c = await comercial();
    comoUsuario(c.admin);
    for (const motivo of ["", "   ", "curto"]) {
      expect(await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo }))
        .toEqual({ ok: false, erro: "Escreva o motivo do desvínculo (10 a 500 caracteres)." });
    }
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.contato.id } })).leadId).toBe(c.lead.id);
  });

  it("vínculo que não é o atual, ou de outro setor, é recusado", async () => {
    const c = await comercial();
    comoUsuario(c.admin);
    const outro = await prisma.oportunidade.create({ data: { nome: "Outro" } });
    expect(await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: outro.id }, motivo: MOTIVO }))
      .toEqual({ ok: false, erro: "Este contato não está mais vinculado a esse cadastro. Recarregue a conversa." });
    expect(await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "aluno", id: "x" }, motivo: MOTIVO }))
      .toEqual({ ok: false, erro: "Neste atendimento só se desfaz o vínculo com a oportunidade." });
    // Repetir depois de desvincular não grava um segundo evento. Desde o 7º lote da #166, o mesmo desvínculo, de quem o
    // fez e com o mesmo motivo, devolve ok; com outro motivo ou de outra pessoa, segue recusado.
    expect((await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO })).ok).toBe(true);
    expect((await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO })).ok).toBe(true);
    expect((await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: `${MOTIVO}, outra vez` })).ok).toBe(false);
    comoUsuario(c.gerente);
    expect(await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO }))
      .toEqual({ ok: false, erro: "Este contato não está mais vinculado a esse cadastro. Recarregue a conversa." });
    expect(await prisma.evento.count({ where: { tipo: "ContatoDesvinculado" } })).toBe(1);
  });

  it("atendimento pedagógico não desvincula", async () => {
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    const numero = await criarNumeroSetor({ telefoneE164: "+5511988883000", setores: ["PEDAGOGICO"] });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611115555" } });
    const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "PEDAGOGICO" }));
    comoUsuario(admin);
    expect((await desvincularContatoWhatsApp({ atendimentoId: at.id, alvo: { tipo: "aluno", id: "x" }, motivo: MOTIVO })).ok).toBe(false);
  });
});

describe("painel do Inbox: vínculos que a pessoa pode desfazer", () => {
  it("gerente do setor e administrador recebem o vínculo com o nome; vendedor não", async () => {
    const c = await comercial();
    expect((await carregarAcoesContatoInbox(sessao(c.gerente), c.at.id))?.vinculos).toEqual([{ tipo: "lead", id: c.lead.id, nome: "Lead Errado" }]);
    expect((await carregarAcoesContatoInbox(sessao(c.admin), c.at.id))?.vinculos).toEqual([{ tipo: "lead", id: c.lead.id, nome: "Lead Errado" }]);
    expect((await carregarAcoesContatoInbox(sessao(c.vendedor), c.at.id))?.vinculos).toEqual([]);
  });
});
