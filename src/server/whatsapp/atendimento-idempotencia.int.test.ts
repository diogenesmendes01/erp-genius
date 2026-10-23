import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (6º lote): ações do atendimento no Inbox.
// - Transferir recebe chave: o reenvio da mesma tentativa devolve o atendimento novo, sem encerrar nem abrir outro.
// - Assumir, devolver, encerrar, revogar convite e cancelar agendamento são idempotentes por natureza: o reenvio
//   de quem já fez a ação devolve ok sem gravar outro Evento. Se o estado veio de outra pessoa, segue recusado.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// empresas/empresa-idempotencia.int.test.ts: dois `import()` simultâneos do NextAuth mockado falham no vitest e o
// envio simultâneo é o que o teste mede); os papéis continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { assumirAtendimento, convidarParticipante, devolverParaFila, revogarParticipante, transferirAtendimento } from "./acoes-atendimento";
import { encerrarAtendimentoWhatsApp } from "./operacoes-atendimento";
import { agendarMensagemNoAtendimento, cancelarAgendamentoDoAtendimento } from "./acoes-conversa";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });

type U = { id: string };
const comoUsuario = (u: U) => { sessao.usuarioId = u.id; };
async function como<T>(u: U, f: () => Promise<T>): Promise<T> { comoUsuario(u); return f(); }
const contar = (tipo: string, agregadoId?: string) => prisma.evento.count({ where: { tipo, ...(agregadoId ? { agregadoId } : {}) } });
const ctx = "Pediu histórico escolar";

/** Número institucional que atende COMERCIAL e SECRETARIA fora de linha de vendas (o responsável dá acesso). */
async function cenario(responsavel: "v1" | null = "v1") {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const gc2 = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente Dois");
  const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "SECRETARIA"], finalidade: "AGENDA", donoId: null });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: responsavel ? v1.id : null }));
  return { v1, v2, gc, gc2, fin, numero, contato, a };
}

describe("transferirAtendimento com chave (#166)", () => {
  it("a mesma chave, inclusive simultânea, transfere uma vez e devolve o mesmo atendimento novo", async () => {
    const { gc, a } = await cenario();
    const entrada = { atendimentoId: a.id, destino: "SECRETARIA" as const, destinoChave: null, contexto: ctx, chaveIdempotencia: "chave-transf-01" };
    comoUsuario(gc);
    const [r1, r2] = await Promise.all([transferirAtendimento(entrada), transferirAtendimento(entrada)]);
    expect(r1.ok && r2.ok, JSON.stringify([r1, r2])).toBe(true);
    expect(r2).toEqual(r1);
    // Reenvio tardio, com a origem já encerrada: devolve o mesmo, sem "Atendimento encerrado".
    expect(await transferirAtendimento(entrada)).toEqual(r1);
    expect(await prisma.atendimentoWhatsApp.count({ where: { finalidade: "SECRETARIA" } })).toBe(1);
    expect(await contar("AtendimentoTransferido")).toBe(2); // origem e novo, uma vez cada
    expect(await contar("AtendimentoEncerrado", a.id)).toBe(1);
    expect(await contar("NotaInterna")).toBe(1);
  });

  it("recusa a mesma chave com outro contexto; chave nova segue as regras de antes; sem chave, como antes", async () => {
    const { gc, a } = await cenario();
    comoUsuario(gc);
    const base = { atendimentoId: a.id, destino: "SECRETARIA" as const, destinoChave: null, contexto: ctx };
    expect((await transferirAtendimento({ ...base, chaveIdempotencia: "chave-transf-02" })).ok).toBe(true);
    const outra = await transferirAtendimento({ ...base, contexto: "Outro contexto qualquer", chaveIdempotencia: "chave-transf-02" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    const nova = await transferirAtendimento({ ...base, chaveIdempotencia: "chave-transf-03" });
    expect(nova).toEqual({ ok: false, erro: "Atendimento encerrado." });
    expect(await transferirAtendimento(base)).toEqual({ ok: false, erro: "Atendimento encerrado." });
    expect(await contar("AtendimentoTransferido")).toBe(2);
  });

  it("a chave de outro autor não devolve a transferência dele", async () => {
    const { gc, gc2, a } = await cenario();
    const entrada = { atendimentoId: a.id, destino: "SECRETARIA" as const, destinoChave: null, contexto: ctx, chaveIdempotencia: "chave-transf-04" };
    expect((await como(gc, () => transferirAtendimento(entrada))).ok).toBe(true);
    expect(await como(gc2, () => transferirAtendimento(entrada))).toEqual({ ok: false, erro: "Atendimento encerrado." });
    expect(await contar("AtendimentoTransferido")).toBe(2);
  });
});

describe("assumir e devolver por natureza (#166)", () => {
  it("assumir de novo, por quem assumiu, devolve ok sem outro Evento; quem não assumiu continua recusado", async () => {
    const { v1, v2, a } = await cenario(null);
    expect((await como(v1, () => assumirAtendimento(a.id))).ok).toBe(true);
    expect((await como(v1, () => assumirAtendimento(a.id))).ok).toBe(true);
    expect(await contar("AtendimentoAssumido")).toBe(1);
    expect(await como(v2, () => assumirAtendimento(a.id))).toEqual({ ok: false, erro: "Atendimento fora do seu escopo." });
  });

  it("assumir quando outra pessoa atribuiu o atendimento a quem repete continua recusado", async () => {
    const { v1, a } = await cenario("v1");
    expect(await como(v1, () => assumirAtendimento(a.id))).toEqual({ ok: false, erro: "Outro atendente já assumiu este atendimento." });
    expect(await contar("AtendimentoAssumido")).toBe(0);
  });

  it("devolver de novo, por quem devolveu, devolve ok sem outro Evento; outro gerente continua recusado", async () => {
    const { gc, gc2, a } = await cenario("v1");
    expect((await como(gc, () => devolverParaFila(a.id))).ok).toBe(true);
    const [r1, r2] = await Promise.all([como(gc, () => devolverParaFila(a.id)), como(gc, () => devolverParaFila(a.id))]);
    expect(r1.ok && r2.ok, JSON.stringify([r1, r2])).toBe(true);
    expect(await contar("AtendimentoDevolvido")).toBe(1);
    expect(await como(gc2, () => devolverParaFila(a.id))).toEqual({ ok: false, erro: "Este atendimento já está na fila." });
  });

  it("devolver quando o atendimento nunca saiu da fila por esta pessoa continua recusado", async () => {
    const { gc, a } = await cenario(null);
    expect(await como(gc, () => devolverParaFila(a.id))).toEqual({ ok: false, erro: "Este atendimento já está na fila." });
  });
});

describe("encerrar por natureza (#166)", () => {
  it("encerrar de novo, inclusive simultâneo, grava um AtendimentoEncerrado", async () => {
    const { gc, a } = await cenario();
    comoUsuario(gc);
    const [r1, r2] = await Promise.all([encerrarAtendimentoWhatsApp(a.id), encerrarAtendimentoWhatsApp(a.id)]);
    expect(r1.ok && r2.ok, JSON.stringify([r1, r2])).toBe(true);
    expect((await encerrarAtendimentoWhatsApp(a.id)).ok).toBe(true);
    expect(await contar("AtendimentoEncerrado", a.id)).toBe(1);
  });

  it("atendimento encerrado por outra pessoa continua recusado, sem Evento", async () => {
    const { gc, gc2, a } = await cenario();
    expect((await como(gc, () => encerrarAtendimentoWhatsApp(a.id))).ok).toBe(true);
    const r = await como(gc2, () => encerrarAtendimentoWhatsApp(a.id));
    expect(r.ok).toBe(false);
    expect(await contar("AtendimentoEncerrado", a.id)).toBe(1);
  });
});

describe("revogar convite e cancelar agendamento por natureza (#166)", () => {
  it("revogar de novo, por quem revogou, devolve ok sem outro Evento; outra pessoa continua recusada", async () => {
    const { v1, gc, fin, a } = await cenario();
    const emDois = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const c = await como(v1, () => convidarParticipante({ atendimentoId: a.id, usuarioId: fin.id, podeEnviar: false, fim: emDois, motivo: "Dúvida sobre boleto" }));
    if (!c.ok) throw new Error(c.erro);
    const id = c.dado!.participanteId;
    expect((await como(v1, () => revogarParticipante(id))).ok).toBe(true);
    expect((await como(v1, () => revogarParticipante(id))).ok).toBe(true);
    expect(await contar("ParticipanteRevogado")).toBe(1);
    expect(await como(gc, () => revogarParticipante(id))).toEqual({ ok: false, erro: "Este convite já foi revogado." });
  });

  it("cancelar de novo, por quem cancelou, devolve ok sem outro Evento", async () => {
    const { v1, a } = await cenario();
    const quando = new Date(Date.now() + 86_400_000).toISOString();
    const ag = await como(v1, () => agendarMensagemNoAtendimento({ atendimentoId: a.id, texto: "Lembrete da aula", quando }));
    if (!ag.ok) throw new Error(ag.erro);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { atendimentoId: a.id } });
    expect((await como(v1, () => cancelarAgendamentoDoAtendimento({ atendimentoId: a.id, intencaoId: intencao.id }))).ok).toBe(true);
    expect((await como(v1, () => cancelarAgendamentoDoAtendimento({ atendimentoId: a.id, intencaoId: intencao.id }))).ok).toBe(true);
    expect(await contar("MensagemAgendadaCancelada")).toBe(1);
  });
});
