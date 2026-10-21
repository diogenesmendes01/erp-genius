import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (3º lote): nota interna, convite de participante e mensagem agendada do Inbox recebem chave de
// idempotência. O reenvio da mesma tentativa (resultado incerto, duplo clique) devolve o registro já
// criado; a mesma chave com outra entrada é recusada sem gravar nada.

// Sessão: só `exigirSessao` é trocada (mesmo motivo de comercial/criar-lead-idempotencia.int.test.ts: dois
// `import("@/lib/auth")` simultâneos escapam do vi.mock e carregam o NextAuth real).
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { diaUtilAs } from "@/test/janela-envio";
import { garantirAtendimento } from "./atendimentos";
import { convidarParticipante } from "./acoes-atendimento";
import { agendarMensagemNoAtendimento, registrarNotaAtendimento } from "./acoes-conversa";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });
const comoUsuario = (u: { id: string }) => { sessao.usuarioId = u.id; };
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

async function cenario() {
  const vend = await criarUsuario([Papel.VENDEDOR], "Vend");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro vend");
  const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "FINANCEIRO"], donoId: vend.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: vend.id }));
  comoUsuario(vend);
  return { vend, outro, fin, a, contato };
}

describe("registrarNotaAtendimento com chave (#166)", () => {
  const notas = () => prisma.evento.count({ where: { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp" } });

  it("a mesma chave duas vezes grava uma nota (um Evento) e devolve o mesmo resultado", async () => {
    const { a } = await cenario();
    const primeira = await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou", chaveIdempotencia: "chave-nota-at-01" });
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    const antes = await prisma.evento.count();
    expect(await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou", chaveIdempotencia: "chave-nota-at-01" })).toEqual(primeira);
    expect(await prisma.evento.count()).toBe(antes);
    expect(await notas()).toBe(1);
  });

  it("dois envios simultâneos com a mesma chave gravam uma só nota", async () => {
    const { a } = await cenario();
    const [x, y] = await Promise.all([
      registrarNotaAtendimento({ atendimentoId: a.id, nota: "Pediu boleto", chaveIdempotencia: "chave-nota-at-02" }),
      registrarNotaAtendimento({ atendimentoId: a.id, nota: "Pediu boleto", chaveIdempotencia: "chave-nota-at-02" }),
    ]);
    expect(x.ok && y.ok, JSON.stringify([x, y])).toBe(true);
    expect(await notas()).toBe(1);
  });

  it("recusa a mesma chave com outra nota, sem gravar; sem chave grava como antes", async () => {
    const { a } = await cenario();
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Texto A", chaveIdempotencia: "chave-nota-at-03" })).ok).toBe(true);
    const outra = await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Texto B", chaveIdempotencia: "chave-nota-at-03" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(await notas()).toBe(1);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Sem chave" })).ok).toBe(true);
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Sem chave" })).ok).toBe(true);
    expect(await notas()).toBe(3);
  });
});

describe("convidarParticipante com chave (#166)", () => {
  const motivo = "Dúvida sobre boleto do aluno";

  it("a mesma chave devolve o mesmo convite: um participante e um Evento", async () => {
    const { fin, a } = await cenario();
    const entrada = { atendimentoId: a.id, usuarioId: fin.id, podeEnviar: false, fim: emDias(3), motivo, chaveIdempotencia: "chave-convite-01" };
    const primeira = await convidarParticipante(entrada);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    const segunda = await convidarParticipante(entrada);
    expect(segunda).toEqual(primeira);
    expect(await prisma.participanteAtendimentoWhatsApp.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "ParticipanteConvidado" } })).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem gravar", async () => {
    const { fin, outro, a } = await cenario();
    const fim = emDias(3);
    expect((await convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: false, fim, motivo, chaveIdempotencia: "chave-convite-02" })).ok).toBe(true);
    const outraPessoa = await convidarParticipante({ atendimentoId: a.id, usuarioId: outro.id, podeEnviar: false, fim, motivo, chaveIdempotencia: "chave-convite-02" });
    const outroEnvio = await convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: true, fim, motivo, chaveIdempotencia: "chave-convite-02" });
    expect([outraPessoa.ok, outroEnvio.ok]).toEqual([false, false]);
    if (!outraPessoa.ok) expect(outraPessoa.erro).toMatch(/já foi usada/);
    expect(await prisma.participanteAtendimentoWhatsApp.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "ParticipanteConvidado" } })).toBe(1);
  });
});

describe("agendarMensagemNoAtendimento com chave (#166)", () => {
  it("a mesma chave devolve a mesma mensagem agendada: uma intenção e um Evento", async () => {
    const { a } = await cenario();
    const entrada = { atendimentoId: a.id, texto: "Lembrete da aula", quando: diaUtilAs(10).toISOString(), chaveIdempotencia: "chave-agenda-01" };
    const [x, y] = await Promise.all([agendarMensagemNoAtendimento(entrada), agendarMensagemNoAtendimento(entrada)]);
    expect(x.ok && y.ok, JSON.stringify([x, y])).toBe(true);
    expect(y).toEqual(x);
    expect(await agendarMensagemNoAtendimento(entrada)).toEqual(x);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "MensagemAgendada" } })).toBe(1);
  });

  it("recusa a mesma chave com outro texto ou outro horário, sem agendar", async () => {
    const { a } = await cenario();
    const base = { atendimentoId: a.id, texto: "Lembrete", quando: diaUtilAs(10).toISOString(), chaveIdempotencia: "chave-agenda-02" };
    expect((await agendarMensagemNoAtendimento(base)).ok).toBe(true);
    const outroTexto = await agendarMensagemNoAtendimento({ ...base, texto: "Outro lembrete" });
    const outroHorario = await agendarMensagemNoAtendimento({ ...base, quando: diaUtilAs(11).toISOString() });
    expect([outroTexto.ok, outroHorario.ok]).toEqual([false, false]);
    if (!outroTexto.ok) expect(outroTexto.erro).toMatch(/já foi usada/);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
  });
});

// C3 da R2 do #267 (lote 4): a busca da repetição roda antes das validações de estado. O reenvio tardio da
// mesma tentativa, depois que o atendimento foi encerrado ou o contato pediu opt-out, devolve o que já foi feito
// em vez de um erro, e não grava nada de novo.
describe("reenvio tardio da mesma chave devolve o registro já feito (C3 do #267)", () => {
  it("nota: o atendimento saiu do escopo de quem anotou e foi encerrado; o reenvio devolve ok sem nova nota", async () => {
    const { a, outro } = await cenario();
    const entrada = { atendimentoId: a.id, nota: "Combinou retorno", chaveIdempotencia: "chave-nota-tardia-01" };
    const primeira = await registrarNotaAtendimento(entrada);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    // O atendimento e a linha passam a outro vendedor: quem anotou perde o escopo.
    const { numeroId } = await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: a.conversaId } });
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { donoId: outro.id } });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: outro.id, encerradoEm: new Date(), status: "ENCERRADO" } });
    expect(await registrarNotaAtendimento(entrada)).toEqual(primeira);
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1);
    // Chave nova continua passando pelas validações.
    expect((await registrarNotaAtendimento({ ...entrada, chaveIdempotencia: "chave-nota-tardia-02" })).ok).toBe(false);
  });

  it("agendamento: depois do encerramento e do opt-out, o reenvio devolve a mesma mensagem agendada", async () => {
    const { a, contato } = await cenario();
    const entrada = { atendimentoId: a.id, texto: "Lembrete da aula", quando: diaUtilAs(10).toISOString(), chaveIdempotencia: "chave-agenda-tardia-01" };
    const primeira = await agendarMensagemNoAtendimento(entrada);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    await prisma.contatoWhatsApp.update({ where: { id: contato.id }, data: { optOutEm: new Date() } });
    expect(await agendarMensagemNoAtendimento(entrada)).toEqual(primeira);
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    expect(await agendarMensagemNoAtendimento(entrada)).toEqual(primeira);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "MensagemAgendada" } })).toBe(1);
    // Sem a repetição, as validações continuam valendo.
    const nova = await agendarMensagemNoAtendimento({ ...entrada, chaveIdempotencia: "chave-agenda-tardia-02" });
    expect(nova.ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
  });
});

describe("agendamento com chave nova não revela se o atendimento existe (N1 da R1 do #274)", () => {
  it("fora do escopo e inexistente recebem a mesma resposta, antes das validações de horário", async () => {
    const { a, outro } = await cenario();
    comoUsuario(outro);
    const passado = new Date(Date.now() - 86_400_000).toISOString();
    const existente = await agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Sondagem", quando: passado, chaveIdempotencia: "chave-sonda-01" });
    const inexistente = await agendarMensagemNoAtendimento({ atendimentoId: "atendimento-que-nao-existe", texto: "Sondagem", quando: passado, chaveIdempotencia: "chave-sonda-02" });
    expect(existente).toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(inexistente).toEqual(existente);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});
