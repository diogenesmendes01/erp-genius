import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { consultarSubstituicaoAgendaSegundaChamada, proporSubstituicaoAgendaSegundaChamada,
  decidirSubstituicaoAgendaSegundaChamada } from "./segunda-chamada-substituicao";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada,
  decidirAgendaInicialSegundaChamada, consultarAgendasIniciaisSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { consultarRemarcacoesAgendaSegundaChamada, proporRemarcacaoAgendaSegundaChamada, decidirRemarcacaoAgendaSegundaChamada } from "./segunda-chamada-remarcacao";

let professor: string, gestor: string, administrador: string, alocacaoId: string, matriculaId: string;
const entrar = (usuarioId: string) => authMock.mockResolvedValue({ user: { id: usuarioId } });
const proposta = (chaveIdempotencia = "segunda-chamada-proposta-1") => ({
  alocacaoId, codigoAvaliacao: "I1", motivo: "Ausência justificada na avaliação intermediária.",
  evidencias: "Atestado e comunicação institucional arquivados.", chaveIdempotencia,
});

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  professor = (await criarUsuario(["PROFESSOR"])).id;
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: { ...regraAvaliacaoTeste(), segundaChamada: { prazoRealizacaoMinutos: 14400, antecedenciaCancelamentoMinutos: 90 } },
    motivo: "Regra de teste da segunda chamada", chaveIdempotencia: "regra-segunda-chamada-teste",
  }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administrador, {
    regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Publicação independente da regra",
  }));
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor,
    dataInicio: new Date("2099-01-01T00:00:00Z"),
    vinculosDocentes: { create: { professorId: professor, inicio: new Date("2026-01-01T00:00:00Z") } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno segunda chamada", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z"),
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
  entrar(professor);
});

async function aprovarEDisponibilizar(chave: string) {
  entrar(professor); const criada = await proporSegundaChamada(proposta(chave));
  if (!criada.ok || !criada.dado) throw new Error("proposta ausente");
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${criada.dado.id}`;
  entrar(gestor); expect((await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Decisão independente de teste." })).ok).toBe(true);
  expect((await disponibilizarSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(), condicoes: "Condições oferecidas pela escola.", evidenciaComunicacao: "Comunicação registrada para o aluno." })).ok).toBe(true);
  return fonte;
}

async function prepararCalendario(naoLetivo = false, versao = 1) {
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: {} });
  const dia = new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 10);
  return prisma.versaoCalendarioEscolar.create({ data: {
    versao, preparadorId: gestor, fusoInstitucional: "UTC",
    periodos: naoLetivo ? [{ id: "feriado-teste", tipo: "FERIADO", nome: "Feriado institucional", inicio: dia, fim: dia }] : [],
    motivo: "Calendário aprovado para agenda inicial", chaveIdempotencia: `calendario-inicial-${versao}`, entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Conferência administrativa independente" } },
  } });
}

async function entradaAgenda(
  naoLetivo = false,
  inicioEm = new Date(Date.now() + 60 * 60_000),
  fimEm = new Date(inicioEm.getTime() + 30 * 60_000),
) {
  const fonte = await aprovarEDisponibilizar("fonte-agenda-inicial");
  await prepararCalendario(naoLetivo);
  const referencia = {
    propostaSegundaChamadaId: fonte.id,
    professorId: professor,
    inicio: inicioEm.toISOString(),
    fim: fimEm.toISOString(),
    fusoOrigem: "UTC",
  };
  const previa = await consultarPreviaAgendaInicialSegundaChamada(referencia);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  return {
    ...referencia,
    estadoConferido: previa.dado.estadoConferido,
    motivo: "Novo horário para avaliação pendente",
    evidencia: "Horário conferido com o aluno",
    ...(naoLetivo ? { motivoExcecaoNaoLetiva: "Aluno disponível somente nesta data excepcional" } : {}),
    chaveIdempotencia: "proposta-agenda-inicial",
  };
}

async function propostaAgenda(naoLetivo = false, inicioEm?: Date, fimEm?: Date) {
  const entrada = await entradaAgenda(naoLetivo, inicioEm, fimEm);
  const resultado = await proporAgendaInicialSegundaChamada(entrada);
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return { entrada, ...resultado.dado };
}

async function agendaAplicada(naoLetivo = false, inicioEm?: Date, fimEm?: Date) {
  const p = await propostaAgenda(naoLetivo, inicioEm, fimEm);
  entrar(administrador);
  const aplicada = await decidirAgendaInicialSegundaChamada({
    propostaId: p.id,
    propostaHash: p.entradaHash,
    aprovada: true,
    autorizarDiaNaoLetivo: naoLetivo,
    motivo: "Agenda inicial conferida para substituição",
  });
  if (!aplicada.ok || !aplicada.dado?.reservaId || !aplicada.dado.encontroId) {
    throw new Error(JSON.stringify(aplicada));
  }
  return { ...p, reservaId: aplicada.dado.reservaId, encontroId: aplicada.dado.encontroId };
}

async function prepararSubstituicao(
  reservaId: string,
  substitutoId: string,
  autorId = gestor,
  chave = "substituicao-docente-teste",
) {
  entrar(autorId);
  const consulta = await consultarSubstituicaoAgendaSegundaChamada({ reservaId, substitutoId });
  if (!consulta.ok || !consulta.dado?.previa) throw new Error(JSON.stringify(consulta));
  const entrada = {
    reservaId,
    substitutoId,
    estadoConferido: consulta.dado.previa.estadoConferido,
    motivo: "Substituição por indisponibilidade do responsável",
    evidencia: "Disponibilidade do novo professor conferida",
    chaveIdempotencia: chave,
  };
  const resultado = await proporSubstituicaoAgendaSegundaChamada(entrada);
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return { entrada, ...resultado.dado };
}

async function propostaRemarcacao(reservaId: string) {
  entrar(gestor);
  const consulta = await consultarRemarcacoesAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const inicio = new Date(Date.now() + 2 * 60 * 60_000);
  const entrada = {
    reservaId,
    estadoConferido: consulta.dado.estadoHash,
    inicio: inicio.toISOString(),
    fim: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
    fusoOrigem: "UTC",
    motivo: "Remarcação pendente antes da pausa concorrente",
    evidencia: "Disponibilidade conferida antes da decisão",
    chaveIdempotencia: "remarcacao-pausa-concorrente",
  };
  const criada = await proporRemarcacaoAgendaSegundaChamada(entrada);
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  const [persistida] = await prisma.$queryRaw<{ entradaHash: string }[]>`
    SELECT "entradaHash" AS "entradaHash"
    FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${criada.dado.id}
  `;
  if (!persistida) throw new Error("Proposta de remarcação ausente.");
  return { ...criada.dado, entradaHash: persistida.entradaHash };
}

type Tipo = "INICIAL" | "REMARCACAO" | "SUBSTITUICAO";
type Pendente = {
  tipo: Tipo;
  id: string;
  entradaHash: string;
  propostaSegundaChamadaId: string;
  reservaId?: string;
  encontroId?: string;
};

async function prepararPendente(tipo: Tipo): Promise<Pendente> {
  if (tipo === "INICIAL") {
    const pendente = await propostaAgenda();
    return {
      tipo,
      id: pendente.id,
      entradaHash: pendente.entradaHash,
      propostaSegundaChamadaId: pendente.entrada.propostaSegundaChamadaId,
    };
  }
  const agenda = await agendaAplicada();
  if (tipo === "REMARCACAO") {
    const pendente = await propostaRemarcacao(agenda.reservaId);
    return {
      tipo,
      id: pendente.id,
      entradaHash: pendente.entradaHash,
      propostaSegundaChamadaId: agenda.entrada.propostaSegundaChamadaId,
      reservaId: agenda.reservaId,
      encontroId: agenda.encontroId,
    };
  }
  const pendente = await prepararSubstituicao(agenda.reservaId, (await criarUsuario(["PROFESSOR"])).id);
  return {
    tipo,
    id: pendente.id,
    entradaHash: pendente.entradaHash,
    propostaSegundaChamadaId: agenda.entrada.propostaSegundaChamadaId,
    reservaId: agenda.reservaId,
    encontroId: agenda.encontroId,
  };
}

async function decidir(tipo: Tipo, propostaId: string, propostaHash: string, aprovada: boolean) {
  const motivo = aprovada
    ? "Aprovação independente da proposta de teste"
    : "Rejeição independente da proposta obsoleta";
  if (tipo === "INICIAL") {
    return decidirAgendaInicialSegundaChamada({ propostaId, propostaHash, aprovada, motivo });
  }
  if (tipo === "REMARCACAO") {
    return decidirRemarcacaoAgendaSegundaChamada({ propostaId, propostaHash, aprovada, motivo });
  }
  return decidirSubstituicaoAgendaSegundaChamada({ propostaId, propostaHash, aprovada, motivo });
}

async function moverAlocacaoParaOutraMatricula() {
  const antiga = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: {
    codigo: "MATRICULA-NOVA-NAO-EXIBIR",
    alunoId: antiga.alunoId,
    produtoId: antiga.produtoId,
    paisId: antiga.paisId,
    moeda: antiga.moeda,
    status: "ATIVA",
    ativadaEm: antiga.ativadaEm,
  } });
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { matriculaId: outra.id } });
}

async function consultarHistorico(pendente: Pendente) {
  if (pendente.tipo === "INICIAL") {
    return consultarAgendasIniciaisSegundaChamada({
      propostaSegundaChamadaId: pendente.propostaSegundaChamadaId,
    });
  }
  if (pendente.tipo === "REMARCACAO") {
    return consultarRemarcacoesAgendaSegundaChamada({ reservaId: pendente.reservaId! });
  }
  return consultarSubstituicaoAgendaSegundaChamada({ reservaId: pendente.reservaId! });
}

it.each(["INICIAL", "REMARCACAO", "SUBSTITUICAO"] as const)(
  "%s rejeita aprovação obsoleta, mas preserva rejeição e replay independentes",
  async (tipo) => {
    const pendente = await prepararPendente(tipo);
    const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
    const administradorInativo = (await criarUsuario(["ADMINISTRADOR"])).id;
    await prisma.usuario.update({ where: { id: administradorInativo }, data: { ativo: false } });

    const matriculaOriginal = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    await moverAlocacaoParaOutraMatricula();
    const matriculaAtual = await prisma.alocacaoTurma.findUniqueOrThrow({
      where: { id: alocacaoId },
      include: { matricula: true },
    });

    entrar(administrador);
    const historico = await consultarHistorico(pendente);
    expect(historico, JSON.stringify(historico)).toMatchObject({
      ok: true,
      dado: {
        identificacao: { matriculaCodigo: matriculaOriginal.codigo },
        podePropor: false,
        itens: [
          {
            id: pendente.id,
            podeDecidir: true,
            podeAprovar: false,
            impedimentoAprovacao: expect.any(String),
          },
        ],
      },
    });
    if (!historico.ok || !historico.dado) throw new Error(JSON.stringify(historico));
    expect(JSON.stringify(historico.dado)).not.toContain(matriculaAtual.matricula!.codigo);
    if (tipo === "REMARCACAO") {
      expect(historico.dado).toMatchObject({ conferencia: { contextoVigente: false } });
      expect(JSON.stringify(historico.dado.conferencia)).not.toContain(matriculaAtual.matricula!.codigo);
    }

    entrar(gestor);
    expect(await decidir(tipo, pendente.id, pendente.entradaHash, false)).toMatchObject({ ok: false });
    entrar(secretaria);
    expect(await decidir(tipo, pendente.id, pendente.entradaHash, false)).toMatchObject({ ok: false });
    entrar(administradorInativo);
    expect(await decidir(tipo, pendente.id, pendente.entradaHash, false)).toMatchObject({ ok: false });
    entrar(administrador);
    expect(await decidir(tipo, pendente.id, "0".repeat(64), false)).toMatchObject({ ok: false });
    expect(await decidir(tipo, pendente.id, pendente.entradaHash, true)).toMatchObject({ ok: false });
    const rejeicao = await decidir(tipo, pendente.id, pendente.entradaHash, false);
    expect(rejeicao, JSON.stringify(rejeicao)).toMatchObject({ ok: true });
    expect(await decidir(tipo, pendente.id, pendente.entradaHash, false)).toEqual(rejeicao);

    if (tipo === "INICIAL") {
      expect(await prisma.reservaSegundaChamada.count()).toBe(0);
      expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(0);
    } else {
      expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: pendente.encontroId! } }))
        .toMatchObject({ status: "PREVISTO", professorId: professor });
    }
    expect(await prisma.aplicacaoRemarcacaoAgendaSegundaChamada.count()).toBe(0);
    expect(await prisma.aplicacaoSubstituicaoAgendaSegundaChamada.count()).toBe(0);
    expect(await prisma.cobranca.count()).toBe(0);
  },
);
