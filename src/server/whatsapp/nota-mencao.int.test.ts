import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
// Mesmo padrão de inbox-idempotencia: mock só da fronteira auth evita import dinâmico
// concorrente do NextAuth real; usuário/papéis/ativo continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const u = await real.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new real.ErroAutenticacao();
    if (real.apenasPortal(u)) throw new real.ErroPermissao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import * as acl from "./atendimentos";
import { usuariosRelevantesParaMencao } from "@/server/inbox/usuarios-mencoes";
import { notificarMencoesNaNota, idDaNotificacaoMencao } from "@/server/inbox/mencoes";
import { listarCandidatosMencao } from "@/server/inbox/consultas-mencoes";
import { listarNotificacoes } from "@/server/crm/notificacoes";
import { hashEntrada } from "@/server/_shared/idempotencia";
import { registrarEvento } from "@/server/_shared/evento";
import { registrarNotaAtendimento } from "./acoes-conversa";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });
afterAll(() => prisma.$disconnect());
async function cenario() {
  const autor = await criarUsuario([Papel.ADMINISTRADOR], "Autora Teste");
  const destino = await criarUsuario([Papel.ADMINISTRADOR], "João Silva");
  const fora = await criarUsuario([Papel.FINANCEIRO], "Fora Escopo");
  const numero = await criarNumeroSetor({ telefoneE164: "+5500000000337", setores: ["COMERCIAL"], donoId: autor.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5500000000338" } });
  const a = await prisma.$transaction(tx => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  sessao.usuarioId = autor.id;
  return { autor, destino, fora, a };
}
const avisos = (usuarioId: string, refId: string) => prisma.notificacaoUsuario.findMany({ where: { usuarioId, refId } });

describe("#337 nota real e aviso transacional", () => {
  it("nota com alias inequívoco persiste um aviso de menção com destino de atendimento, nunca mensagem", async () => {
    const { a, destino } = await cenario();
    expect(await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João Silva, conferir.", chaveIdempotencia: "mencao-nota-01" })).toMatchObject({ ok: true });
    expect(await avisos(destino.id, a.id)).toMatchObject([{ tipo: "MENCAO_NOTA", refTipo: "AtendimentoWhatsApp", refId: a.id, titulo: "Autora Teste mencionou você numa nota" }]);
    expect(await prisma.mensagemWhatsApp.count()).toBe(0); expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
  it("mesma chave sequencial e concorrente não duplica nota nem notificação", async () => {
    const { a, destino } = await cenario();
    const entrada = { atendimentoId: a.id, nota: "@João conferir", chaveIdempotencia: "mencao-nota-02" };
    expect((await registrarNotaAtendimento(entrada)).ok).toBe(true);
    const resultado = await Promise.all([registrarNotaAtendimento(entrada), registrarNotaAtendimento(entrada)]);
    expect(resultado.every(r => r.ok)).toBe(true);
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1);
    expect(await avisos(destino.id, a.id)).toHaveLength(1);
  });
  it("menções repetidas da mesma pessoa deduplicam; autor/fora do escopo não recebem", async () => {
    const { a, autor, destino, fora } = await cenario();
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João @João Silva @Autora Teste @Fora Escopo" })).ok).toBe(true);
    expect(await avisos(destino.id, a.id)).toHaveLength(1);
    expect(await avisos(autor.id, a.id)).toHaveLength(0); expect(await avisos(fora.id, a.id)).toHaveLength(0);
  });
  it("homônimo exige token explícito; texto livre não escolhe o primeiro", async () => {
    const { a, destino } = await cenario();
    const segundo = await criarUsuario([Papel.ADMINISTRADOR], "João Silva");
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João Silva" })).ok).toBe(true);
    expect(await avisos(destino.id, a.id)).toHaveLength(0); expect(await avisos(segundo.id, a.id)).toHaveLength(0);
    const entrada = { atendimentoId: a.id, nota: "@João Silva", chaveIdempotencia: "mencao-token-01", mencoes: [{ usuarioId: segundo.id, inicio: 0, fim: 11 }] };
    expect((await registrarNotaAtendimento(entrada)).ok).toBe(true);
    expect(await avisos(segundo.id, a.id)).toHaveLength(1); expect(await avisos(destino.id, a.id)).toHaveLength(0);
  });
  it("ID/trecho incompatível não grava nota nem aviso", async () => {
    const { a, destino } = await cenario();
    const entrada = { atendimentoId: a.id, nota: "@Outra Pessoa", mencoes: [{ usuarioId: destino.id, inicio: 0, fim: 13 }] };
    expect((await registrarNotaAtendimento(entrada)).ok).toBe(false);
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(0); expect(await avisos(destino.id, a.id)).toHaveLength(0);
  });
  it("inativo e exclusivo de portal não recebem; nota válida continua interna", async () => {
    const { a, destino } = await cenario();
    await prisma.usuario.update({ where: { id: destino.id }, data: { ativo: false } });
    const portal = await criarUsuario([Papel.ALUNO], "Aluno Portal");
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João Silva @Aluno Portal" })).ok).toBe(true);
    expect(await avisos(destino.id, a.id)).toHaveLength(0); expect(await avisos(portal.id, a.id)).toHaveLength(0);
  });
});


it("duas notas reais aceitam criadaEm igual na fixture sem colisão; mesma PK continua única", async () => {
  const { a, autor, destino } = await cenario();
  await prisma.$transaction(async tx => {
    for (let i = 0; i < 2; i++) {
      const ev = await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: autor.id, payload: { nota: "@João Silva" } });
      await notificarMencoesNaNota(tx, { atendimentoId: a.id, eventoId: ev.id, autor, nota: "@João Silva" });
    }
  });
  const linhas = await avisos(destino.id, a.id); expect(linhas).toHaveLength(2);
  // Borda de constraint, não relógio do produtor: a fixture alinha explicitamente dois registros reais.
  await prisma.notificacaoUsuario.update({ where: { id: linhas[1].id }, data: { criadaEm: linhas[0].criadaEm } });
  const simultaneas = await avisos(destino.id, a.id);
  expect(simultaneas[0].criadaEm.getTime()).toBe(simultaneas[1].criadaEm.getTime()); expect(linhas[0].id).not.toBe(linhas[1].id);
  await expect(prisma.notificacaoUsuario.create({ data: { ...linhas[0] } })).rejects.toMatchObject({ code: "P2002" });
  expect(await avisos(destino.id, a.id)).toHaveLength(2);
});
it.each(["SLA_ESTOURADO", "LEMBRETE_TAREFA"] as const)("garantia temporal legada %s continua recusando a mesma tupla", async tipo => {
  const { a, destino } = await cenario();
  const original = await prisma.notificacaoUsuario.create({ data: { usuarioId: destino.id, tipo, refTipo: tipo === "SLA_ESTOURADO" ? "AtendimentoWhatsApp" : "Tarefa", refId: a.id, titulo: "Legado" } });
  await expect(prisma.notificacaoUsuario.create({ data: { usuarioId: destino.id, tipo, refTipo: original.refTipo, refId: a.id, titulo: "Repetição", criadaEm: original.criadaEm } })).rejects.toMatchObject({ code: "P2002" });
  expect(await avisos(destino.id, a.id)).toHaveLength(1);
});
it("busca normalizada encontra José fora dos primeiros200usuários do diretório", async () => {
  const { a, autor } = await cenario();
  await prisma.usuario.createMany({ data: Array.from({ length: 205 }, (_, i) => ({ nome: `AAA Pessoa ${i}`, email: `mencao-${i}@genius.test`, senhaHash: "x", papeis: [Papel.ADMINISTRADOR] })) });
  const jose = await criarUsuario([Papel.ADMINISTRADOR], "José Nunes");
  expect(await listarCandidatosMencao(autor, a.id, "JOSE")).toEqual([{ id: jose.id, nome: "José Nunes", descricao: "Administrador" }]);
});
it("mais de200candidatos relevantes não transforma amostra em alias único; token explícito ainda funciona", async () => {
  const { a, destino } = await cenario();
  await prisma.usuario.createMany({ data: Array.from({ length: 205 }, (_, i) => ({ nome: `João Exemplo ${i}`, email: `homonimo-${i}@genius.test`, senhaHash: "x", papeis: [Papel.ADMINISTRADOR] })) });
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João" })).ok).toBe(true); expect(await prisma.notificacaoUsuario.count()).toBe(0);
  const entrada = { atendimentoId: a.id, nota: "@João Silva", mencoes: [{ usuarioId: destino.id, inicio: 0, fim: 11 }] };
  expect((await registrarNotaAtendimento(entrada)).ok).toBe(true); expect(await avisos(destino.id, a.id)).toHaveLength(1);
});
it("participante somenteleitura recebe; revogação entre lista e submit exclui sem exigir envio", async () => {
  const { a, autor, destino } = await cenario();
  await prisma.usuario.update({ where: { id: destino.id }, data: { papeis: [Papel.VENDEDOR] } });
  const p = await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: a.id, usuarioId: destino.id, concedenteId: autor.id, inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 60_000), podeEnviar: false, motivo: "Apoio interno fictício" } });
  expect(await listarCandidatosMencao(autor, a.id, "Joao")).toMatchObject([{ id: destino.id }]);
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João Silva" })).ok).toBe(true); expect(await avisos(destino.id, a.id)).toHaveLength(1);
  await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { revogadoEm: new Date() } });
  const entrada = { atendimentoId: a.id, nota: "@João Silva", mencoes: [{ usuarioId: destino.id, inicio: 0, fim: 11 }] };
  expect((await registrarNotaAtendimento(entrada)).ok).toBe(true); expect(await avisos(destino.id, a.id)).toHaveLength(1);
  const fresco = await prisma.usuario.findUniqueOrThrow({ where: { id: destino.id } }); expect(await listarNotificacoes(fresco)).toEqual([]);
});
it("permissão negada ao autor não grava nenhuma nota/aviso", async () => {
  const { a, fora } = await cenario(); sessao.usuarioId = fora.id;
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João Silva" })).ok).toBe(false); expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(0); expect(await prisma.notificacaoUsuario.count()).toBe(0);
});
it("mesma chave e outro homônimo selecionado conflita mesmo com texto igual", async () => {
  const { a, destino } = await cenario(); const segundo = await criarUsuario([Papel.ADMINISTRADOR], "João Silva");
  const entrada = { atendimentoId: a.id, nota: "@João Silva", chaveIdempotencia: "mencao-identidade-01", mencoes: [{ usuarioId: destino.id, inicio: 0, fim: 11 }] };
  expect((await registrarNotaAtendimento(entrada)).ok).toBe(true);
  expect((await registrarNotaAtendimento({ ...entrada, mencoes: [{ usuarioId: segundo.id, inicio: 0, fim: 11 }] })).ok).toBe(false);
  expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1); expect(await prisma.notificacaoUsuario.count()).toBe(1);
});
it("ordem dos metadados é canônica e replay não depende da ordem recebida", async () => {
  const { a, destino } = await cenario(); const maria = await criarUsuario([Papel.ADMINISTRADOR], "Maria Ramos");
  const primeiro = { usuarioId: destino.id, inicio: 0, fim: 11 }, segundo = { usuarioId: maria.id, inicio: 12, fim: 24 };
  const entrada = { atendimentoId: a.id, nota: "@João Silva @Maria Ramos", chaveIdempotencia: "mencao-ordem-01" };
  expect((await registrarNotaAtendimento({ ...entrada, mencoes: [segundo, primeiro] })).ok).toBe(true);
  expect((await registrarNotaAtendimento({ ...entrada, mencoes: [primeiro, segundo] })).ok).toBe(true); expect(await prisma.notificacaoUsuario.count()).toBe(2);
});
it("replay anterior sem campo conserva hash CRLF e não cria aviso novo retroativo", async () => {
  const { a, autor } = await cenario(); const nota = "primeira\r\n@João", chaveIdempotencia = "legado-nota-crlf-01";
  await prisma.$transaction(tx => registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: autor.id, payload: { nota, chaveIdempotencia, entradaHash: hashEntrada({ atendimentoId: a.id, nota }) } }));
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota, chaveIdempotencia })).ok).toBe(true); expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1); expect(await prisma.notificacaoUsuario.count()).toBe(0);
});
it("replay após autor perder escopo retorna criação original sem reenviar; chave nova é recusada", async () => {
  const { a, autor, destino } = await cenario(); const entrada = { atendimentoId: a.id, nota: "@João Silva", chaveIdempotencia: "nota-replay-tardio-01" };
  expect((await registrarNotaAtendimento(entrada)).ok).toBe(true); await prisma.usuario.update({ where: { id: autor.id }, data: { papeis: [Papel.FINANCEIRO] } });
  expect((await registrarNotaAtendimento(entrada)).ok).toBe(true); expect((await registrarNotaAtendimento({ ...entrada, chaveIdempotencia: "nota-replay-tardio-02" })).ok).toBe(false); expect(await avisos(destino.id, a.id)).toHaveLength(1);
});
it("falha na criação de um aviso reverte a nota inteira, sem skipDuplicates", async () => {
  const { a, autor, destino } = await cenario(); const eventoId = "nota-rollback-337";
  await prisma.notificacaoUsuario.create({ data: { id: idDaNotificacaoMencao(eventoId, destino.id), usuarioId: destino.id, tipo: "MENCAO_NOTA", refTipo: "AtendimentoWhatsApp", refId: a.id, titulo: "Registro anterior" } });
  await expect(prisma.$transaction(async tx => {
    await tx.evento.create({ data: { id: eventoId, tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: autor.id, payload: { nota: "@João Silva" } } });
    await notificarMencoesNaNota(tx, { atendimentoId: a.id, eventoId, autor, nota: "@João Silva" });
  })).rejects.toMatchObject({ code: "P2002" });
  expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(0); expect(await avisos(destino.id, a.id)).toHaveLength(1);
});

it("sino preserva SLA21 e lembrete22 depois de vinte mencoes com leitura revogada", async () => {
  const { a, destino } = await cenario();
  const usuario = await prisma.usuario.update({ where: { id: destino.id }, data: { papeis: [Papel.VENDEDOR] } });
  await prisma.notificacaoUsuario.createMany({ data: [
    ...Array.from({ length: 20 }, (_, i) => ({
      id: "p2-revogada-" + i, usuarioId: destino.id, tipo: "MENCAO_NOTA" as const,
      refTipo: "AtendimentoWhatsApp", refId: a.id, titulo: "Mencao sem leitura atual",
      criadaEm: new Date("2026-10-20T12:00:00Z"),
    })),
    { id: "p2-sla-21", usuarioId: destino.id, tipo: "SLA_ESTOURADO",
      refTipo: "AtendimentoWhatsApp", refId: a.id, titulo: "SLA legado", criadaEm: new Date("2026-10-20T11:00:00Z") },
    { id: "p2-lembrete-22", usuarioId: destino.id, tipo: "LEMBRETE_TAREFA",
      refTipo: "Tarefa", refId: "tarefa-ficticia-p2", titulo: "Lembrete legado", criadaEm: new Date("2026-10-20T10:00:00Z") },
  ] });
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(["p2-sla-21", "p2-lembrete-22"]);
});

it("sino atravessa dois lotes revogados e respeita ordem PostgreSQL de mencoes visiveis empatadas", async () => {
  const { a, autor, destino } = await cenario();
  const usuario = await prisma.usuario.update({ where: { id: destino.id }, data: { papeis: [Papel.VENDEDOR] } });
  const conversa = await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: a.conversaId } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5500000000339" } });
  const visivel = await prisma.$transaction(tx => garantirAtendimento(tx, {
    numeroId: conversa.numeroId, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id,
  }));
  await prisma.participanteAtendimentoWhatsApp.create({ data: {
    atendimentoId: visivel.id, usuarioId: destino.id, concedenteId: autor.id, podeEnviar: false,
    inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 60_000), motivo: "Leitura interna ficticia",
  } });
  const validas = Array.from({ length: 21 }, (_, i) => ({
    id: "p2-valida-" + String(i).padStart(3, "0"), usuarioId: destino.id, tipo: "MENCAO_NOTA" as const,
    refTipo: "AtendimentoWhatsApp", refId: visivel.id, titulo: "Mencao com leitura atual",
    criadaEm: new Date("2026-10-20T11:00:00Z"),
  }));
  await prisma.notificacaoUsuario.createMany({ data: [
    ...Array.from({ length: 205 }, (_, i) => ({
      id: "p2-revogada-" + String(i).padStart(3, "0"), usuarioId: destino.id, tipo: "MENCAO_NOTA" as const,
      refTipo: "AtendimentoWhatsApp", refId: a.id, titulo: "Mencao sem leitura atual",
      criadaEm: new Date("2026-10-20T12:00:00Z"),
    })),
    ...validas,
  ] });
  const ordemDoBanco = await prisma.notificacaoUsuario.findMany({
    where: { usuarioId: destino.id, id: { in: validas.map(n => n.id) } },
    orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 20, select: { id: true },
  });
  expect(ordemDoBanco).toHaveLength(20);
  const lista = await listarNotificacoes(usuario);
  expect(lista.map(n => n.id)).toEqual(ordemDoBanco.map(n => n.id));
  expect(lista.every(n => n.refId === visivel.id)).toBe(true);
});
it("ACL fresca conserva fallback do nome longo oculto para o curto visivel", async () => {
  const { a, destino } = await cenario();
  await prisma.usuario.update({ where: { id: destino.id }, data: { nome: "Ana Souza" } });
  await criarUsuario([Papel.VENDEDOR], "Ana Silva");
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@Ana Silva" })).ok).toBe(true);
  expect(await avisos(destino.id, a.id)).toHaveLength(1);
});
it("alias completo visivel ambiguo bloqueia fallback curto mesmo quando unico", async () => {
  const { a, destino } = await cenario();
  await prisma.usuario.update({ where: { id: destino.id }, data: { nome: "Ana Souza" } });
  const a1 = await criarUsuario([Papel.ADMINISTRADOR], "Ana Silva");
  const a2 = await criarUsuario([Papel.ADMINISTRADOR], "Ana Silva");
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@Ana Silva" })).ok).toBe(true);
  expect(await prisma.notificacaoUsuario.count({ where: { usuarioId: { in: [destino.id, a1.id, a2.id] } } })).toBe(0);
});
it("homonimo global oculto nao impede nome curto unico entre autorizados", async () => {
  const { a, destino } = await cenario();
  await prisma.usuario.update({ where: { id: destino.id }, data: { nome: "Ana Souza" } });
  await criarUsuario([Papel.VENDEDOR], "Ana Lima");
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@Ana" })).ok).toBe(true);
  expect(await avisos(destino.id, a.id)).toHaveLength(1);
});
it("sino refaz escopo entre chamadas apos revogar o convite", async () => {
  const { a, autor, destino } = await cenario();
  const leitor = await prisma.usuario.update({ where: { id: destino.id }, data: { papeis: [Papel.VENDEDOR] } });
  const convite = await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: a.id, usuarioId: destino.id, concedenteId: autor.id, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 60000), podeEnviar: false, motivo: "Leitura ficticia C4" } });
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@João Silva" })).ok).toBe(true);
  expect((await listarNotificacoes(leitor)).map(n => n.refId)).toEqual([a.id]);
  await prisma.participanteAtendimentoWhatsApp.update({ where: { id: convite.id }, data: { revogadoEm: new Date() } });
  expect(await listarNotificacoes(leitor)).toEqual([]);
});

it("nome completo entre duzentos candidatos reais consulta ACL de um destinatario", async () => {
  const { a, autor, destino } = await cenario();
  await prisma.usuario.update({ where: { id: destino.id }, data: { nome: "Ana Silva" } });
  await prisma.usuario.createMany({ data: Array.from({ length: 199 }, (_, i) => ({ nome: "Ana Exemplo " + i, email: "c3-ana-" + i + "@genius.test", senhaHash: "x", papeis: [Papel.ADMINISTRADOR] })) });
  expect(await usuariosRelevantesParaMencao(prisma, autor.id, { primeiros: ["ana"] })).toHaveLength(200);
  const observar = vi.spyOn(acl, "atendimentoVisivel");
  try {
    expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "@Ana Silva" })).ok).toBe(true);
    const destinatarios = observar.mock.calls.filter(([p]) => p.id !== autor.id);
    expect(destinatarios.map(([p]) => p.id)).toEqual([destino.id]);
    expect(destinatarios[0][3]).toBeDefined();
    expect(await avisos(destino.id, a.id)).toHaveLength(1);
  } finally { observar.mockRestore(); }
});
