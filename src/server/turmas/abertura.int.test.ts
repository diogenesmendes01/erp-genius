// #539 — "Abrir turma" / "Voltar para planejada". Integração com Postgres (fora do CI, ver #538):
// npm run test:int -- src/server/turmas/abertura.int.test.ts src/server/turmas/integridade-academica.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma, type StatusTurma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Mesmo padrão de turma-idempotencia.int.test.ts: sem o import() dinâmico de "@/lib/auth" em sessao.ts, que no
// Vitest pode resolver o next-auth real quando duas ações começam juntas (Promise.all). Sessão continua vindo do authMock
// e o usuário é recarregado do banco (ativo/papéis reais).
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const s = (await authMock()) as { user?: { id?: string } } | null;
    const u = s?.user?.id ? await o.carregarUsuarioFresco(s.user.id) : null;
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { abrirTurma, alterarStatusTurma, voltarTurmaParaPlanejada } from "./acoes";
import { listarTurmasAbertas } from "@/server/matricula/consultas";
import { reservarVagaMatriculaTx } from "@/server/matricula/reserva-vaga-tx";
import { vagasTurma } from "@/server/alunos/consultas";

const DIA = 86_400_000;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function cenario({ status = "PLANEJADA" as StatusTurma, capacidade = 2 } = {}) {
  await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60 } });
  const c = await seedCatalogoMinimo();
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica");
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor");
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: c.produto.id } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: produto.idiomaId, codigo: "ABRE", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: produto.modalidadeId, nivelId: nivel.id, professorId: professor.id,
    capacidade, status, dataInicio: new Date("2099-10-01"), vinculosDocentes: { create: { professorId: professor.id, inicio: new Date() } } } });
  const janela = await prisma.janelaAdmissaoTurma.create({ data: { turmaId: turma.id, preparadorId: secretaria.id, versao: 1, limiteEntrada: new Date("2099-12-31"),
    fusoAdmissao: "UTC", motivo: "Fixture janela", chaveIdempotencia: "janela-abertura", entradaHash: "fixture" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: gestor.id, aprovada: true, motivo: "Fixture decisão" } });
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretaria.id, fusoInstitucional: "UTC", periodos: [],
    motivo: "Fixture", chaveIdempotencia: "calendario-abertura", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: gestor.id, aprovada: true, motivo: "Fixture" } });
  const grade = await prisma.propostaGradeTurma.create({ data: { turmaId: turma.id, calendarioId: calendario.id, preparadorId: secretaria.id, versao: 1,
    fusoOrigem: "UTC", motivo: "Fixture", chaveIdempotencia: "grade-abertura", entradaHash: "fixture", snapshot: {} } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: gestor.id, aprovada: true, motivo: "Fixture" } });
  const encontro = await prisma.encontroAgenda.create({ data: { turmaId: turma.id, propostaGradeId: grade.id, professorId: professor.id, preparadorId: secretaria.id,
    inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Fixture",
    chaveIdempotencia: "encontro-abertura", entradaHash: "fixture" } });
  const matriculas: string[] = [];
  for (let i = 0; i < 2; i++) {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno ${i}`, paisId: c.pais.id } });
    matriculas.push((await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: c.pais.id, moeda: "CRC" } })).id);
  }
  entrar(gestor.id);
  const reserva = (i: number) => ({ matriculaId: matriculas[i], turmaId: turma.id, autorId: secretaria.id,
    motivo: "Reserva na preparação do contrato", chaveIdempotencia: `reserva-abertura-${i}` });
  const alocar = async () => {
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
    return prisma.alocacaoTurma.create({ data: { alunoId: m.alunoId, matriculaId: m.id, turmaId: turma.id, ativa: true } });
  };
  return { c, gestor, secretaria, turma, encontro, reserva, alocar };
}

const statusDe = async (id: string) => (await prisma.turma.findUniqueOrThrow({ where: { id } })).status;
const tipos = async (id: string) => (await eventosDo("Turma", id)).map((e) => e.tipo);

function sinal() {
  let liberar!: () => void;
  const promessa = new Promise<void>((resolve) => { liberar = resolve; });
  return { promessa, liberar };
}

async function esperarBloqueados(pid: number, quantidade: number) {
  const limite = Date.now() + 5000;
  while (Date.now() < limite) {
    const [r] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity a WHERE cardinality(pg_blocking_pids(a.pid)) > 0
        AND (${pid} = ANY(pg_blocking_pids(a.pid)) OR EXISTS (SELECT 1 FROM pg_stat_activity b WHERE b.pid = ANY(pg_blocking_pids(a.pid)) AND ${pid} = ANY(pg_blocking_pids(b.pid))))`;
    if (r.n >= quantidade) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`esperava ${quantidade} sessão(ões) aguardando o lock da turma`);
}

/** Segura o lock da turma numa tx externa enquanto `acao` começa; `mudar` roda antes do commit. */
async function duranteEspera<T>(turmaId: string, acao: () => Promise<T>, mudar: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  const pronto = sinal(), liberar = sinal();
  let pid = 0;
  const bloqueador = prisma.$transaction(async (tx) => {
    pid = (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${turmaId} FOR UPDATE`;
    pronto.liberar();
    await liberar.promessa;
    await mudar(tx);
  }, { timeout: 10000 });
  await Promise.race([pronto.promessa, bloqueador]);
  const pendente = acao();
  try { await esperarBloqueados(pid, 1); } finally { liberar.liberar(); await bloqueador; }
  return pendente;
}

beforeEach(async () => { vi.clearAllMocks(); await truncarBanco(); });

describe("abrirTurma (#539)", () => {
  it("A1: gestor abre PLANEJADA; ela aparece em Nova matrícula com vaga e some de turmasComVaga quando lota", async () => {
    const c = await cenario();
    expect(await abrirTurma(c.turma.id)).toEqual({ ok: true, dado: undefined });
    expect(await statusDe(c.turma.id)).toBe("ABERTA");
    entrar(c.secretaria.id);
    const listada = (await listarTurmasAbertas()).find((t) => t.id === c.turma.id);
    expect(listada).toBeDefined();
    expect(vagasTurma(listada!.capacidade, listada!._count.alocacoes + listada!._count.reservasMatricula)).toBe(2);
    await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, c.reserva(0)));
    await c.alocar();
    const lotada = (await listarTurmasAbertas()).filter((t) => t.id === c.turma.id)
      .filter((t) => vagasTurma(t.capacidade, t._count.alocacoes + t._count.reservasMatricula) > 0);
    expect(lotada).toEqual([]);
  });

  it.each(["sem papel", "inativo"] as const)("A2: usuário %s recebe recusa de permissão sem gravar", async (caso) => {
    const c = await cenario();
    if (caso === "sem papel") entrar(c.secretaria.id);
    else await prisma.usuario.update({ where: { id: c.gestor.id }, data: { ativo: false } });
    const r = await abrirTurma(c.turma.id);
    expect(r.ok).toBe(false);
    expect(await statusDe(c.turma.id)).toBe("PLANEJADA");
    expect(await tipos(c.turma.id)).toEqual([]);
  });

  it.each(["papel", "desativação"] as const)("A2: revogação por %s durante a espera do lock é revalidada na tx", async (revogacao) => {
    const c = await cenario();
    const r = await duranteEspera(c.turma.id, () => abrirTurma(c.turma.id), (tx) => tx.usuario.update({ where: { id: c.gestor.id },
      data: revogacao === "papel" ? { papeis: [Papel.SECRETARIA_ACADEMICA] } : { ativo: false } }));
    expect(r.ok).toBe(false);
    expect(await statusDe(c.turma.id)).toBe("PLANEJADA");
    expect(await tipos(c.turma.id)).toEqual([]);
  });

  it.each([
    ["CONCLUIDA", "reaberta"], ["EM_ANDAMENTO", "Transição de status inválida: EM_ANDAMENTO → ABERTA."],
  ] as const)("A3: %s → ABERTA é recusada sem efeito", async (status, erro) => {
    const c = await cenario({ status });
    expect(await abrirTurma(c.turma.id)).toMatchObject({ ok: false, erro: expect.stringContaining(erro) });
    expect(await statusDe(c.turma.id)).toBe(status);
    expect(await tipos(c.turma.id)).toEqual([]);
  });

  it("A3: turma já iniciada pela agenda não abre; id vazio, inexistente e status fora do enum são recusados", async () => {
    const c = await cenario();
    await prisma.encontroAgenda.update({ where: { id: c.encontro.id }, data: { inicio: new Date(Date.now() - DIA), fim: new Date(Date.now() - DIA + 3600_000) } });
    expect(await abrirTurma(c.turma.id)).toMatchObject({ ok: false, erro: expect.stringContaining("já iniciou") });
    expect(await abrirTurma("")).toMatchObject({ ok: false });
    expect(await abrirTurma(123 as unknown as string)).toMatchObject({ ok: false });
    expect(await abrirTurma("turma-inexistente")).toMatchObject({ ok: false, erro: expect.stringContaining("não encontrada") });
    expect(await alterarStatusTurma(c.turma.id, "ATIVA" as StatusTurma)).toMatchObject({ ok: false, erro: expect.stringContaining("Status") });
    expect(await statusDe(c.turma.id)).toBe("PLANEJADA");
    expect(await tipos(c.turma.id)).toEqual([]);
  });

  it("A3: alterarStatusTurma também aplica a tabela (ABERTA → CONCLUIDA recusada)", async () => {
    const c = await cenario({ status: "ABERTA" });
    expect(await alterarStatusTurma(c.turma.id, "CONCLUIDA")).toMatchObject({ ok: false, erro: "Transição de status inválida: ABERTA → CONCLUIDA." });
    expect(await statusDe(c.turma.id)).toBe("ABERTA");
  });

  it("A4: grava TurmaAberta com autor da sessão e payload sem PII", async () => {
    const c = await cenario();
    expect((await abrirTurma(c.turma.id)).ok).toBe(true);
    const eventos = await eventosDo("Turma", c.turma.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "TurmaAberta", autorId: c.gestor.id,
      payload: { de: "PLANEJADA", para: "ABERTA", origem: "configuracao-turmas" } });
    expect(Object.keys(eventos[0].payload as object).sort()).toEqual(["de", "origem", "para"]);
  });

  it.each(["sequencial", "Promise.all"] as const)("A5: abrir duas vezes (%s) deixa um evento e a turma ABERTA", async (modo) => {
    const c = await cenario();
    const r = modo === "sequencial"
      ? [await abrirTurma(c.turma.id), await abrirTurma(c.turma.id)]
      : await Promise.all([abrirTurma(c.turma.id), abrirTurma(c.turma.id)]);
    expect(r.map((x) => x.ok)).toEqual([true, true]);
    expect(await statusDe(c.turma.id)).toBe("ABERTA");
    expect(await tipos(c.turma.id)).toEqual(["TurmaAberta"]);
  });

  it("A6: updateMany com where status recusa quando o status mudou entre a leitura e a escrita", async () => {
    const c = await cenario({ status: "EM_ANDAMENTO" });
    const original = prisma.$transaction.bind(prisma) as (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, o?: unknown) => Promise<unknown>;
    vi.spyOn(prisma, "$transaction").mockImplementationOnce(((fn: (tx: Prisma.TransactionClient) => Promise<unknown>, o?: unknown) => original((tx) => {
      const turma = new Proxy(tx.turma, { get: (alvo, p) => p === "findUnique"
        ? async (args: Prisma.TurmaFindUniqueArgs) => { const t = await alvo.findUnique(args); return t && { ...t, status: "PLANEJADA" }; }
        : Reflect.get(alvo, p) });
      return fn(new Proxy(tx, { get: (alvo, p) => (p === "turma" ? turma : Reflect.get(alvo, p)) }));
    }, o)) as never);
    expect(await abrirTurma(c.turma.id)).toEqual({ ok: false, erro: "A turma mudou de status; recarregue." });
    expect(await statusDe(c.turma.id)).toBe("EM_ANDAMENTO");
    expect(await tipos(c.turma.id)).toEqual([]);
  });
});

describe("voltarTurmaParaPlanejada (#539)", () => {
  it("V1: ABERTA sem ocupação volta para PLANEJADA e grava TurmaPlanejada; repetir não duplica", async () => {
    const c = await cenario();
    expect((await abrirTurma(c.turma.id)).ok).toBe(true);
    expect((await voltarTurmaParaPlanejada(c.turma.id)).ok).toBe(true);
    expect((await voltarTurmaParaPlanejada(c.turma.id)).ok).toBe(true);
    expect(await statusDe(c.turma.id)).toBe("PLANEJADA");
    const eventos = await eventosDo("Turma", c.turma.id);
    expect(eventos.map((e) => e.tipo)).toEqual(["TurmaAberta", "TurmaPlanejada"]);
    expect(eventos[1]).toMatchObject({ autorId: c.gestor.id, payload: { de: "ABERTA", para: "PLANEJADA", origem: "configuracao-turmas" } });
  });

  it.each(["alocação ativa", "reserva ATIVA", "reserva MANTIDA_PENDENCIA"] as const)("V2: com %s é recusada", async (caso) => {
    const c = await cenario({ status: "ABERTA" });
    if (caso === "alocação ativa") await c.alocar();
    else {
      const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, c.reserva(0)));
      if (caso === "reserva MANTIDA_PENDENCIA") await prisma.reservaVagaMatricula.update({ where: { id: r.id }, data: { status: "MANTIDA_PENDENCIA" } });
    }
    expect(await voltarTurmaParaPlanejada(c.turma.id)).toEqual({ ok: false, erro: "Turma com matrícula ou reserva não pode voltar para planejada." });
    expect(await statusDe(c.turma.id)).toBe("ABERTA");
    expect(await tipos(c.turma.id)).toEqual([]);
  });

  it("V2: reserva liberada não ocupa e não impede a volta", async () => {
    const c = await cenario({ status: "ABERTA" });
    const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, c.reserva(0)));
    await prisma.reservaVagaMatricula.update({ where: { id: r.id }, data: { status: "LIBERADA" } });
    expect((await voltarTurmaParaPlanejada(c.turma.id)).ok).toBe(true);
  });

  it("V3: reserva criada e ainda não confirmada faz a volta esperar e depois recusar (nunca PLANEJADA com reserva anterior)", async () => {
    const c = await cenario({ status: "ABERTA" });
    const pronto = sinal(), liberar = sinal();
    let pid = 0;
    const reservando = prisma.$transaction(async (tx) => {
      pid = (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
      const r = await reservarVagaMatriculaTx(tx, c.reserva(0));
      pronto.liberar();
      await liberar.promessa;
      return r;
    }, { timeout: 10000 });
    await Promise.race([pronto.promessa, reservando]);
    const voltando = voltarTurmaParaPlanejada(c.turma.id);
    try { await esperarBloqueados(pid, 1); } finally { liberar.liberar(); }
    await reservando;
    expect(await voltando).toEqual({ ok: false, erro: "Turma com matrícula ou reserva não pode voltar para planejada." });
    expect(await statusDe(c.turma.id)).toBe("ABERTA");
    expect(await prisma.reservaVagaMatricula.count({ where: { turmaId: c.turma.id, status: "ATIVA" } })).toBe(1);
    expect(await tipos(c.turma.id)).toEqual([]);
  });

  it("V3: com a volta na frente, a reserva concorrente espera o commit e só é criada depois (pré-venda em PLANEJADA, por design)", async () => {
    const c = await cenario({ status: "ABERTA" });
    let liberadoEm = 0;
    const pronto = sinal(), liberar = sinal();
    let pid = 0;
    const bloqueador = prisma.$transaction(async (tx) => {
      pid = (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${c.turma.id} FOR UPDATE`;
      pronto.liberar();
      await liberar.promessa;
    }, { timeout: 10000 });
    await Promise.race([pronto.promessa, bloqueador]);
    const voltando = voltarTurmaParaPlanejada(c.turma.id);
    await esperarBloqueados(pid, 1);
    const reservando = prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, c.reserva(0)), { timeout: 10000 });
    try { await esperarBloqueados(pid, 2); } finally { liberadoEm = Date.now(); liberar.liberar(); await bloqueador; }
    const [volta, reserva] = await Promise.all([voltando, reservando]);
    expect(volta).toEqual({ ok: true, dado: undefined });
    const criada = await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } });
    const [evento] = await eventosDo("Turma", c.turma.id);
    expect(evento.tipo).toBe("TurmaPlanejada");
    expect(criada.criadaEm.getTime()).toBeGreaterThanOrEqual(liberadoEm);
    expect(await statusDe(c.turma.id)).toBe("PLANEJADA");
  });

  it("V3: disputa Promise.all repetida nunca termina PLANEJADA com reserva criada antes da volta", async () => {
    for (let rodada = 0; rodada < 5; rodada++) {
      await truncarBanco();
      const c = await cenario({ status: "ABERTA" });
      const [volta] = await Promise.all([voltarTurmaParaPlanejada(c.turma.id), prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, c.reserva(0)))]);
      const status = await statusDe(c.turma.id);
      const evento = (await eventosDo("Turma", c.turma.id)).find((e) => e.tipo === "TurmaPlanejada");
      if (volta.ok) {
        expect(status).toBe("PLANEJADA");
        expect(evento).toBeDefined();
      } else {
        expect(volta.erro).toBe("Turma com matrícula ou reserva não pode voltar para planejada.");
        expect(status).toBe("ABERTA");
        expect(evento).toBeUndefined();
      }
      expect(await prisma.reservaVagaMatricula.count({ where: { turmaId: c.turma.id } })).toBe(1);
    }
  });
});
