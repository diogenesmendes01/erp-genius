import { Papel } from "@prisma/client";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { valorCampoLocal } from "@/server/operacao/fuso-entrada";
import { cancelarTarefa, concluirTarefa, editarTarefa, reagendarTarefa } from "@/server/crm/tarefas";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { cenarioPerda328 } from "@/test/inbox-perda";
import { diaUtilAs } from "@/test/janela-envio";
import { MOTIVO_CANCELADA_COM_TAREFA } from "./mensagem-agendada-tarefa";
import * as aviso from "./aviso";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...real,
    exigirSessao: async () => {
      const s = await authMock();
      const u = await real.carregarUsuarioFresco(s.user.id);
      if (!u) throw new real.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const FUSO = "America/Sao_Paulo";
const MSG_CANCELAR = "Você só pode cancelar mensagens agendadas por você (ou como administrador). Escolha manter a mensagem agendada.";
const MSG_REAGENDAR = "Você só pode reagendar mensagens agendadas por você (ou como administrador).";
const MSG_PASSADO = "A tarefa tem mensagem agendada. Escolha data e horário no futuro, ou cancele a mensagem antes de remarcar para o passado.";

beforeEach(async () => {
  vi.restoreAllMocks();
  await truncarBanco();
});
afterAll(() => prisma.$disconnect());

function como(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

function horario(quando: Date) {
  const local = valorCampoLocal(quando, FUSO);
  return { dataCivil: local.slice(0, 10), hora: local.slice(11, 16) };
}

async function cenario() {
  const autorA = await criarUsuario([Papel.GERENTE_COMERCIAL], "Autor A");
  const vendB = await criarUsuario([Papel.VENDEDOR], "Vendedor B");
  await prisma.usuario.update({ where: { id: vendB.id }, data: { gerenteComercialId: autorA.id } });
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  const base = await cenarioPerda328();
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: FUSO },
    update: { fusoInstitucional: FUSO },
  });
  return { autorA, vendB, admin, ...base };
}

async function abrir(c: Awaited<ReturnType<typeof cenario>>, quando = diaUtilAs(10)) {
  const local = horario(quando);
  const t = await prisma.tarefa.create({
    data: {
      titulo: "Retornar ao contato",
      tipo: "WHATSAPP",
      setor: "COMERCIAL",
      responsavelId: c.vendB.id,
      criadorId: c.autorA.id,
      atendimentoId: c.a.id,
      fusoOrigem: FUSO,
      dataCivil: local.dataCivil,
      inicioEm: quando,
    },
  });
  const m = await prisma.intencaoMensagem.create({
    data: {
      numeroId: c.numero.id,
      contatoId: c.contato.id,
      atendimentoId: c.a.id,
      tarefaId: t.id,
      origem: "HUMANO",
      autorId: c.autorA.id,
      status: "PENDENTE",
      corpoRenderizado: "Mensagem agendada da tarefa",
      agendadaPara: quando,
    },
  });
  return { t, m, quando };
}

async function estado(tId: string, mId: string) {
  const tarefa = await prisma.tarefa.findUniqueOrThrow({ where: { id: tId } });
  const mensagem = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: mId } });
  return { tarefa, mensagem };
}

it("vendedor B não cancela a mensagem de A ao concluir ou cancelar, e manter preserva o envio", async () => {
  const c = await cenario();
  como(c.vendB.id);

  const semDecisao = await abrir(c);
  expect(await concluirTarefa(semDecisao.t.id, semDecisao.t.versao)).toEqual({ ok: false, erro: MSG_CANCELAR });
  const aposOmissao = await estado(semDecisao.t.id, semDecisao.m.id);
  expect(aposOmissao.tarefa).toMatchObject({ status: "ABERTA", versao: semDecisao.t.versao, inicioEm: semDecisao.quando });
  expect(aposOmissao.mensagem).toMatchObject({ status: "PENDENTE", agendadaPara: semDecisao.quando });

  const comCancelar = await abrir(c);
  expect(await concluirTarefa(comCancelar.t.id, comCancelar.t.versao, undefined, "cancelar")).toEqual({ ok: false, erro: MSG_CANCELAR });
  expect(await cancelarTarefa(comCancelar.t.id, comCancelar.t.versao, "Não vou enviar", "cancelar")).toEqual({ ok: false, erro: MSG_CANCELAR });
  expect(await cancelarTarefa(comCancelar.t.id, comCancelar.t.versao, "Sem escolha")).toEqual({ ok: false, erro: MSG_CANCELAR });
  const aposRecusa = await estado(comCancelar.t.id, comCancelar.m.id);
  expect(aposRecusa.tarefa).toMatchObject({ status: "ABERTA", versao: comCancelar.t.versao });
  expect(aposRecusa.mensagem).toMatchObject({ status: "PENDENTE", agendadaPara: comCancelar.quando, motivoFalha: null });
  expect(await prisma.evento.count({ where: { tipo: "MensagemAgendadaCancelada" } })).toBe(0);

  const manterConclusao = await abrir(c);
  expect(await concluirTarefa(manterConclusao.t.id, manterConclusao.t.versao, "Feito", "manter")).toEqual({ ok: true });
  const concluida = await estado(manterConclusao.t.id, manterConclusao.m.id);
  expect(concluida.tarefa.status).toBe("CONCLUIDA");
  expect(concluida.mensagem).toMatchObject({ status: "PENDENTE", autorId: c.autorA.id, agendadaPara: manterConclusao.quando });

  const manterCancelamento = await abrir(c);
  expect(await cancelarTarefa(manterCancelamento.t.id, manterCancelamento.t.versao, "Tarefa caiu", "manter")).toEqual({ ok: true });
  const cancelada = await estado(manterCancelamento.t.id, manterCancelamento.m.id);
  expect(cancelada.tarefa.status).toBe("CANCELADA");
  expect(cancelada.mensagem).toMatchObject({ status: "PENDENTE", autorId: c.autorA.id, agendadaPara: manterCancelamento.quando });
});

it("vendedor B não remarca a mensagem PENDENTE de A, e autor ou administrador conseguem", async () => {
  const c = await cenario();
  const futuro = diaUtilAs(11);
  const pedido = horario(futuro);

  const porReagendar = await abrir(c);
  como(c.vendB.id);
  expect(await reagendarTarefa(porReagendar.t.id, porReagendar.t.versao, pedido)).toEqual({ ok: false, erro: MSG_REAGENDAR });
  expect((await estado(porReagendar.t.id, porReagendar.m.id)).mensagem.agendadaPara).toEqual(porReagendar.quando);
  expect((await prisma.tarefa.findUniqueOrThrow({ where: { id: porReagendar.t.id } })).inicioEm).toEqual(porReagendar.quando);

  const porEditar = await abrir(c);
  expect(await editarTarefa(porEditar.t.id, porEditar.t.versao, pedido)).toEqual({ ok: false, erro: MSG_REAGENDAR });
  expect((await estado(porEditar.t.id, porEditar.m.id)).mensagem.agendadaPara).toEqual(porEditar.quando);

  const peloAutor = await abrir(c);
  como(c.autorA.id);
  expect(await reagendarTarefa(peloAutor.t.id, peloAutor.t.versao, pedido)).toEqual({ ok: true });
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: peloAutor.m.id } })).agendadaPara).toEqual(futuro);
  expect((await prisma.tarefa.findUniqueOrThrow({ where: { id: peloAutor.t.id } })).inicioEm).toEqual(futuro);

  const peloAdmin = await abrir(c);
  como(c.admin.id);
  expect(await concluirTarefa(peloAdmin.t.id, peloAdmin.t.versao, "Encerrada", "cancelar")).toEqual({ ok: true });
  expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: peloAdmin.m.id } })).toMatchObject({
    status: "CANCELADA",
    motivoFalha: MOTIVO_CANCELADA_COM_TAREFA,
  });
  expect((await prisma.tarefa.findUniqueOrThrow({ where: { id: peloAdmin.t.id } })).status).toBe("CONCLUIDA");

  const canceladaPeloAutor = await abrir(c);
  como(c.autorA.id);
  expect(await cancelarTarefa(canceladaPeloAutor.t.id, canceladaPeloAutor.t.versao, "Autor cancela o envio", "cancelar")).toEqual({ ok: true });
  expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: canceladaPeloAutor.m.id } })).toMatchObject({ status: "CANCELADA" });
});

it("recusa remarcar mensagem PENDENTE para o passado e preserva tarefa e agendadaPara", async () => {
  const c = await cenario();
  como(c.autorA.id);
  const passado = new Date(Date.now() - 60_000);
  const pedido = horario(passado);

  const porReagendar = await abrir(c);
  expect(await reagendarTarefa(porReagendar.t.id, porReagendar.t.versao, pedido)).toEqual({ ok: false, erro: MSG_PASSADO });
  const aposReagendar = await estado(porReagendar.t.id, porReagendar.m.id);
  expect(aposReagendar.tarefa).toMatchObject({ status: "ABERTA", versao: porReagendar.t.versao, inicioEm: porReagendar.quando });
  expect(aposReagendar.mensagem).toMatchObject({ status: "PENDENTE", agendadaPara: porReagendar.quando });

  const porEditar = await abrir(c);
  expect(await editarTarefa(porEditar.t.id, porEditar.t.versao, pedido)).toEqual({ ok: false, erro: MSG_PASSADO });
  const aposEditar = await estado(porEditar.t.id, porEditar.m.id);
  expect(aposEditar.tarefa.inicioEm).toEqual(porEditar.quando);
  expect(aposEditar.mensagem.agendadaPara).toEqual(porEditar.quando);
});

it("concluir, cancelar e reagendar pelo CRM avisam o atendimento da mensagem", async () => {
  const c = await cenario();
  como(c.autorA.id);
  const futuro = diaUtilAs(15);
  const spy = vi.spyOn(aviso, "avisarAtendimento");

  const concluida = await abrir(c);
  expect(await concluirTarefa(concluida.t.id, concluida.t.versao, "Feito", "cancelar")).toEqual({ ok: true });
  expect(spy).toHaveBeenCalledWith(expect.anything(), c.a.id);

  spy.mockClear();
  const cancelada = await abrir(c);
  expect(await cancelarTarefa(cancelada.t.id, cancelada.t.versao, "Não enviar", "cancelar")).toEqual({ ok: true });
  expect(spy).toHaveBeenCalledWith(expect.anything(), c.a.id);

  spy.mockClear();
  const movida = await abrir(c);
  expect(await reagendarTarefa(movida.t.id, movida.t.versao, horario(futuro))).toEqual({ ok: true });
  expect(spy).toHaveBeenCalledWith(expect.anything(), c.a.id);
  expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: movida.m.id } })).agendadaPara).toEqual(futuro);
});
