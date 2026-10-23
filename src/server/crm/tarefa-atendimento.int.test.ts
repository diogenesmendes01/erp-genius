import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinalidadeNumero, Papel } from "@prisma/client";

const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return { ...o, exigirSessao: async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { setoresDoNumero } from "@/server/whatsapp/numero-setor";
import { atendimentoVisivel, garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { carregarUsuarioFresco } from "@/server/_shared/sessao";
import { criarTarefa, editarTarefa, type TarefaInput } from "./tarefas";

// Só o acréscimo da entrada é antecipado pelo teste RED; nenhum mock da persistência ou do escopo.
const criar = (i: TarefaInput & { atendimentoId?: string }) => criarTarefa(i);
let c: Awaited<ReturnType<typeof cenario>>;

async function cenario() {
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor fictício322");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro fictício322");
  const financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro fictício322");
  const numero = await criarNumeroSetor({ telefoneE164: "+5500000000322", finalidade: FinalidadeNumero.COBRANCA, setores: ["COMERCIAL"] });
  expect(await setoresDoNumero(prisma, numero.id)).toEqual(["COMERCIAL"]);
  const pessoa = await prisma.pessoa.create({ data: { nome: "Pessoa fictícia322" } });
  const leadA = await prisma.oportunidade.create({ data: { nome: "LeadA fictício322", vendedorDonoId: vendedor.id, pessoaId: pessoa.id } });
  const leadB = await prisma.oportunidade.create({ data: { nome: "LeadB fictício322", vendedorDonoId: vendedor.id } });
  const leadAlheio = await prisma.oportunidade.create({ data: { nome: "Alheio fictício322", vendedorDonoId: outro.id } });
  const atendimentos = [];
  for (const [n, lead] of [leadA, leadB, leadAlheio].entries()) {
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+550000000032${n + 3}` } });
    atendimentos.push(await prisma.$transaction((tx) => garantirAtendimento(tx, {
      numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id,
    })));
  }
  return { vendedor, outro, financeiro, pessoa, leadA, leadB, leadAlheio, a: atendimentos[0], b: atendimentos[1], alheio: atendimentos[2] };
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Costa_Rica" } });
  c = await cenario();
  sessao.usuarioId = c.vendedor.id;
});

function idDe(r: Awaited<ReturnType<typeof criarTarefa>>) {
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true);
  if (!r.ok || !r.dado) throw new Error("A criação deveria devolver o ID da tarefa.");
  return r.dado.id;
}
async function contagens() {
  return { tarefas: await prisma.tarefa.count(), eventos: await prisma.evento.count(),
    criadas: await prisma.evento.count({ where: { tipo: "TarefaCriada", agregadoTipo: "Tarefa" } }),
    lembretes: await prisma.tarefa.count({ where: { lembrarEm: { not: null } } }) };
}
const eventoCriado = async (id: string) => (await eventosDo("Tarefa", id)).find((e) => e.tipo === "TarefaCriada");
const comLembrete = { dataCivil: "2026-10-24", hora: "09:00", lembreteAntecedenciaMin: 30 as const };

describe("vínculo imutável da tarefa ao atendimento (#322)", () => {
  it("persiste o atendimento e o publica no evento, preservando vínculos, responsável, setor e fuso", async () => {
    const id = idDe(await criar({ titulo: "Ligar", tipo: "LIGACAO", atendimentoId: c.a.id,
      leadId: c.leadA.id, pessoaId: c.pessoa.id, ...comLembrete, chaveIdempotencia: "322-tarefa-vinculada" }));
    expect(await prisma.tarefa.findUniqueOrThrow({ where: { id } })).toMatchObject({
      atendimentoId: c.a.id, leadId: c.leadA.id, pessoaId: c.pessoa.id, responsavelId: c.vendedor.id,
      criadorId: c.vendedor.id, setor: "COMERCIAL", origem: "HUMANO", fusoOrigem: "America/Costa_Rica",
      inicioEm: new Date("2026-10-24T15:00:00.000Z"), lembrarEm: new Date("2026-10-24T14:30:00.000Z"),
    });
    expect((await eventoCriado(id))?.payload).toMatchObject({ atendimentoId: c.a.id });
    expect((await eventosDo("Lead", c.leadA.id)).filter((e) => e.tipo === "TarefaCriada")).toHaveLength(1);
  });

  it("sem atendimento mantém a criação antiga e payload com vínculo nulo", async () => {
    const id = idDe(await criar({ titulo: "Sem conversa", tipo: "OUTRO" }));
    expect(await prisma.tarefa.findUniqueOrThrow({ where: { id } })).toMatchObject({ atendimentoId: null });
    expect((await eventoCriado(id))?.payload).toMatchObject({ atendimentoId: null });
  });

  it.each(["inexistente", "alheio"] as const)("atendimento %s recusa sem tarefa, evento ou lembrete", async (alvo) => {
    const antes = await contagens();
    expect(await criar({ titulo: "Não criar", tipo: "OUTRO", ...comLembrete,
      atendimentoId: alvo === "alheio" ? c.alheio.id : "322-atendimento-inexistente" }))
      .toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(await contagens()).toEqual(antes);
  });

  it("participante só de leitura vincula sem permissão de envio e mantém o setor do autor", async () => {
    await prisma.participanteAtendimentoWhatsApp.create({ data: {
      atendimentoId: c.a.id, usuarioId: c.financeiro.id, concedenteId: c.vendedor.id,
      inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), podeEnviar: false, motivo: "Leitura fictícia322",
    } });
    sessao.usuarioId = c.financeiro.id;
    const usuario = await carregarUsuarioFresco(c.financeiro.id);
    if (!usuario) throw new Error("Usuário da fixture não carregou.");
    expect(await atendimentoVisivel(usuario, c.a.id, false)).not.toBeNull();
    expect(await atendimentoVisivel(usuario, c.a.id, true)).toBeNull();
    const id = idDe(await criar({ titulo: "Revisar", tipo: "OUTRO", atendimentoId: c.a.id }));
    expect(await prisma.tarefa.findUniqueOrThrow({ where: { id } })).toMatchObject({
      atendimentoId: c.a.id, responsavelId: c.financeiro.id, setor: "FINANCEIRO",
    });
  });

  it("participação revogada não mantém acesso pelo ID conhecido", async () => {
    await prisma.participanteAtendimentoWhatsApp.create({ data: {
      atendimentoId: c.a.id, usuarioId: c.financeiro.id, concedenteId: c.vendedor.id,
      inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), revogadoEm: new Date(), motivo: "Revogado fictício322",
    } });
    sessao.usuarioId = c.financeiro.id;
    const antes = await contagens();
    expect(await criar({ titulo: "Recusar", tipo: "OUTRO", atendimentoId: c.a.id })).toEqual({ ok: false, erro: "Atendimento não encontrado." });
    expect(await contagens()).toEqual(antes);
  });

  it("vínculo visível não contorna a carteira nem a existência da pessoa", async () => {
    const antes = await contagens();
    expect(await criar({ titulo: "Lead alheio", tipo: "OUTRO", atendimentoId: c.a.id, leadId: c.leadAlheio.id }))
      .toEqual({ ok: false, erro: "Oportunidade fora da sua carteira." });
    expect(await criar({ titulo: "Pessoa ausente", tipo: "OUTRO", atendimentoId: c.a.id, pessoaId: "322-pessoa-inexistente" }))
      .toEqual({ ok: false, erro: "Pessoa não encontrada." });
    expect(await contagens()).toEqual(antes);
  });

  it("editar ignora o atendimento recebido e preserva versão otimista e escopo", async () => {
    const id = idDe(await criar({ titulo: "Original", tipo: "OUTRO", atendimentoId: c.a.id }));
    const entrada = { titulo: "Alterada", atendimentoId: c.b.id };
    expect((await editarTarefa(id, 1, entrada)).ok).toBe(true);
    expect(await prisma.tarefa.findUniqueOrThrow({ where: { id } })).toMatchObject({ titulo: "Alterada", atendimentoId: c.a.id, versao: 2 });
    expect(await editarTarefa(id, 1, { titulo: "Obsoleta" })).toEqual({ ok: false, erro: "Esta tarefa foi alterada por outra pessoa. Recarregue." });
    sessao.usuarioId = c.outro.id;
    expect(await editarTarefa(id, 2, entrada)).toEqual({ ok: false, erro: "Tarefa não encontrada." });
    expect(await prisma.tarefa.findUniqueOrThrow({ where: { id } })).toMatchObject({ titulo: "Alterada", atendimentoId: c.a.id, versao: 2 });
  });
});

describe("idempotência inclui o atendimento sem mudar comandos legados (#166/#322)", () => {
  it("replay idêntico devolve o ID e não duplica tarefa, lembrete ou evento", async () => {
    const entrada = { titulo: "Replay", tipo: "LIGACAO" as const, ...comLembrete, atendimentoId: c.a.id, chaveIdempotencia: "322-replay-identico" };
    const primeira = await criar(entrada); idDe(primeira);
    const antes = await contagens();
    expect(await criar(entrada)).toEqual(primeira);
    expect(await contagens()).toEqual(antes);
  });

  it("mesma chave com outro atendimento conflita sem segunda gravação", async () => {
    const entrada = { titulo: "Conflito", tipo: "OUTRO" as const, atendimentoId: c.a.id, chaveIdempotencia: "322-conflito-atendimento" };
    idDe(await criar(entrada));
    const antes = await contagens();
    expect(await criar({ ...entrada, atendimentoId: c.b.id })).toMatchObject({ ok: false, erro: expect.stringContaining("já foi usada") });
    expect(await contagens()).toEqual(antes);
  });

  it("dois envios simultâneos da mesma chave e atendimento criam só uma tarefa", async () => {
    const entrada = { titulo: "Simultâneos", tipo: "OUTRO" as const, atendimentoId: c.a.id, chaveIdempotencia: "322-simultaneos-iguais" };
    const antes = await contagens();
    const [a, b] = await Promise.all([criar(entrada), criar(entrada)]);
    expect(idDe(a)).toBe(idDe(b));
    const depois = await contagens();
    expect(depois.tarefas - antes.tarefas).toBe(1);
    expect(depois.criadas - antes.criadas).toBe(1);
  });

  it("chave simultânea com atendimentos diferentes tem um vencedor e um conflito", async () => {
    const entrada = { titulo: "Disputa", tipo: "OUTRO" as const, chaveIdempotencia: "322-simultaneos-diferentes" };
    const antes = await contagens();
    const resultados = await Promise.all([criar({ ...entrada, atendimentoId: c.a.id }), criar({ ...entrada, atendimentoId: c.b.id })]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok)).toEqual([{ ok: false, erro: expect.stringContaining("já foi usada") }]);
    const depois = await contagens();
    expect(depois.tarefas - antes.tarefas).toBe(1);
    expect(depois.criadas - antes.criadas).toBe(1);
  });

  it("ausência de atendimento conserva o hash legado e seu replay", async () => {
    const entrada = { titulo: "Legado", tipo: "OUTRO" as const, chaveIdempotencia: "322-chave-comando-legado" };
    const primeira = await criar(entrada); const id = idDe(primeira);
    const hashLegado = createHash("sha256").update(JSON.stringify({ titulo: "Legado", tipo: "OUTRO" })).digest("hex");
    expect((await eventoCriado(id))?.payload).toMatchObject({ entradaHash: hashLegado });
    expect(await criar(entrada)).toEqual(primeira);
  });

  it("chaves diferentes criam vínculos distintos; chave curta não grava", async () => {
    const a = idDe(await criar({ titulo: "Separadas", tipo: "OUTRO", atendimentoId: c.a.id, chaveIdempotencia: "322-chave-separada-a" }));
    const b = idDe(await criar({ titulo: "Separadas", tipo: "OUTRO", atendimentoId: c.b.id, chaveIdempotencia: "322-chave-separada-b" }));
    expect(a).not.toBe(b);
    const antes = await contagens();
    expect(await criar({ titulo: "Curta", tipo: "OUTRO", atendimentoId: c.a.id, chaveIdempotencia: "k1" })).toMatchObject({ ok: false });
    expect(await contagens()).toEqual(antes);
  });
});
