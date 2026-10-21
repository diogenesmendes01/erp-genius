import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (6º lote): comandos do menu da mensagem que saem pelo motor.
// - Encaminhar recebe chave: o reenvio da mesma tentativa não encaminha de novo ao contato. A tentativa é gravada
//   antes da chamada ao motor e o resultado depois, sem transação aberta durante a chamada (B1 da R1 do #291).
// - Editar com o mesmo texto e apagar a mensagem já apagada por quem repete devolvem ok sem chamar o motor
//   nem gravar outro Evento.

// Sessão: só `exigirSessao` é trocada (como empresas/empresa-idempotencia.int.test.ts), para os envios simultâneos
// não esbarrarem no `import()` duplo do NextAuth mockado; os papéis continuam lidos do banco.
const { sessao, acao } = vi.hoisted(() => ({ sessao: { usuarioId: "" }, acao: vi.fn() }));
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
vi.mock("./acoes", () => ({ executarAcaoMotor: acao }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "../atendimentos";
import { apagarMensagemWhatsApp, editarMensagemWhatsApp, encaminharMensagemWhatsApp } from "./acoes-mensagem";
import { ErroMotor, MENSAGEM_LIMITE_RITMO } from "./cliente";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; acao.mockReset(); acao.mockResolvedValue({}); });
const comoUsuario = async <T,>(u: { id: string }, f: () => Promise<T>) => { sessao.usuarioId = u.id; return f(); };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const contar = (tipo: string) => prisma.evento.count({ where: { tipo } });
const chamadas = (verbo: string) => acao.mock.calls.filter((c) => c[1] === verbo).length;

async function cenario() {
  const autor = await criarUsuario([Papel.VENDEDOR], "Autor");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono")).id });
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: numero.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  const m = await prisma.mensagemWhatsApp.create({
    data: { numeroId: numero.id, conversaId: at.conversaId, atendimentoId: at.id, direcao: "SAIDA", driver: "MOTOR", corpo: "oi", origem: "HUMANO", autorId: autor.id, mensagemIdMotor: "c:3EB0X" },
  });
  async function destino(telefone: string) {
    const c = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
    return prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: c.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  }
  return { autor, outro, numero, at, m, destino };
}

describe("encaminharMensagemWhatsApp com chave (#166)", () => {
  it("a mesma chave encaminha uma vez e devolve ok no reenvio", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    acao.mockResolvedValue({ key: { id: "FWD1", remoteJid: "50688880002@s.whatsapp.net" } });
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-001" };
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(1);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(1);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: dest.id } })).toBe(1);
  });

  it("o reenvio tardio devolve ok mesmo com a origem já apagada", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-002" };
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(1);
  });

  it("recusa a mesma chave com outro destino sem chamar o motor; sem chave, como antes", async () => {
    const { autor, m, destino } = await cenario();
    const d1 = await destino("+50688880002");
    const d2 = await destino("+50688880003");
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: d1.id, chaveIdempotencia: "chave-fwd-003" }))).ok).toBe(true);
    const outra = await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: d2.id, chaveIdempotencia: "chave-fwd-003" }));
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(chamadas("message.forward")).toBe(1);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: d1.id }))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(2);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(2);
  });

  it("a chave de outro autor não devolve o encaminhamento dele", async () => {
    const { autor, outro, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-004" };
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect((await comoUsuario(outro, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(false);
    expect(chamadas("message.forward")).toBe(1);
  });
});

describe("encaminhar com chave: tentativa antes do motor, resultado depois (B1/C2 da R1 do #291)", () => {
  it("motor lento: nenhuma transação fica aberta; o reenvio no meio recebe 'em andamento' e o posterior, ok", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    // Mais que o timeout padrão (5 s) de uma transação interativa do Prisma: com a transação presa, a gravação falharia.
    acao.mockImplementation(async () => { await espera(6_000); return { key: { id: "FWD-LENTO" } }; });
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-lento" };
    const primeiro = comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada));
    while (!(await prisma.evento.count({ where: { tipo: "MensagemWhatsAppEncaminhamentoIniciado" } }))) await espera(50);
    const noMeio = await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada));
    expect(noMeio.ok).toBe(false);
    if (!noMeio.ok) expect(noMeio.erro).toMatch(/em andamento/);
    expect((await primeiro).ok).toBe(true);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(1);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(1);
  }, 60_000);

  it("dois envios simultâneos com a mesma chave encaminham uma vez só", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    acao.mockImplementation(async () => { await espera(1_500); return { key: { id: "FWD-SIMULT" } }; });
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-simult" };
    sessao.usuarioId = autor.id;
    const rs = await Promise.all([encaminharMensagemWhatsApp(entrada), encaminharMensagemWhatsApp(entrada)]);
    expect(rs.some((r) => r.ok), JSON.stringify(rs)).toBe(true);
    for (const r of rs) if (!r.ok) expect(r.erro).toMatch(/em andamento/);
    expect(chamadas("message.forward")).toBe(1);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(1);
    expect(await contar("MensagemWhatsAppEncaminhamentoIniciado")).toBe(1);
  }, 60_000);

  it("timeout do motor vira incerto; o reenvio da mesma chave não encaminha de novo", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    acao.mockRejectedValue(new ErroMotor("TIMEOUT", 0));
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-incerto" };
    const r1 = await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.erro).toMatch(/não confirmou/);
    expect(await contar("MensagemWhatsAppEncaminhamentoIncerto")).toBe(1);
    acao.mockResolvedValue({ key: { id: "FWD-NAO" } });
    expect(await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).toEqual(r1);
    expect(chamadas("message.forward")).toBe(1);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(0);
  });

  it("recusa explícita do motor (limite de ritmo) libera nova tentativa com a mesma chave", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    acao.mockRejectedValueOnce(new ErroMotor("LIMITE_RITMO", 409, "limite_ritmo"));
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-ritmo" };
    expect(await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).toEqual({ ok: false, erro: MENSAGEM_LIMITE_RITMO });
    expect(await contar("MensagemWhatsAppEncaminhamentoNaoEnviado")).toBe(1);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(2);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(1);
  });
});

describe("editar e apagar por natureza (#166)", () => {
  it("editar de novo com o mesmo texto não chama o motor nem grava outro Evento; outro texto edita", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "corrigido" }))).ok).toBe(true);
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: " corrigido " }))).ok).toBe(true);
    expect(chamadas("message.edit")).toBe(1);
    expect(await contar("MensagemWhatsAppEditada")).toBe(1);
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "corrigido de novo" }))).ok).toBe(true);
    expect(chamadas("message.edit")).toBe(2);
    expect(await contar("MensagemWhatsAppEditada")).toBe(2);
  });

  it("editar para o texto que a mensagem já tinha, sem edição anterior, segue chamando o motor como antes", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "oi" }))).ok).toBe(true);
    expect(chamadas("message.edit")).toBe(1);
  });

  it("apagar de novo devolve ok sem chamar o motor nem gravar outro Evento", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }))).ok).toBe(true);
    expect((await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }))).ok).toBe(true);
    expect(chamadas("message.delete")).toBe(1);
    expect(await contar("MensagemWhatsAppApagada")).toBe(1);
  });

  it("mensagem apagada fora do ERP (sem Evento de quem repete) continua recusada", async () => {
    const { autor, m } = await cenario();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
    expect(await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }))).toEqual({ ok: false, erro: "Esta mensagem já foi apagada." });
    expect(acao).not.toHaveBeenCalled();
  });
});
