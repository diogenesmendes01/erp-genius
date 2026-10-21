import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUnique({
      where: { id: autenticacao.user.id },
      select: { id: true, nome: true, ativo: true, papeis: true },
    });
    if (!usuario?.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return {
    ...atual,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const usuario = await sessao();
      atual.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { reservarVagaMatriculaTx } from "./reserva-vaga-tx";
import { reservarAgendaParticularTx } from "./reserva-particular-tx";
import { conferirAgendaParticularTx } from "./agenda-particular-estado";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { efetivarPedidoDesistenciaPreparacao } from "./desistencia-efetivacao";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let administradora: typeof secretaria;
let professor: typeof secretaria;
let vendedor: typeof secretaria;
let financeiro: typeof secretaria;
let secretariaInativa: typeof secretaria;
let matriculaId: string;
let outraMatriculaId: string;
let alunoId: string;
let turmaId: string;
let paisId: string;
let produtoId: string;

const motivoPedido = "Pessoa desistiu antes de formalizar a contratação.";
const evidenciaPedido = "Atendimento identificado e disponível para conferência administrativa.";
const motivoEfetivacao = "Desistência sem avanço formal conferida pela Secretaria.";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function conferir(matricula = matriculaId) {
  entrar(secretaria.id);
  const resultado = await consultarDesistenciaPreparacao({ matriculaId: matricula });
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok || !resultado.dado) throw new Error("Conferência de desistência ausente.");
  return resultado.dado;
}

async function registrarPedido(matricula = matriculaId, sufixo = "principal") {
  const atual = await conferir(matricula);
  const resultado = await registrarPedidoDesistenciaPreparacao({
    matriculaId: matricula,
    estadoHash: atual.estadoHash,
    motivo: motivoPedido,
    evidenciaPedido,
    chaveIdempotencia: `pedido-efetivacao-${sufixo}`,
  });
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok || !resultado.dado) throw new Error("Pedido de desistência ausente.");
  return prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: resultado.dado.id } });
}

async function efetivar(pedidoId: string, estadoHash: string) {
  return efetivarPedidoDesistenciaPreparacao({ pedidoId, estadoHash, motivo: motivoEfetivacao });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  paisId = catalogo.pais.id;
  produtoId = catalogo.produto.id;
  [secretaria, administradora, professor, vendedor, financeiro, secretariaInativa] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.ADMINISTRADOR], "Administração"),
    criarUsuario([Papel.PROFESSOR], "Professor"),
    criarUsuario([Papel.VENDEDOR], "Vendedor"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro"),
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria inativa"),
  ]);
  await prisma.usuario.update({ where: { id: secretariaInativa.id }, data: { ativo: false } });
  await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60 } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "DESISTENCIA", ordem: 1 } });
  const turma = await prisma.turma.create({
    data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, capacidade: 2 },
  });
  turmaId = turma.id;
  const janela = await prisma.janelaAdmissaoTurma.create({
    data: {
      turmaId,
      preparadorId: secretaria.id,
      versao: 1,
      limiteEntrada: new Date("2099-12-31T00:00:00.000Z"),
      fusoAdmissao: "UTC",
      motivo: "Janela de admissão da fixture.",
      chaveIdempotencia: "janela-desistencia-fixture",
      entradaHash: "fixture",
    },
  });
  await prisma.decisaoJanelaAdmissao.create({
    data: { propostaId: janela.id, decisorId: administradora.id, aprovada: true, motivo: "Janela conferida." },
  });
  const calendario = await prisma.versaoCalendarioEscolar.create({
    data: {
      versao: 1,
      preparadorId: secretaria.id,
      fusoInstitucional: "UTC",
      periodos: [],
      motivo: "Calendário da fixture.",
      chaveIdempotencia: "calendario-desistencia-fixture",
      entradaHash: "fixture",
    },
  });
  await prisma.decisaoCalendarioEscolar.create({
    data: { calendarioId: calendario.id, decisorId: administradora.id, aprovada: true, motivo: "Calendário conferido." },
  });
  const grade = await prisma.propostaGradeTurma.create({
    data: {
      turmaId,
      calendarioId: calendario.id,
      preparadorId: secretaria.id,
      versao: 1,
      fusoOrigem: "UTC",
      motivo: "Grade da fixture.",
      chaveIdempotencia: "grade-desistencia-fixture",
      entradaHash: "fixture",
      snapshot: {},
    },
  });
  await prisma.decisaoGradeTurma.create({
    data: { propostaId: grade.id, decisorId: administradora.id, aprovada: true, motivo: "Grade conferida." },
  });
  await prisma.encontroAgenda.create({
    data: {
      turmaId,
      propostaGradeId: grade.id,
      professorId: professor.id,
      preparadorId: secretaria.id,
      inicio: new Date("2099-10-02T12:00:00.000Z"),
      fim: new Date("2099-10-02T13:00:00.000Z"),
      fusoOrigem: "UTC",
      finalidade: "AULA",
      status: "PREVISTO",
      motivo: "Agenda publicada da fixture.",
      chaveIdempotencia: "encontro-desistencia-fixture",
      entradaHash: "fixture",
    },
  });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa", paisId } });
  alunoId = aluno.id;
  const [matricula, outra] = await Promise.all([
    prisma.matricula.create({ data: { alunoId, produtoId, paisId, moeda: "CRC", status: "AGUARDANDO" } }),
    prisma.matricula.create({ data: { alunoId, produtoId, paisId, moeda: "CRC", status: "AGUARDANDO" } }),
  ]);
  matriculaId = matricula.id;
  outraMatriculaId = outra.id;
  entrar(secretaria.id);
});

async function reservarVaga(
  matricula = matriculaId,
  chaveIdempotencia = "reserva-desistencia-fixture",
) {
  return prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, {
    matriculaId: matricula,
    turmaId,
    autorId: secretaria.id,
    motivo: "Reserva real da preparação que será desistida.",
    chaveIdempotencia,
  }));
}

async function reservarAgendaParticular() {
  const oferta = await prisma.produtoPais.findFirstOrThrow({ where: { produtoId, paisId } });
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "PARTICULAR_FLEXIVEL" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  const agenda = {
    ofertaId: oferta.id,
    versaoOferta: oferta.versaoEntrada,
    professorId: professor.id,
    fusoOrigem: "UTC",
    encontros: [{ data: "2099-10-01", horario: "13:00", duracaoMinutos: 60 }],
  };
  const previa = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
  expect(previa.snapshot.impedimentos).toEqual([]);
  return prisma.$transaction((tx) => reservarAgendaParticularTx(tx, {
    ...agenda,
    matriculaId,
    autorId: secretaria.id,
    motivo: "Horário particular real da preparação que será desistida.",
    chaveIdempotencia: "reserva-particular-desistencia-fixture",
    estadoHash: previa.estadoHash,
    horariosAcordadosConferidos: true,
  }));
}

describe("efetivação da desistência em preparação", () => {
  it("cancela somente a matrícula conferida, libera a reserva e repete sem duplicar", async () => {
    const reserva = await reservarVaga();
    const pedido = await registrarPedido();
    const antes = {
      cobrancas: await prisma.cobranca.count(),
      documentos: await prisma.documento.count(),
      recebimentos: await prisma.recebimento.count(),
      alocacoes: await prisma.alocacaoTurma.count(),
    };

    const [primeiro, segundo] = await Promise.all([
      efetivar(pedido.id, pedido.estadoHash),
      efetivar(pedido.id, pedido.estadoHash),
    ]);
    expect(primeiro.ok, primeiro.ok ? undefined : primeiro.erro).toBe(true);
    expect(primeiro.ok && primeiro.dado).toMatchObject({ matriculaId, status: "CANCELADA" });
    expect(segundo).toEqual(primeiro);

    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "CANCELADA" });
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraMatriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "LIBERADA" });
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count()).toBe(1);
    expect(await prisma.cobranca.count()).toBe(antes.cobrancas);
    expect(await prisma.documento.count()).toBe(antes.documentos);
    expect(await prisma.recebimento.count()).toBe(antes.recebimentos);
    expect(await prisma.alocacaoTurma.count()).toBe(antes.alocacoes);
  });

  it("libera reserva particular e seus horários sem tocar no outro contrato", async () => {
    const reserva = await reservarAgendaParticular();
    const pedido = await registrarPedido();
    const resultado = await efetivar(pedido.id, pedido.estadoHash);
    expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "CANCELADA" });
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraMatriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.reservaAgendaParticular.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "LIBERADA" });
    expect(await prisma.horarioReservaParticular.findMany({ where: { reservaId: reserva.id } })).toHaveLength(1);
    expect(await prisma.reservaVagaMatricula.count({ where: { matriculaId: outraMatriculaId } })).toBe(0);
    expect(await prisma.reservaAgendaParticular.count({ where: { matriculaId: outraMatriculaId } })).toBe(0);
  });

  it("recusa hash obsoleto e pedido que deixou de ser a última versão, sem liberar reserva", async () => {
    const reserva = await reservarVaga();
    const primeiro = await registrarPedido(matriculaId, "primeiro");
    const segundo = await registrarPedido(matriculaId, "segundo");
    expect((await efetivar(primeiro.id, primeiro.estadoHash)).ok).toBe(false);
    expect(await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "ATIVA" });

    const antesMudanca = await conferir();
    await prisma.documento.create({
      data: { matriculaId, categoria: "PROPOSTA", nome: "Documento posterior", url: "/api/files/documento-posterior.pdf" },
    });
    expect((await efetivar(segundo.id, antesMudanca.estadoHash)).ok).toBe(false);
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count()).toBe(0);
    expect(await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "ATIVA" });
  });

  it.each(["cobranca", "documento", "alocacao"] as const)("bloqueia avanço formal por %s após o pedido", async (tipo) => {
    const pedido = await registrarPedido(matriculaId, `bloqueio-${tipo}`);
    if (tipo === "cobranca") {
      await prisma.cobranca.create({
        data: {
          matriculaId,
          tipo: TipoCobranca.MATRICULA,
          valorOriginal: 100,
          valorNegociado: 100,
          saldo: 100,
          moeda: "CRC",
          vencimento: new Date("2026-10-15T12:00:00.000Z"),
        },
      });
    } else if (tipo === "documento") {
      await prisma.documento.create({
        data: { matriculaId, categoria: "CONTRATO", nome: "Contrato preparado", url: "/api/files/contrato-preparado.pdf" },
      });
    } else {
      await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, ativa: true } });
    }
    expect((await efetivar(pedido.id, pedido.estadoHash)).ok).toBe(false);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count()).toBe(0);
  });

  it("recusa a aplicação SQL cuja reserva expirou após o pedido", async () => {
    const reserva = await reservarVaga();
    const pedido = await registrarPedido();
    await prisma.reservaVagaMatricula.update({
      where: { id: reserva.id },
      data: { expiraEm: new Date(reserva.expiraEm.getTime() + 60_000) },
    });

    await expect(prisma.efetivacaoPedidoDesistenciaPreparacao.create({
      data: {
        pedidoId: pedido.id,
        matriculaId,
        executorId: secretaria.id,
        motivo: motivoEfetivacao,
        entradaHash: "a".repeat(64),
        estadoHash: pedido.estadoHash,
      },
    })).rejects.toThrow(/reserva|prepara|estado/i);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "AGUARDANDO" });
    expect(await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "ATIVA" });
  });

  it("preserva documentos posteriores, mas rejeita no commit uma aplicação e avanço documental concorrentes", async () => {
    const pedido = await registrarPedido();
    expect((await efetivar(pedido.id, pedido.estadoHash)).ok).toBe(true);
    await expect(prisma.documento.create({
      data: { matriculaId, categoria: "PROPOSTA", nome: "Registro posterior preservado", url: "/api/files/registro-posterior.pdf" },
    })).resolves.toMatchObject({ matriculaId });

    const outroPedido = await registrarPedido(outraMatriculaId, "mesma-transacao");
    await expect(prisma.$transaction(async (tx) => {
      await tx.efetivacaoPedidoDesistenciaPreparacao.create({
        data: {
          pedidoId: outroPedido.id,
          matriculaId: outraMatriculaId,
          executorId: secretaria.id,
          motivo: motivoEfetivacao,
          entradaHash: "b".repeat(64),
          estadoHash: outroPedido.estadoHash,
        },
      });
      await tx.documento.create({
        data: { matriculaId: outraMatriculaId, categoria: "CONTRATO", nome: "Avanço concorrente", url: "/api/files/avanco-concorrente.pdf" },
      });
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    })).rejects.toThrow(/avanço|efetiva|prepara/i);
    expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { matriculaId: outraMatriculaId } })).toBe(0);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraMatriculaId } })).toMatchObject({ status: "AGUARDANDO" });
  });

  it("serializa a efetivação e impede reserva direta concorrente depois do cancelamento", async () => {
    const reservaFonte = await reservarVaga(outraMatriculaId, "reserva-fonte-concorrencia");
    const origem = await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reservaFonte.id } });
    const pedido = await registrarPedido();

    let iniciarTx1!: () => void;
    let liberarTx1!: () => void;
    const tx1Pronta = new Promise<void>((resolve) => { iniciarTx1 = resolve; });
    const liberarTx1Promessa = new Promise<void>((resolve) => { liberarTx1 = resolve; });
    let pidTx1: number | null = null;

    const tx1 = prisma.$transaction(async (tx) => {
      await tx.efetivacaoPedidoDesistenciaPreparacao.create({
        data: {
          pedidoId: pedido.id,
          matriculaId,
          executorId: secretaria.id,
          motivo: motivoEfetivacao,
          entradaHash: "c".repeat(64),
          estadoHash: pedido.estadoHash,
        },
      });
      const [sessao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;
      pidTx1 = sessao?.pid ?? null;
      iniciarTx1();
      await liberarTx1Promessa;
    }, { timeout: 10_000 });

    let tx2: Promise<unknown> | undefined;
    let liberada = false;
    const liberar = () => {
      if (!liberada) {
        liberada = true;
        liberarTx1();
      }
    };

    try {
      await tx1Pronta;
      expect(pidTx1).not.toBeNull();
      tx2 = prisma.reservaVagaMatricula.create({
        data: {
          matriculaId,
          turmaId: origem.turmaId,
          janelaId: origem.janelaId,
          preparadorId: origem.preparadorId,
          status: "ATIVA",
          expiraEm: origem.expiraEm,
          motivo: "Tentativa concorrente de reabrir reserva após desistência simples.",
          chaveIdempotencia: "reserva-direta-concorrente",
          entradaHash: origem.entradaHash,
        },
      }).then(resultado => resultado); // PrismaPromise só inicia ao ser consumida.

      await vi.waitFor(async () => {
        const [atividade] = await prisma.$queryRaw<{ aguardando: boolean }[]>`
          SELECT EXISTS (
            SELECT 1
            FROM pg_stat_activity atividade
            WHERE atividade.datname = current_database()
              AND atividade.state = 'active'
              AND atividade.wait_event_type = 'Lock'
              AND ${pidTx1!} = ANY(pg_blocking_pids(atividade.pid))
          ) AS aguardando`;
        expect(atividade?.aguardando).toBe(true);
      }, { interval: 10, timeout: 2_000 });

      liberar();
      await expect(tx1).resolves.toBeUndefined();
      await expect(tx2).rejects.toThrow(/reserva.*cancelada|desistência.*reserva/i);
      expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "CANCELADA" });
      expect(await prisma.reservaVagaMatricula.count({ where: { matriculaId } })).toBe(0);
    } finally {
      liberar();
      await Promise.allSettled([tx1, ...(tx2 ? [tx2] : [])]);
    }
  });

  it("não permite reabrir a matrícula cancelada por atualização SQL", async () => {
    const pedido = await registrarPedido();
    expect((await efetivar(pedido.id, pedido.estadoHash)).ok).toBe(true);
    await expect(prisma.matricula.update({
      where: { id: matriculaId },
      data: { status: "AGUARDANDO" },
    })).rejects.toThrow(/cancelada|efetiva|preserv/i);
  });

  it("exige executor ativo com alçada e preserva a aplicação contra escrita SQL forjada", async () => {
    const pedido = await registrarPedido();
    for (const usuario of [professor, vendedor, financeiro, secretariaInativa]) {
      entrar(usuario.id);
      expect((await efetivar(pedido.id, pedido.estadoHash)).ok).toBe(false);
    }
    entrar(administradora.id);
    expect((await efetivar(pedido.id, pedido.estadoHash)).ok).toBe(true);
    const aplicacao = await prisma.efetivacaoPedidoDesistenciaPreparacao.findFirstOrThrow();
    await expect(prisma.efetivacaoPedidoDesistenciaPreparacao.update({
      where: { id: aplicacao.id },
      data: { motivo: "Tentativa de reescrever a efetivação preservada." },
    })).rejects.toThrow();
    await expect(prisma.efetivacaoPedidoDesistenciaPreparacao.delete({ where: { id: aplicacao.id } })).rejects.toThrow();

    const outroPedido = await registrarPedido(outraMatriculaId, "forjadura");
    await expect(prisma.efetivacaoPedidoDesistenciaPreparacao.create({
      data: {
        pedidoId: outroPedido.id,
        matriculaId: outraMatriculaId,
        executorId: professor.id,
        motivo: motivoEfetivacao,
        entradaHash: "a".repeat(64),
        estadoHash: outroPedido.estadoHash,
      },
    })).rejects.toThrow();
  });
});
