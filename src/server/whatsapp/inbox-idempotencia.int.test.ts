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
  return { vend, outro, fin, a };
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
