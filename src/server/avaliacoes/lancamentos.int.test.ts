import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { prepararRegraAvaliacaoTx, decidirRegraAvaliacaoTx } from "./regras-tx";
import { salvarLancamentoAvaliacao, salvarLancamentoAvaliacaoLocal, oficializarLancamentoAvaliacao, consultarLancamentosAvaliacao, listarAvaliacoesAlocacao } from "./lancamentos";
import { salvarLancamentoTx, oficializarLancamentoTx } from "./lancamento-tx";
import { consultarConsolidadoAvaliacoes } from "./consolidado";
import { listarVinculosAvaliacoes } from "./painel";
import { proporCorrecaoNota, revisarCorrecaoNota, decidirCorrecaoNota } from "./correcao";
import { proporCorrecaoNotaTx } from "./correcao-tx";
import { decidirCorrecaoNotaTx } from "./correcao-decisao-tx";
import { consultarCorrecoesNota } from "./correcao-consulta";
import { listarRevisoesPorCorrecao } from "./revisoes-pendentes";
import { designarAvaliador, consultarDesignacoesAvaliacao } from "./designacao";
import { proporPlanoRecuperacao } from "./recuperacao-proposta";
import { decidirPlanoRecuperacao } from "./recuperacao-decisao";
import { reservarTentativaRecuperacao } from "./recuperacao-reserva";
import { reservarTentativaRecuperacaoTx } from "./recuperacao-reserva-tx";
import { cancelarReservaRecuperacaoPelaEscola } from "./recuperacao-cancelamento";
import { registrarDisponibilizacaoRecuperacao } from "./recuperacao-disponibilizacao";
import { proporProrrogacaoRecuperacao, decidirProrrogacaoRecuperacao } from "./recuperacao-prorrogacao";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { registrarRealizacaoRecuperacao } from "./recuperacao-realizacao";
import { autorizarRealizacaoEspecialRecuperacao } from "./recuperacao-autorizacao-especial";
import { consultarAutorizacoesEspeciaisRecuperacao } from "./recuperacao-autorizacao-consulta";
import { autorizarRecuperacaoEspecialLocal } from "./recuperacao-autorizacao-local";
import { salvarNotaRecuperacao, decidirNotaRecuperacao } from "./recuperacao-nota";
import { consultarNotaRecuperacao, listarRecuperacoesRealizadas } from "./recuperacao-consulta";
import { consultarPlanosRecuperacao } from "./recuperacao-planos-consulta";
import { consultarOperacaoRecuperacao } from "./recuperacao-operacao";
import { disponibilizarRecuperacaoLocal, realizarRecuperacaoLocal, proporProrrogacaoRecuperacaoLocal } from "./recuperacao-operacao-local";
import { consultarProrrogacoesRecuperacao } from "./recuperacao-prorrogacao-consulta";
import { designarProfessorRecuperacao } from "./recuperacao-designacao";
import { consultarDesignacaoRecuperacao } from "./recuperacao-designacao-consulta";
import { listarTentativasRecuperacaoDesignadas, consultarTentativaRecuperacaoDesignada } from "./recuperacao-fila-docente";
import { dataHoraAvaliacaoLocal } from "./tempo";
import { HABILIDADES } from "./calculo";
import { proporExtraRecuperacao, decidirExtraRecuperacao, consultarExtrasRecuperacao } from "./extra-recuperacao";
import { estadoExtraRecuperacaoTx, quantidadeExtraRecuperacaoTx } from "./extra-recuperacao-tx";
import { preverAgendaRecuperacao } from "./recuperacao-agenda";
import { proporAgendaRecuperacao, consultarPropostasAgendaRecuperacao } from "./recuperacao-agenda-proposta";
import { decidirAgendaRecuperacao } from "./recuperacao-agenda-decisao";
import { hashAgendaRecuperacao } from "./recuperacao-agenda-estado";
import { preverSubstituicaoAvaliadorRecuperacao } from "./recuperacao-substituicao-previa";
import { proporSubstituicaoRecuperacao, consultarPropostasSubstituicaoRecuperacao, decidirSubstituicaoRecuperacao } from "./recuperacao-substituicao-proposta";
import { proporCancelamentoAgendaRecuperacao, consultarCancelamentoAgendaRecuperacao, decidirCancelamentoAgendaRecuperacao } from "./recuperacao-agenda-cancelamento";
import { carregarImpactosAcademicosEncerramentoTx } from "@/server/matricula/encerramento-impactos-academicos";
import { prepararCalendarioEscolar } from "@/server/agenda/calendario";
import { decidirCalendarioEscolar } from "@/server/agenda/calendario-decisao";
import { consultarBaseCorrecaoRecuperacao, consultarCorrecoesRecuperacao, proporCorrecaoRecuperacao, revisarCorrecaoRecuperacao, decidirCorrecaoRecuperacao } from "./recuperacao-correcao";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "./fechamento";
import { consultarCasoRevisaoProgressao } from "./revisao-progressao-consulta";
import { decidirResolucaoRevisaoProgressao, proporResolucaoRevisaoProgressao, revisarResolucaoRevisaoProgressao } from "./resolucao-revisao-progressao";
import { materializarCasosHistoricosCorrecao } from "./casos-historicos";
import { cancelarMudancaAcademica } from "@/server/academico/acoes";

let professor: string, gestor: string, alunoId: string, matriculaId: string, alocacaoId: string, turmaId: string;
const data = "2026-01-10T10:00:00.000Z", inicio = new Date("2026-01-01T00:00:00Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const entrada = () => ({ alocacaoId, codigoAvaliacao: "I1", realizadaEm: data, notas: [{ habilidade: "FALA" as const, nota: "7" as string | null, comentarioAluno: "Boa evolução na fala." }], submetida: false, versaoEsperada: 0, chaveIdempotencia: "lancamento-teste-1" });

type CasoRevisaoProgressaoPersistido = {
  id: string;
  matriculaId: string;
  solicitacaoId: string;
  alocacaoFonteId: string;
  decisaoCorrecaoNotaId: string | null;
  decisaoCorrecaoRecuperacaoId: string | null;
  snapshotImpacto: unknown;
};

async function casosRevisaoProgressao(solicitacaoId: string) {
  return prisma.$queryRaw<CasoRevisaoProgressaoPersistido[]>`
    SELECT id, "matriculaId", "solicitacaoId", "alocacaoFonteId",
      "decisaoCorrecaoNotaId", "decisaoCorrecaoRecuperacaoId", "snapshotImpacto"
    FROM "CasoRevisaoProgressao"
    WHERE "solicitacaoId" = ${solicitacaoId}
    ORDER BY id ASC
  `;
}

async function esperarCasoDeRevisaoImutavel(caso: CasoRevisaoProgressaoPersistido) {
  await expect(prisma.$executeRaw`
    UPDATE "CasoRevisaoProgressao"
    SET "snapshotImpacto" = ${JSON.stringify({ adulterado: true })}::jsonb
    WHERE id = ${caso.id}
  `).rejects.toThrow();
  await expect(prisma.$executeRaw`
    DELETE FROM "CasoRevisaoProgressao" WHERE id = ${caso.id}
  `).rejects.toThrow();
}

async function publicarParaCancelamento(itemReservaId: string) {
  const de = new Date(Date.now()+120*60000), ate = new Date(de.getTime()+30*60000);
  entrar(gestor);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const cal = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, motivo: "Calendário para cancelamento aprovado", chaveIdempotencia: "calendario-teste-cancelamento", periodos: [] });
  if (!cal.ok || !cal.dado) throw new Error(JSON.stringify(cal));
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id; entrar(admin);
  expect((await decidirCalendarioEscolar({ calendarioId: cal.dado.id, aprovar: true, motivo: "Calendário aprovado pela administração" })).ok).toBe(true);
  entrar(gestor);
  const proposta = await proporAgendaRecuperacao({ itemReservaId, inicioLocal: de.toISOString().slice(0,-1), fimLocal: ate.toISOString().slice(0,-1), fuso: "UTC", versaoEsperada: 0, motivo: "Horário antes da ocorrência institucional", chaveIdempotencia: "agenda-para-cancelamento" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  entrar(admin);
  const r = await decidirAgendaRecuperacao({ propostaId: p.id, aprovar: true, estadoConferido: hashAgendaRecuperacao(p.snapshot), autorizarDiaNaoLetivo: false, motivo: "Aprovação independente da agenda" });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  entrar(gestor);
  return { admin, encontroId: r.dado.encontroId! };
}

it("substituições sucessivas preservam cadeia e reenvio antigo não restaura professor anterior", async () => {
  const { fala } = await prepararItensDesignacao();
  const { admin, encontroId } = await publicarParaCancelamento(fala.id);
  const original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const b = (await criarUsuario(["PROFESSOR"])).id, c = (await criarUsuario(["PROFESSOR"])).id;
  const preparar = async (substitutoId: string, chave: string) => {
    entrar(gestor);
    const previa = await preverSubstituicaoAvaliadorRecuperacao({ itemReservaId: fala.id, substitutoId });
    if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
    const p = await proporSubstituicaoRecuperacao({ itemReservaId: fala.id, substitutoId, estadoConferido: previa.dado.estadoConferido, versaoEsperada: previa.dado.versaoEsperada, motivo: "Substituição pedagógica conferida", chaveIdempotencia: chave });
    if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
    const fonte = await prisma.propostaSubstituicaoRecuperacao.findUniqueOrThrow({ where: { id: p.dado.id } });
    return { propostaId: fonte.id, aprovar: true, propostaHash: hashAgendaRecuperacao(fonte.snapshot), motivo: "Aprovação independente da substituição" };
  };
  const primeira = await preparar(b, "cadeia-substituicao-primeira");
  const baseCancelamento = await consultarCancelamentoAgendaRecuperacao({ reservaId: fala.reservaId });
  if (!baseCancelamento.ok || !baseCancelamento.dado) throw new Error(JSON.stringify(baseCancelamento));
  const cancelamentoAnterior = await proporCancelamentoAgendaRecuperacao({ reservaId: fala.reservaId, motivo: "Proposta concorrente de cancelamento", evidencia: "Pedido registrado antes da substituição", estadoConferido: baseCancelamento.dado.estadoConferido, chaveIdempotencia: "cancelamento-anterior-cadeia" });
  if (!cancelamentoAnterior.ok || !cancelamentoAnterior.dado) throw new Error(JSON.stringify(cancelamentoAnterior));
  expect((await decidirSubstituicaoRecuperacao(primeira)).ok).toBe(false);
  entrar(admin);
  const aprovada = await decidirSubstituicaoRecuperacao(primeira);
  expect(aprovada.ok, JSON.stringify(aprovada)).toBe(true);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).professorId).toBe(b);
  expect((await decidirCancelamentoAgendaRecuperacao({ propostaId: cancelamentoAnterior.dado.id, aprovar: true, motivo: "Conferência de cancelamento anterior", estadoConferido: baseCancelamento.dado.estadoConferido })).ok).toBe(false);
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ aplicada: true, estadoMudou: false, impedimentoAtual: null, podeDecidir: false, podeAprovar: false }] } });
  entrar(b);
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(true);
  const segunda = await preparar(c, "cadeia-substituicao-segunda");
  entrar(admin);
  const resultado = await decidirSubstituicaoRecuperacao(segunda);
  expect(resultado.ok, JSON.stringify(resultado)).toBe(true);
  expect(await decidirSubstituicaoRecuperacao(primeira)).toEqual(aprovada);
  const atual = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  expect(atual).toMatchObject({ professorId: c, inicio: original.inicio, fim: original.fim, matriculaId, finalidade: "RECUPERACAO", propostaAgendaRecuperacaoId: original.propostaAgendaRecuperacaoId });
  expect(await prisma.designacaoRecuperacao.count({ where: { itemReservaId: fala.id } })).toBe(2);
  entrar(b);
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  entrar(c);
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(true);
  const terceira = await preparar(professor, "cadeia-substituicao-retorno-titular");
  entrar(admin);
  expect((await decidirSubstituicaoRecuperacao(terceira)).ok).toBe(true);
  await expect(prisma.encontroAgenda.update({ where: { id: encontroId }, data: { professorId: b } })).rejects.toThrow();
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).professorId).toBe(professor);
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(0);
});

it("correção de nota invalida aprovação direta da substituição no banco", async () => {
  const { fala } = await prepararItensDesignacao();
  const { admin, encontroId } = await publicarParaCancelamento(fala.id);
  const substitutoId = (await criarUsuario(["PROFESSOR"])).id;
  const previa = await preverSubstituicaoAvaliadorRecuperacao({ itemReservaId: fala.id, substitutoId });
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const proposta = await proporSubstituicaoRecuperacao({ itemReservaId: fala.id, substitutoId, versaoEsperada: 0, estadoConferido: previa.dado.estadoConferido, motivo: "Substituição antes da correção acadêmica", chaveIdempotencia: "substituicao-fontes-academicas" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(professor);
  const nota = await prisma.versaoLancamentoAvaliacao.findFirstOrThrow({ where: { registro: { alocacaoId, codigoAvaliacao: "I1" } } });
  const correcao = await proporCorrecaoNota({ lancamentoId: nota.id, origemHash: nota.conteudoHash, versaoEsperada: 0, chaveIdempotencia: "correcao-fontes-substituicao", motivo: "Corrigir resultado que originou o plano", notas: [{ habilidade: "FALA", nota: "4", comentarioAluno: "Resultado corrigido" }] });
  if (!correcao.ok || !correcao.dado) throw new Error(JSON.stringify(correcao));
  entrar(gestor);
  const revisao = await revisarCorrecaoNota(correcao.dado.id);
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  expect((await decidirCorrecaoNota({ propostaId: correcao.dado.id, propostaHash: revisao.dado.propostaHash, impactosHash: revisao.dado.impactosHash, aprovada: true, motivo: "Correção aprovada por outra pessoa" })).ok).toBe(true);
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoSubstituicaoRecuperacao" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-fontes-alteradas',${proposta.dado.id},${admin},true,'Conferência direta depois da correção')`).rejects.toThrow("fontes");
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).professorId).toBe(professor);
  expect(await prisma.designacaoRecuperacao.count()).toBe(0);
});

it("proposta de substituição preserva origem, versões e acesso sem aplicar a troca", async () => {
  const { fala } = await prepararItensDesignacao();
  const { admin, encontroId } = await publicarParaCancelamento(fala.id);
  const original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const substitutoId = (await criarUsuario(["PROFESSOR"])).id;
  const ref = { itemReservaId: fala.id, substitutoId };
  const previa = await preverSubstituicaoAvaliadorRecuperacao(ref);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const d = { ...ref, estadoConferido: previa.dado.estadoConferido, versaoEsperada: previa.dado.versaoEsperada, motivo: "Substituição solicitada pela gestão", chaveIdempotencia: "proposta-substituicao-teste" };
  const r = await proporSubstituicaoRecuperacao(d);
  expect(r).toMatchObject({ ok: true, dado: { versao: 1 } });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await proporSubstituicaoRecuperacao(d)).toEqual(r);
  expect((await proporSubstituicaoRecuperacao({ ...d, motivo: "Outro motivo para a mesma chave" })).ok).toBe(false);
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ versao: 1, revisaoIndependente: false, estadoMudou: false, aplicada: false }] } });
  entrar(admin);
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ revisaoIndependente: true }] } });
  await expect(prisma.propostaSubstituicaoRecuperacao.update({ where: { id: r.dado.id }, data: { motivo: "Reescrever história" } })).rejects.toThrow("imutável");
  await expect(prisma.propostaSubstituicaoRecuperacao.delete({ where: { id: r.dado.id } })).rejects.toThrow("imutável");
  entrar(gestor);
  expect((await proporSubstituicaoRecuperacao({ ...d, chaveIdempotencia: "outra-chave-versao-antiga" })).ok).toBe(false);
  expect(await proporSubstituicaoRecuperacao({ ...d, versaoEsperada: 1, chaveIdempotencia: "segunda-proposta-substituicao" })).toMatchObject({ ok: true, dado: { versao: 2 } });
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id, antesVersao: 2 })).toMatchObject({ ok: true, dado: { versaoEsperada: 2, propostas: [{ versao: 1, versaoAtual: false }] } });
  entrar(substitutoId);
  expect((await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).ok).toBe(false);
  expect((await proporSubstituicaoRecuperacao(d)).ok).toBe(false);
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).toEqual(original);
  expect(await prisma.designacaoRecuperacao.count()).toBe(0);
});

it("proposta de substituição recusa conferência anterior a uma ausência e conserva histórico após inativação", async () => {
  const { fala } = await prepararItensDesignacao();
  const { encontroId } = await publicarParaCancelamento(fala.id);
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const substitutoId = (await criarUsuario(["PROFESSOR"])).id;
  const ref = { itemReservaId: fala.id, substitutoId };
  const previa = await preverSubstituicaoAvaliadorRecuperacao(ref);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const d = { ...ref, estadoConferido: previa.dado.estadoConferido, versaoEsperada: 0, motivo: "Proposta conferida antes da ausência", chaveIdempotencia: "proposta-substituicao-ausencia" };
  const ausencia = await prisma.indisponibilidadeDocente.create({ data: { professorId: substitutoId, preparadorId: substitutoId, inicio: e.inicio, fim: e.fim, fusoOrigem: "UTC", motivo: "Ausência posterior à conferência", chaveIdempotencia: "ausencia-proposta-substituicao", entradaHash: "fixture" } });
  await prisma.decisaoIndisponibilidadeDocente.create({ data: { indisponibilidadeId: ausencia.id, decisorId: gestor, aprovada: true, motivo: "Ausência aprovada pela gestão", encontrosAfetados: [] } });
  expect((await proporSubstituicaoRecuperacao(d)).ok).toBe(false);
  expect(await prisma.propostaSubstituicaoRecuperacao.count()).toBe(0);
  const atual = await preverSubstituicaoAvaliadorRecuperacao(ref);
  if (!atual.ok || !atual.dado) throw new Error(JSON.stringify(atual));
  const entradaAtual = { ...d, estadoConferido: atual.dado.estadoConferido };
  const r = await proporSubstituicaoRecuperacao(entradaAtual);
  expect(r.ok).toBe(true);
  const revisor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  entrar(revisor);
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ estadoMudou: false, podeDecidir: true, podeAprovar: false }] } });
  entrar(gestor);
  await prisma.usuario.update({ where: { id: substitutoId }, data: { ativo: false } });
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ estadoMudou: true, impedimentoAtual: expect.any(String), conferenciaOriginal: { pendencias: [expect.stringContaining("indisponibilidade")] } }] } });
  expect(await proporSubstituicaoRecuperacao(entradaAtual)).toEqual(r);
  expect((await proporSubstituicaoRecuperacao({ ...entradaAtual, versaoEsperada: 1, chaveIdempotencia: "proposta-professor-inativo" })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  expect((await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).ok).toBe(false);
});

it("cancelamento da agenda preserva proposta de substituição sem permitir nova troca", async () => {
  const { fala } = await prepararItensDesignacao();
  const { admin, encontroId } = await publicarParaCancelamento(fala.id);
  const substitutoId = (await criarUsuario(["PROFESSOR"])).id;
  const previa = await preverSubstituicaoAvaliadorRecuperacao({ itemReservaId: fala.id, substitutoId });
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const d = { itemReservaId: fala.id, substitutoId, estadoConferido: previa.dado.estadoConferido, versaoEsperada: 0, motivo: "Substituição preparada antes do cancelamento", chaveIdempotencia: "substituicao-antes-cancelamento" };
  const proposta = await proporSubstituicaoRecuperacao(d);
  expect(proposta.ok).toBe(true);
  const consulta = await consultarCancelamentoAgendaRecuperacao({ reservaId: fala.reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const cancelamento = await proporCancelamentoAgendaRecuperacao({ reservaId: fala.reservaId, motivo: "Escola cancelou a tentativa pendente", evidencia: "Interrupção institucional registrada", estadoConferido: consulta.dado.estadoConferido, chaveIdempotencia: "cancelamento-apos-substituicao" });
  if (!cancelamento.ok || !cancelamento.dado) throw new Error(JSON.stringify(cancelamento));
  entrar(admin);
  expect((await decidirCancelamentoAgendaRecuperacao({ propostaId: cancelamento.dado.id, aprovar: true, motivo: "Cancelamento conferido independentemente", estadoConferido: consulta.dado.estadoConferido })).ok).toBe(true);
  expect(await consultarPropostasSubstituicaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ estadoMudou: true, impedimentoAtual: expect.any(String), aplicada: false }] } });
  entrar(gestor);
  expect(await proporSubstituicaoRecuperacao(d)).toEqual(proposta);
  expect((await proporSubstituicaoRecuperacao({ ...d, versaoEsperada: 1, chaveIdempotencia: "nova-troca-apos-cancelamento" })).ok).toBe(false);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("CANCELADO");
  expect(await prisma.designacaoRecuperacao.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("prévia de substituição exclui apenas o próprio encontro, preserva agenda e recusa alterações diretas", async () => {
  const { fala, escrita } = await prepararItensDesignacao();
  const { encontroId } = await publicarParaCancelamento(fala.id);
  const original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const substitutoId = (await criarUsuario(["PROFESSOR"], "Substituto para conferência")).id;
  const d = { itemReservaId: fala.id, substitutoId };
  expect(await preverSubstituicaoAvaliadorRecuperacao(d)).toMatchObject({ ok: true, dado: { encontroId, inicio: original.inicio.toISOString(), fim: original.fim.toISOString(), pendencias: [], conflitos: [], aplicada: false } });
  expect(await consultarDesignacaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { podeAlterar: false, podeConferirSubstituicao: true, agendaPublicada: true, avaliadorAgendaId: professor } });
  expect((await preverSubstituicaoAvaliadorRecuperacao({ ...d, substitutoId: professor })).ok).toBe(false);
  expect((await preverSubstituicaoAvaliadorRecuperacao({ ...d, itemReservaId: escrita.id })).ok).toBe(false);
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId, produtoId: base.produtoId, paisId: base.paisId, moeda: base.moeda, status: "ATIVA" } });
  const conflito = await prisma.encontroAgenda.create({ data: { matriculaId: outra.id, professorId: professor, preparadorId: gestor, inicio: original.inicio, fim: original.fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro compromisso do mesmo aluno", chaveIdempotencia: "conflito-previa-substituicao", entradaHash: "fixture" } });
  expect(await preverSubstituicaoAvaliadorRecuperacao(d)).toMatchObject({ ok: true, dado: { conflitos: [{ envolveSubstituto: false }], pendencias: [expect.stringContaining("conflitante")] } });
  await prisma.encontroAgenda.update({ where: { id: conflito.id }, data: { inicio: new Date(original.inicio.getTime()-30*60000), fim: original.inicio } });
  expect(await preverSubstituicaoAvaliadorRecuperacao(d)).toMatchObject({ ok: true, dado: { conflitos: [], pendencias: [] } });
  entrar(substitutoId);
  expect((await preverSubstituicaoAvaliadorRecuperacao(d)).ok).toBe(false);
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).toEqual(original);
  expect(await prisma.designacaoRecuperacao.count()).toBe(0);
});

it("prévia de substituição confere ausência aprovada, reserva comercial e professor ativo", async () => {
  const { fala } = await prepararItensDesignacao();
  const { encontroId } = await publicarParaCancelamento(fala.id);
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const substitutoId = (await criarUsuario(["PROFESSOR"])).id, d = { itemReservaId: fala.id, substitutoId };
  const ausencia = await prisma.indisponibilidadeDocente.create({ data: { professorId: substitutoId, preparadorId: substitutoId, inicio: e.inicio, fim: e.fim, fusoOrigem: "UTC", motivo: "Ausência a conferir", chaveIdempotencia: "ausencia-substituto-previa", entradaHash: "fixture" } });
  expect(await preverSubstituicaoAvaliadorRecuperacao(d)).toMatchObject({ ok: true, dado: { indisponibilidades: 0 } });
  await prisma.decisaoIndisponibilidadeDocente.create({ data: { indisponibilidadeId: ausencia.id, decisorId: gestor, aprovada: true, motivo: "Ausência aprovada pela gestão", encontrosAfetados: [] } });
  expect(await preverSubstituicaoAvaliadorRecuperacao(d)).toMatchObject({ ok: true, dado: { indisponibilidades: 1, pendencias: [expect.stringContaining("indisponibilidade")] } });
  const outroProfessor = (await criarUsuario(["PROFESSOR"])).id;
  const r = await prisma.reservaAgendaParticular.create({ data: { matriculaId, preparadorId: gestor, expiraEm: e.fim, motivo: "Compromisso comercial do aluno", chaveIdempotencia: "reserva-substituicao-previa", entradaHash: "fixture", snapshot: { professorId: outroProfessor, fusoOrigem: "UTC", encontros: [{ inicio: e.inicio.toISOString(), fim: e.fim.toISOString() }] } } });
  await prisma.horarioReservaParticular.create({ data: { reservaId: r.id, professorId: outroProfessor, inicio: e.inicio, fim: e.fim, fusoOrigem: "UTC" } });
  expect(await preverSubstituicaoAvaliadorRecuperacao(d)).toMatchObject({ ok: true, dado: { reservas: 1, indisponibilidades: 1, aplicada: false } });
  await prisma.usuario.update({ where: { id: substitutoId }, data: { ativo: false } });
  expect((await preverSubstituicaoAvaliadorRecuperacao(d)).ok).toBe(false);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).professorId).toBe(professor);
  expect(await prisma.designacaoRecuperacao.count()).toBe(0);
});

it("professor consulta somente a agenda atribuída; cancelamento retira a pendência e preserva o histórico da gestão", async () => {
  const { fala, escrita, p: plano } = await prepararItensDesignacao();
  const substituto = (await criarUsuario(["PROFESSOR"], "Avaliador específico")).id;
  expect((await designarProfessorRecuperacao({ itemReservaId: fala.id, professorId: substituto, versaoEsperada: 0, motivo: "Responsável pela recuperação de fala", chaveIdempotencia: "avaliador-agenda-consulta" })).ok).toBe(true);
  const { admin, encontroId } = await publicarParaCancelamento(fala.id);
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  entrar(substituto);
  const consulta = await consultarTentativaRecuperacaoDesignada(fala.id);
  expect(consulta).toMatchObject({ ok: true, dado: { podeRegistrarRealizacao: false, agenda: { id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: "UTC", avaliador: "Avaliador específico", status: "PREVISTO", mesmoAvaliador: true, excecaoDiaNaoLetivo: false } } });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  expect(Object.keys(consulta.dado.agenda!).sort()).toEqual(["id", "inicio", "fim", "fusoOrigem", "avaliador", "status", "mesmoAvaliador", "excecaoDiaNaoLetivo"].sort());
  expect(await listarTentativasRecuperacaoDesignadas()).toMatchObject({ ok: true, dado: { itens: [{ id: fala.id, agenda: { id: e.id } }] } });
  expect((await consultarTentativaRecuperacaoDesignada(escrita.id)).ok).toBe(false);
  expect((await consultarOperacaoRecuperacao({ propostaId: plano.id })).ok).toBe(false);
  entrar(professor);
  const titular = await consultarOperacaoRecuperacao({ propostaId: plano.id }); if (!titular.ok || !titular.dado) throw new Error(JSON.stringify(titular));
  expect(titular.dado.reservas.flatMap(r => r.itens).find(i => i.id === fala.id)).toMatchObject({ podeRegistrarRealizacao: false, agenda: { id: e.id, mesmoAvaliador: false } });
  entrar(gestor);
  const base = await consultarCancelamentoAgendaRecuperacao({ reservaId: fala.reservaId }); if (!base.ok || !base.dado) throw new Error(JSON.stringify(base));
  const proposta = await proporCancelamentoAgendaRecuperacao({ reservaId: fala.reservaId, motivo: "Escola cancela atividade agendada", evidencia: "Comunicado da gestão pedagógica", estadoConferido: base.dado.estadoConferido, chaveIdempotencia: "cancelar-agenda-consulta-docente" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(admin);
  expect((await decidirCancelamentoAgendaRecuperacao({ propostaId: proposta.dado.id, aprovar: true, estadoConferido: base.dado.estadoConferido, motivo: "Cancelamento conferido pela administração" })).ok).toBe(true);
  const historico = await consultarOperacaoRecuperacao({ propostaId: plano.id }); if (!historico.ok || !historico.dado) throw new Error(JSON.stringify(historico));
  expect(historico.dado.reservas.flatMap(r => r.itens).find(i => i.id === fala.id)).toMatchObject({ podeRegistrarRealizacao: false, agenda: { id: e.id, status: "CANCELADO" } });
  entrar(substituto);
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  expect(await listarTentativasRecuperacaoDesignadas()).toMatchObject({ ok: true, dado: { itens: [] } });
});

it("cancelamento independente libera apenas habilidades pendentes e preserva a realizada", async () => {
  const { fala, escrita, p: plano } = await prepararItensDesignacao();
  entrar(professor);
  const realizada = await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Fala já realizada antes do cancelamento" });
  expect(realizada.ok, JSON.stringify(realizada)).toBe(true);
  const { admin, encontroId } = await publicarParaCancelamento(escrita.id);
  const consulta = await consultarCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const d = { reservaId: escrita.reservaId, motivo: "Escola indisponível para a atividade restante", evidencia: "Comunicado institucional da indisponibilidade", estadoConferido: consulta.dado.estadoConferido, chaveIdempotencia: "cancelamento-agenda-aprovado" };
  const r = await proporCancelamentoAgendaRecuperacao(d); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await proporCancelamentoAgendaRecuperacao(d)).toEqual(r);
  expect((await proporCancelamentoAgendaRecuperacao({ ...d, motivo: "Outra causa com chave repetida" })).ok).toBe(false);
  const decisao = { propostaId: r.dado.id, aprovar: true, motivo: "Conferência independente das habilidades pendentes", estadoConferido: d.estadoConferido };
  expect((await decidirCancelamentoAgendaRecuperacao(decisao)).ok).toBe(false);
  entrar(professor);
  expect((await proporCancelamentoAgendaRecuperacao({ ...d, chaveIdempotencia: "professor-sem-permissao-cancelar" })).ok).toBe(false);
  expect((await decidirCancelamentoAgendaRecuperacao(decisao)).ok).toBe(false);
  entrar(gestor);
  await expect(prisma.decisaoCancelamentoAgendaRecuperacao.create({ data: { propostaId: r.dado.id, decisorId: gestor, aprovada: true, motivo: decisao.motivo } })).rejects.toThrow("outra pessoa");
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("PREVISTO");
  expect(await prisma.cancelamentoReservaRecuperacao.count()).toBe(0);
  entrar(admin);
  const antes = await consultarOperacaoRecuperacao({ propostaId: plano.id }); if (!antes.ok || !antes.dado) throw new Error(JSON.stringify(antes));
  expect(antes.dado.reservas.find(x => x.id === escrita.reservaId)?.podeCancelarPelaEscola).toBe(false);
  const resultado = await decidirCancelamentoAgendaRecuperacao(decisao); expect(resultado.ok, JSON.stringify(resultado)).toBe(true);
  expect(await decidirCancelamentoAgendaRecuperacao(decisao)).toEqual(resultado);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("CANCELADO");
  expect(await prisma.cancelamentoReservaRecuperacao.count()).toBe(1);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(1);
  const depois = await consultarOperacaoRecuperacao({ propostaId: plano.id }); if (!depois.ok || !depois.dado) throw new Error(JSON.stringify(depois));
  expect(depois.dado.saldo.find(h => h.habilidade === "FALA")).toEqual(antes.dado.saldo.find(h => h.habilidade === "FALA"));
  const base = antes.dado.saldo.find(h => h.habilidade === "ESCRITA")!;
  expect(depois.dado.saldo.find(h => h.habilidade === "ESCRITA")).toEqual({ ...base, reservadas: base.reservadas-1, disponiveis: base.disponiveis+1 });
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.recebimento.count()).toBe(0);
  await expect(prisma.propostaCancelamentoAgendaRecuperacao.update({ where: { id: r.dado.id }, data: { motivo: "Editar origem não permitido" } })).rejects.toThrow("imutáveis");
  await expect(prisma.decisaoCancelamentoAgendaRecuperacao.delete({ where: { propostaId: r.dado.id } })).rejects.toThrow("imutáveis");
  await prisma.usuario.update({ where: { id: admin }, data: { ativo: false } });
  expect((await decidirCancelamentoAgendaRecuperacao(decisao)).ok).toBe(false);
  entrar(professor);
  expect((await consultarCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId })).ok).toBe(false);
});

it("cancelamentos concorrentes aplicam uma única liberação da reserva agendada", async () => {
  const { escrita } = await prepararItensDesignacao();
  const { admin, encontroId } = await publicarParaCancelamento(escrita.id);
  const consulta = await consultarCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId }); if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const ids: string[] = [];
  for (const chave of ["cancelamento-concorrente-um", "cancelamento-concorrente-dois"]) {
    const p = await proporCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId, motivo: "Escola precisa cancelar esta reserva", evidencia: "Evidência institucional conferida", estadoConferido: consulta.dado.estadoConferido, chaveIdempotencia: chave });
    if (!p.ok || !p.dado) throw new Error(JSON.stringify(p)); ids.push(p.dado.id);
  }
  const resultados = await Promise.allSettled(ids.map(propostaId => prisma.decisaoCancelamentoAgendaRecuperacao.create({ data: { propostaId, decisorId: admin, aprovada: true, motivo: "Conferência independente do cancelamento" } })));
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.decisaoCancelamentoAgendaRecuperacao.count()).toBe(1);
  expect(await prisma.cancelamentoReservaRecuperacao.count()).toBe(1);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("CANCELADO");
  expect(await prisma.realizacaoRecuperacao.count()).toBe(0);
  await expect(prisma.encontroAgenda.update({ where: { id: encontroId }, data: { status: "PREVISTO" } })).rejects.toThrow("imutável");
});

it("nova realização invalida cancelamento proposto, permitindo rejeição sem efeito", async () => {
  const { fala, escrita } = await prepararItensDesignacao();
  const { admin, encontroId } = await publicarParaCancelamento(escrita.id);
  const consulta = await consultarCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId }); if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const proposta = await proporCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId, motivo: "Cancelar pendências da reserva acadêmica", evidencia: "Escola registrou interrupção do atendimento", estadoConferido: consulta.dado.estadoConferido, chaveIdempotencia: "cancelamento-estado-antigo" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(professor);
  expect((await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Fala realizada enquanto cancelamento era revisado" })).ok).toBe(true);
  entrar(admin);
  const d = { propostaId: proposta.dado.id, aprovar: true, motivo: "Conferir o cancelamento da escola", estadoConferido: consulta.dado.estadoConferido };
  expect((await decidirCancelamentoAgendaRecuperacao(d)).ok).toBe(false);
  await expect(prisma.decisaoCancelamentoAgendaRecuperacao.create({ data: { propostaId: proposta.dado.id, decisorId: admin, aprovada: true, motivo: d.motivo } })).rejects.toThrow("mudaram");
  expect((await decidirCancelamentoAgendaRecuperacao({ ...d, aprovar: false })).ok).toBe(true);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("PREVISTO");
  expect(await prisma.cancelamentoReservaRecuperacao.count()).toBe(0);
  expect(await consultarCancelamentoAgendaRecuperacao({ reservaId: escrita.reservaId })).toMatchObject({ ok: true, dado: { propostas: [{ decisao: { aprovada: false } }] } });
});

it.each([false, true])("aprova agenda de recuperação atomicamente, com exceção de feriado: %s", async feriado => {
  const { fala } = await prepararItensDesignacao();
  const de = new Date(Date.now() + 4000);
  const ate = new Date(de.getTime() + 30 * 60000);
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const cal = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, motivo: "Calendário para publicação da avaliação", chaveIdempotencia: "calendario-publicacao-recuperacao", periodos: feriado ? [{ id: "feriado", nome: "Feriado", tipo: "FERIADO", inicio: de.toISOString().slice(0,10), fim: de.toISOString().slice(0,10) }] : [] });
  if (!cal.ok || !cal.dado) throw new Error(JSON.stringify(cal));
  entrar(admin); expect((await decidirCalendarioEscolar({ calendarioId: cal.dado.id, aprovar: true, motivo: "Calendário conferido independentemente" })).ok).toBe(true);
  entrar(gestor);
  const proposta = await proporAgendaRecuperacao({ itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0,-1), fimLocal: ate.toISOString().slice(0,-1), fuso: "UTC", versaoEsperada: 0, motivo: "Horário conferido da tentativa", chaveIdempotencia: "agenda-para-aprovacao" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const d = { propostaId: p.id, aprovar: true, estadoConferido: hashAgendaRecuperacao(p.snapshot), autorizarDiaNaoLetivo: feriado, motivo: "Aprovação independente e exceção quando aplicável" };
  expect((await decidirAgendaRecuperacao(d)).ok).toBe(false);
  await expect(prisma.decisaoAgendaRecuperacao.create({ data: { propostaId: p.id, decisorId: gestor, aprovada: true, autorizarDiaNaoLetivo: feriado, motivo: d.motivo } })).rejects.toThrow("outra pessoa");
  entrar(admin);
  expect((await decidirAgendaRecuperacao({ ...d, estadoConferido: "0".repeat(64) })).ok).toBe(false);
  expect((await decidirAgendaRecuperacao({ ...d, autorizarDiaNaoLetivo: !feriado })).ok).toBe(false);
  const conflito = await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor, inicio: de, fim: ate, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Conflito surgido depois da revisão", chaveIdempotencia: "conflito-antes-aprovar", entradaHash: "fixture" } });
  expect((await decidirAgendaRecuperacao(d)).ok).toBe(false);
  await expect(prisma.decisaoAgendaRecuperacao.create({ data: { propostaId: p.id, decisorId: admin, aprovada: true, autorizarDiaNaoLetivo: feriado, motivo: d.motivo } })).rejects.toThrow("conflito");
  expect(await prisma.decisaoAgendaRecuperacao.count()).toBe(0);
  await prisma.encontroAgenda.delete({ where: { id: conflito.id } });
  if (feriado) {
    const concorrentes = await Promise.allSettled([0,1].map(() => prisma.decisaoAgendaRecuperacao.create({ data: { propostaId: p.id, decisorId: admin, aprovada: true, autorizarDiaNaoLetivo: true, motivo: d.motivo } })));
    expect(concorrentes.filter(x => x.status === "fulfilled")).toHaveLength(1);
  }
  const r = await decidirAgendaRecuperacao(d); expect(r.ok, JSON.stringify(r)).toBe(true);
  expect(await decidirAgendaRecuperacao(d)).toEqual(r);
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { propostaAgendaRecuperacaoId: p.id } });
  expect(e).toMatchObject({ finalidade: "RECUPERACAO", status: "PREVISTO", matriculaId, turmaId: null, professorId: professor, inicio: de, fim: ate });
  expect(await prisma.decisaoAgendaRecuperacao.count()).toBe(1);
  expect(await prisma.encontroAgenda.count()).toBe(1);
  expect(await prisma.ocorrenciaParticular.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
  const impactos = await prisma.$transaction(tx => carregarImpactosAcademicosEncerramentoTx(tx, alunoId, matriculaId));
  expect(impactos.encontrosParticulares).toEqual([]);
  expect(impactos.encontrosRecuperacao).toEqual([expect.objectContaining({ id: e.id, status: "PREVISTO" })]);
  expect(await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ publicacaoAutorizada: true, estadoMudou: false, decisao: { aprovada: true, autorizarDiaNaoLetivo: feriado }, encontro: { id: e.id } }] } });
  await expect(prisma.decisaoAgendaRecuperacao.update({ where: { propostaId: p.id }, data: { motivo: "Alteração indevida de decisão" } })).rejects.toThrow("imutável");
  await expect(prisma.encontroAgenda.delete({ where: { id: e.id } })).rejects.toThrow("não pode ser apagada");
  await expect(prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "RASCUNHO", propostaAgendaRecuperacaoId: null } })).rejects.toThrow("imutável");
  await expect(prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } })).rejects.toThrow("imutável");
  expect((await designarProfessorRecuperacao({ itemReservaId: fala.id, professorId: (await criarUsuario(["PROFESSOR"])).id, versaoEsperada: 0, motivo: "Não alterar silenciosamente encontro publicado", chaveIdempotencia: "troca-apos-agenda" })).ok).toBe(false);
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: fala.reservaId, motivo: "Cancelamento sem decisão da agenda", evidencia: "Pedido de teste não aprovado" })).ok).toBe(false);
  entrar(professor);
  expect((await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: new Date(de.getTime()-1).toISOString(), evidencia: "Realização fora do horário aprovado" })).ok).toBe(false);
  await aguardarInstanteRegistrado(de);
  const realizada = await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Recuperação aplicada conforme agenda" });
  expect(realizada.ok, JSON.stringify(realizada)).toBe(true);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("MINISTRADO");
  const painel = await listarTentativasRecuperacaoDesignadas({ modo: "historico" });
  expect(painel).toMatchObject({ ok: true, dado: { itens: [{ id: fala.id, agenda: { id: e.id, status: "MINISTRADO" } }] } });
  expect(await prisma.aulaDiario.count()).toBe(0);
  expect(await prisma.consumoHorasCompradas.count()).toBe(0);
});

it("rejeita proposta obsoleta sem publicar horário nem modificar seu histórico", async () => {
  const { fala } = await prepararItensDesignacao();
  const de = new Date(Date.now() + 120 * 60000), ate = new Date(de.getTime() + 30 * 60000);
  const proposta = await proporAgendaRecuperacao({ itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0,16), fimLocal: ate.toISOString().slice(0,16), fuso: "UTC", versaoEsperada: 0, motivo: "Proposta sem calendário publicado", chaveIdempotencia: "agenda-para-rejeicao" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  entrar((await criarUsuario(["GERENTE_PEDAGOGICO"])).id);
  const d = { propostaId: p.id, aprovar: false, estadoConferido: hashAgendaRecuperacao(p.snapshot), autorizarDiaNaoLetivo: false, motivo: "Rejeitada por falta de condições para publicação" };
  expect((await decidirAgendaRecuperacao({ ...d, aprovar: true })).ok).toBe(false);
  const r = await decidirAgendaRecuperacao(d); expect(r.ok, JSON.stringify(r)).toBe(true);
  expect(await decidirAgendaRecuperacao(d)).toEqual(r);
  expect((await decidirAgendaRecuperacao({ ...d, aprovar: true })).ok).toBe(false);
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect((await prisma.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: p.id } })).snapshot).toEqual(p.snapshot);
});

it("proposta de agenda de recuperação preserva revisão, idempotência e versões concorrentes", async () => {
  const { fala } = await prepararItensDesignacao();
  const de = new Date(Date.now() + 120 * 60000), ate = new Date(de.getTime() + 30 * 60000);
  const d = { itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0,16), fimLocal: ate.toISOString().slice(0,16), fuso: "UTC", versaoEsperada: 0, motivo: "Proposta de horário para conferência", chaveIdempotencia: "proposta-agenda-original" };
  const r = await proporAgendaRecuperacao(d); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await proporAgendaRecuperacao(d)).toEqual(r);
  expect((await proporAgendaRecuperacao({ ...d, motivo: "Motivo alterado com mesma chave" })).ok).toBe(false);
  const original = await prisma.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  await expect(prisma.propostaAgendaRecuperacao.update({ where: { id: original.id }, data: { motivo: "Tentativa de alterar o histórico" } })).rejects.toThrow("imutável");
  await expect(prisma.propostaAgendaRecuperacao.delete({ where: { id: original.id } })).rejects.toThrow("imutável");
  expect(await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { versaoEsperada: 1, propostas: [{ versaoAtual: true, revisaoIndependente: false, estadoMudou: false, publicacaoAutorizada: false }] } });
  const outroGestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  entrar(outroGestor);
  expect(await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ revisaoIndependente: true, estadoMudou: false }] } });
  const simultaneas = await Promise.all(["versao-agenda-um", "versao-agenda-dois"].map(chaveIdempotencia => proporAgendaRecuperacao({ ...d, versaoEsperada: 1, chaveIdempotencia })));
  expect(simultaneas.filter(x => x.ok)).toHaveLength(1);
  expect(await prisma.propostaAgendaRecuperacao.count()).toBe(2);
  expect((await prisma.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: original.id } })).snapshot).toEqual(original.snapshot);
  expect(await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id, antesVersao: 2 })).toMatchObject({ ok: true, dado: { versaoEsperada: 2, propostas: [{ versao: 1, versaoAtual: false }] } });
  entrar(professor);
  expect((await proporAgendaRecuperacao({ ...d, versaoEsperada: 2, chaveIdempotencia: "professor-sem-acesso-agenda" })).ok).toBe(false);
  expect((await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id })).ok).toBe(false);
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect(await prisma.recebimento.count()).toBe(0);
});

it("revisão da proposta de agenda sinaliza conflito novo e preserva histórico após cancelamento", async () => {
  const { fala, p } = await prepararItensDesignacao();
  const de = new Date(Date.now() + 120 * 60000); de.setUTCSeconds(0,0);
  const ate = new Date(de.getTime() + 30 * 60000);
  const d = { itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0,16), fimLocal: ate.toISOString().slice(0,16), fuso: "UTC", versaoEsperada: 0, motivo: "Horário proposto antes do conflito", chaveIdempotencia: "proposta-agenda-revalidacao" };
  const criada = await proporAgendaRecuperacao(d); expect(criada.ok, JSON.stringify(criada)).toBe(true);
  await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor, inicio: de, fim: ate, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Novo compromisso publicado", chaveIdempotencia: "conflito-apos-proposta-agenda", entradaHash: "fixture" } });
  expect(await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ estadoMudou: true, conferenciaOriginal: { pendencias: [expect.stringContaining("calendário institucional")] } }] } });
  const reserva = await prisma.reservaTentativaRecuperacao.findFirstOrThrow({ where: { propostaId: p.id } });
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: reserva.id, motivo: "Cancelar pela escola após a proposta", evidencia: "Cancelamento institucional documentado" })).ok).toBe(true);
  expect(await consultarPropostasAgendaRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { propostas: [{ estadoMudou: true, impedimentoAtual: expect.stringContaining("cancelada") }] } });
  expect(await proporAgendaRecuperacao(d)).toEqual(criada);
  expect((await proporAgendaRecuperacao({ ...d, versaoEsperada: 1, chaveIdempotencia: "novo-horario-apos-cancelamento" })).ok).toBe(false);
  expect(await prisma.propostaAgendaRecuperacao.count()).toBe(1);
});

it("prévia da agenda de recuperação confere prazo, calendário, acesso e não grava encontro", async () => {
  const { fala } = await prepararItensDesignacao();
  const de = new Date(Date.now() + 120 * 60000), ate = new Date(de.getTime() + 30 * 60000);
  const entradaAgenda = { itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0, 16), fimLocal: ate.toISOString().slice(0, 16), fuso: "UTC" };
  const semCalendario = await preverAgendaRecuperacao(entradaAgenda);
  expect(semCalendario).toMatchObject({ ok: true, dado: { publicacaoAutorizada: false, professor: { id: professor }, pendencias: [expect.stringContaining("calendário institucional")] } });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const cal = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, motivo: "Calendário para recuperação", chaveIdempotencia: "calendario-recuperacao", periodos: [{ id: "feriado-teste", nome: "Feriado de teste", tipo: "FERIADO", inicio: de.toISOString().slice(0,10), fim: de.toISOString().slice(0,10) }] });
  if (!cal.ok || !cal.dado) throw new Error(JSON.stringify(cal));
  entrar((await criarUsuario(["ADMINISTRADOR"])).id);
  expect((await decidirCalendarioEscolar({ calendarioId: cal.dado.id, aprovar: true, motivo: "Conferência independente do calendário" })).ok).toBe(true);
  entrar(gestor);
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { diasNaoLetivos: ["feriado-teste"], pendencias: [expect.stringContaining("não letivo")] } });
  expect((await preverAgendaRecuperacao({ ...entradaAgenda, fimLocal: new Date(Date.now() + 2000 * 60000).toISOString().slice(0,16) })).ok).toBe(false);
  expect((await preverAgendaRecuperacao({ ...entradaAgenda, fimLocal: entradaAgenda.inicioLocal })).ok).toBe(false);
  expect((await preverAgendaRecuperacao({ ...entradaAgenda, fuso: "Invalido/Fuso" })).ok).toBe(false);
  entrar(professor);
  expect((await preverAgendaRecuperacao(entradaAgenda)).ok).toBe(false);
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(0);
  expect(await prisma.recebimento.count()).toBe(0);
});

it("prévia da recuperação detecta outro contrato do aluno e respeita limites de intervalo", async () => {
  const { fala } = await prepararItensDesignacao();
  const de = new Date(Date.now() + 120 * 60000); de.setUTCSeconds(0, 0);
  const ate = new Date(de.getTime() + 30 * 60000);
  const entradaAgenda = { itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0,16), fimLocal: ate.toISOString().slice(0,16), fuso: "UTC" };
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId, produtoId: base.produtoId, paisId: base.paisId, moeda: base.moeda, status: "ATIVA", ativadaEm: inicio } });
  const outroProfessor = (await criarUsuario(["PROFESSOR"])).id;
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: outra.id, professorId: outroProfessor, preparadorId: gestor, inicio: de, fim: ate, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro contrato do mesmo aluno", chaveIdempotencia: "conflito-contrato-recuperacao", entradaHash: "fixture" } });
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { conflitos: [{ inicio: de.toISOString(), fim: ate.toISOString(), envolveAvaliador: false }] } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { inicio: new Date(de.getTime() - 30 * 60000), fim: de } });
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { conflitos: [] } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { inicio: de, fim: ate, status: "CANCELADO" } });
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { conflitos: [] } });
  expect(await prisma.encontroAgenda.count()).toBe(1);
});

it("prévia da recuperação usa avaliador designado e confere indisponibilidade e reserva comercial", async () => {
  const { fala, p } = await prepararItensDesignacao();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  expect((await designarProfessorRecuperacao({ itemReservaId: fala.id, professorId: substituto, versaoEsperada: 0, motivo: "Designar avaliador para recuperação", chaveIdempotencia: "designar-previa-agenda" })).ok).toBe(true);
  const de = new Date(Date.now() + 120 * 60000); de.setUTCSeconds(0,0);
  const ate = new Date(de.getTime() + 30 * 60000);
  const entradaAgenda = { itemReservaId: fala.id, inicioLocal: de.toISOString().slice(0,16), fimLocal: ate.toISOString().slice(0,16), fuso: "UTC" };
  const ausencia = await prisma.indisponibilidadeDocente.create({ data: { professorId: substituto, preparadorId: substituto, inicio: de, fim: ate, fusoOrigem: "UTC", motivo: "Indisponibilidade para teste", chaveIdempotencia: "ausencia-previa-agenda", entradaHash: "fixture" } });
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { professor: { id: substituto }, indisponibilidades: 0 } });
  await prisma.decisaoIndisponibilidadeDocente.create({ data: { indisponibilidadeId: ausencia.id, decisorId: gestor, aprovada: true, motivo: "Ausência conferida pela gestão", encontrosAfetados: [] } });
  const reserva = await prisma.reservaAgendaParticular.create({ data: { matriculaId, preparadorId: gestor, expiraEm: ate, motivo: "Reserva comercial de teste", chaveIdempotencia: "reserva-comercial-previa", entradaHash: "fixture", snapshot: { professorId: professor, fusoOrigem: "UTC", encontros: [{ inicio: de.toISOString(), fim: ate.toISOString() }] } } });
  await prisma.horarioReservaParticular.create({ data: { reservaId: reserva.id, professorId: professor, inicio: de, fim: ate, fusoOrigem: "UTC" } });
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { indisponibilidades: 1, reservas: 1, publicacaoAutorizada: false } });
  await prisma.usuario.update({ where: { id: substituto }, data: { ativo: false } });
  expect(await preverAgendaRecuperacao(entradaAgenda)).toMatchObject({ ok: true, dado: { pendencias: expect.arrayContaining([expect.stringContaining("avaliador ativo")]) } });
  const reservaTentativa = await prisma.reservaTentativaRecuperacao.findFirstOrThrow({ where: { propostaId: p.id } });
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: reservaTentativa.id, motivo: "Cancelamento institucional da tentativa", evidencia: "Ocorrência conferida pela gestão" })).ok).toBe(true);
  expect((await preverAgendaRecuperacao(entradaAgenda)).ok).toBe(false);
});

it.each(["futuro", "foraDaTitularidade", "turmaConcluida"] as const)("oportunidade extra recusa docente %s no servidor e na escrita direta", async caso => {
  const { p } = await prepararItensDesignacao();
  expect((await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Esgotar saldo antes da conferência", chaveIdempotencia: "esgotar-extra-atribuicao" })).ok).toBe(true);
  entrar(professor);
  const entradaExtra = { alocacaoId, habilidade: "FALA" as const, quantidade: 1, motivo: "Solicitar nova oportunidade pedagógica", evidencias: "Parecer individual documentado", chaveIdempotencia: "extra-atribuicao-original" };
  const original = await proporExtraRecuperacao(entradaExtra);
  if (!original.ok || !original.dado) throw new Error(JSON.stringify(original));
  const proposta = await prisma.propostaExtraRecuperacao.findUniqueOrThrow({ where: { id: original.dado.id } });
  if (caso === "futuro") await prisma.vinculoDocente.updateMany({ where: { turmaId, professorId: professor, fim: null }, data: { inicio: new Date("2099-01-01") } });
  if (caso === "foraDaTitularidade") await prisma.turma.update({ where: { id: turmaId }, data: { professorId: (await criarUsuario(["PROFESSOR"])).id } });
  if (caso === "turmaConcluida") await prisma.turma.update({ where: { id: turmaId }, data: { status: "CONCLUIDA" } });
  expect((await consultarExtrasRecuperacao({ alocacaoId })).ok).toBe(false);
  expect((await proporExtraRecuperacao(entradaExtra)).ok).toBe(false);
  expect((await proporExtraRecuperacao({ ...entradaExtra, chaveIdempotencia: "extra-atribuicao-negada" })).ok).toBe(false);
  const snapshot = await prisma.$transaction(tx => estadoExtraRecuperacaoTx(tx, alocacaoId, "FALA"));
  await expect(prisma.propostaExtraRecuperacao.create({ data: { ...entradaExtra, chaveIdempotencia: "extra-atribuicao-direta", autorId: professor, matriculaId, nivelId: p.nivelId, snapshot, estadoHash: proposta.estadoHash, entradaHash: proposta.entradaHash } })).rejects.toThrow("Autor sem atribuição");
  expect(await prisma.propostaExtraRecuperacao.count()).toBe(1);
  // Gestão continua podendo resolver a solicitação anterior sem devolver acesso docente.
  entrar(gestor);
  expect((await decidirExtraRecuperacao({ propostaId: proposta.id, entradaHash: proposta.entradaHash, aprovada: false, motivo: "Resolver pendência preservando histórico" })).ok).toBe(true);
});

it("extras concorrentes não aprovam duas vezes a mesma base de saldo", async () => {
  const { p } = await prepararItensDesignacao();
  expect((await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Completar ocupação do limite", chaveIdempotencia: "ocupar-extra-concorrente" })).ok).toBe(true);
  entrar(professor);
  const ids: string[] = [];
  for (const chave of ["extra-concorrente-um", "extra-concorrente-dois"]) {
    const r = await proporExtraRecuperacao({ alocacaoId, habilidade: "FALA", quantidade: 1, motivo: "Exceção para tentativa adicional", evidencias: "Parecer da necessidade individual", chaveIdempotencia: chave });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r)); ids.push(r.dado.id);
  }
  const propostas = await prisma.propostaExtraRecuperacao.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  entrar(gestor);
  const resultados = await Promise.all(propostas.map(p => decidirExtraRecuperacao({ propostaId: p.id, entradaHash: p.entradaHash, aprovada: true, motivo: "Revisão independente da oportunidade" })));
  expect(resultados.filter(r => r.ok)).toHaveLength(1);
  expect(await prisma.decisaoExtraRecuperacao.count({ where: { aprovada: true } })).toBe(1);
  expect(await prisma.$transaction(tx => quantidadeExtraRecuperacaoTx(tx, matriculaId, p.nivelId, "FALA"))).toBe(1);
  const pendente = propostas[resultados.findIndex(r => !r.ok)];
  expect((await decidirExtraRecuperacao({ propostaId: pendente.id, entradaHash: pendente.entradaHash, aprovada: false, motivo: "Base superada pela outra autorização" })).ok).toBe(true);
  const entradas = [0,1].map(i => ({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const], motivo: "Disputa pela única oportunidade extra", chaveIdempotencia: `reserva-extra-disputa-${i}` }));
  const reservas = await Promise.all(entradas.map(reservarTentativaRecuperacao));
  expect(reservas.filter(r => r.ok)).toHaveLength(1);
  expect(await prisma.itemReservaTentativaRecuperacao.count({ where: { habilidade: "FALA" } })).toBe(3);
});

it("extra aprovada permite plano e reserva com limite original zero sem alterar a regra", async () => {
  const turmaBase = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const contratoBase = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const conteudo = regraAvaliacaoTeste();
  conteudo.habilidades.find(h => h.habilidade === "FALA")!.limiteRecuperacoes = 0;
  const r = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, { nivelId: turmaBase.nivelId, versaoEsperada: 1, conteudo, motivo: "Regra de teste com limite zero", chaveIdempotencia: "regra-zero-extras" }));
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: r.id } });
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, admin.id, { regraId: regra.id, conteudoHash: regra.conteudoHash, aprovada: true, motivo: "Publicação independente da regra de teste" }));
  const turma = await prisma.turma.create({ data: { modalidadeId: turmaBase.modalidadeId, nivelId: turmaBase.nivelId, professorId: professor, dataInicio: new Date("2099-01-01"), vinculosDocentes: { create: { professorId: professor, inicio } } } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  const contrato = await prisma.matricula.create({ data: { alunoId, produtoId: contratoBase.produtoId, paisId: contratoBase.paisId, moeda: contratoBase.moeda, status: "ATIVA", ativadaEm: inicio } });
  const vinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: contrato.id, turmaId: turma.id, criadoEm: inicio } });
  turmaId = turma.id; matriculaId = contrato.id; alocacaoId = vinculo.id;
  await oficializarResultadoRegular("5");
  const proposto = await proporPlanoRecuperacao(plano()); if (!proposto.ok || !proposto.dado) throw new Error(JSON.stringify(proposto));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: proposto.dado.id } });
  entrar(gestor);
  const decisaoPlano = { propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Conferência do plano sem limite original" };
  expect((await decidirPlanoRecuperacao(decisaoPlano)).ok).toBe(false);
  entrar(professor);
  const extra = await proporExtraRecuperacao({ alocacaoId, habilidade: "FALA", quantidade: 1, motivo: "Oportunidade individual excepcional", evidencias: "Condições pedagógicas documentadas", chaveIdempotencia: "extra-limite-zero" });
  if (!extra.ok || !extra.dado) throw new Error(JSON.stringify(extra));
  const pe = await prisma.propostaExtraRecuperacao.findUniqueOrThrow({ where: { id: extra.dado.id } });
  entrar(gestor);
  expect((await decidirExtraRecuperacao({ propostaId: pe.id, entradaHash: pe.entradaHash, aprovada: true, motivo: "Autorização independente para uma tentativa" })).ok).toBe(true);
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { planos: [{ podeAprovar: true }] } });
  expect((await decidirPlanoRecuperacao(decisaoPlano)).ok).toBe(true);
  await disponibilizarPlano(p);
  const reservar = (chaveIdempotencia: string) => reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Usar a oportunidade excepcional aprovada", chaveIdempotencia });
  expect((await reservar("reservar-unica-extra-zero")).ok).toBe(true);
  expect((await reservar("reservar-outra-extra-zero")).ok).toBe(false);
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { saldo: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", limiteBase: 0, extrasAprovadas: 1, limite: 1, reservadas: 1, disponiveis: 0 })]) } });
  expect((await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } })).conteudo).toEqual(regra.conteudo);
});

it("oportunidade extra exige decisão independente e aumenta só o limite da habilidade autorizada", async () => {
  const { p } = await prepararItensDesignacao();
  const extra = { alocacaoId, habilidade: "FALA" as const, quantidade: 1, motivo: "Autorizar nova oportunidade individual", evidencias: "Parecer pedagógico e atendimento registrados", chaveIdempotencia: "extra-recuperacao-teste" };
  entrar(professor);
  expect((await proporExtraRecuperacao(extra)).ok).toBe(false);
  entrar(gestor);
  const reservar = (chaveIdempotencia: string) => reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Reservar oportunidade de fala", chaveIdempotencia });
  expect((await reservar("segunda-reserva-extra")).ok).toBe(true);
  expect((await reservar("terceira-reserva-extra")).ok).toBe(false);
  entrar(professor);
  const r = await proporExtraRecuperacao(extra); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await proporExtraRecuperacao(extra)).toEqual(r);
  expect((await proporExtraRecuperacao({ ...extra, quantidade: 2 })).ok).toBe(false);
  expect(await consultarExtrasRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { itens: [{ id: r.dado.id, podeDecidir: false, entradaHash: null }] } });
  const proposta = await prisma.propostaExtraRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  await expect(prisma.propostaExtraRecuperacao.update({ where: { id: proposta.id }, data: { quantidade: 9 } })).rejects.toThrow("imutáveis");
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const d = { propostaId: proposta.id, entradaHash: proposta.entradaHash, aprovada: true, motivo: "Exceção individual conferida" };
  expect((await decidirExtraRecuperacao(d)).ok).toBe(false);
  await expect(prisma.decisaoExtraRecuperacao.create({ data: { propostaId: proposta.id, decisorId: professor, aprovada: true, motivo: d.motivo } })).rejects.toThrow("Outra pessoa");
  entrar(gestor);
  expect(await consultarExtrasRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { itens: [{ podeDecidir: true, entradaHash: proposta.entradaHash }] } });
  const aprovada = await decidirExtraRecuperacao(d); expect(aprovada.ok, JSON.stringify(aprovada)).toBe(true);
  expect(await decidirExtraRecuperacao(d)).toEqual(aprovada);
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { saldo: expect.arrayContaining([
    expect.objectContaining({ habilidade: "FALA", limiteBase: 2, extrasAprovadas: 1, limite: 3, disponiveis: 1 }),
    expect.objectContaining({ habilidade: "ESCRITA", limite: 2, extrasAprovadas: 0 }),
  ]) } });
  expect((await reservar("terceira-reserva-extra")).ok).toBe(true);
  expect((await reservar("quarta-reserva-extra")).ok).toBe(false);
  await expect(prisma.reservaTentativaRecuperacao.create({ data: { propostaId: p.id, autorId: gestor, motivo: "Tentativa direta acima do limite", chaveIdempotencia: "quarta-direta-extra", entradaHash: "fixture", itens: { create: { habilidade: "FALA" } } } })).rejects.toThrow("Limite de tentativas");
  const contrato = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outroContrato = await prisma.matricula.create({ data: { alunoId, produtoId: contrato.produtoId, paisId: contrato.paisId, moeda: contrato.moeda, status: "ATIVA", ativadaEm: inicio } });
  expect(await prisma.$transaction(tx => quantidadeExtraRecuperacaoTx(tx, outroContrato.id, p.nivelId, "FALA"))).toBe(0);
  expect(await prisma.$transaction(tx => quantidadeExtraRecuperacaoTx(tx, matriculaId, p.nivelId, "ESCRITA"))).toBe(0);
  await expect(prisma.decisaoExtraRecuperacao.delete({ where: { id: aprovada.ok ? aprovada.dado!.id : "" } })).rejects.toThrow("imutáveis");
  expect(await prisma.recebimento.count()).toBe(0);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(0);
});

it("oportunidade extra revalida saldo e permite rejeitar proposta desatualizada", async () => {
  const { p } = await prepararItensDesignacao();
  const reserva = await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Esgotar saldo autorizado", chaveIdempotencia: "esgotar-extra-revisao" });
  if (!reserva.ok || !reserva.dado) throw new Error(JSON.stringify(reserva));
  entrar(professor);
  const extra = await proporExtraRecuperacao({ alocacaoId, habilidade: "FALA", quantidade: 1, motivo: "Solicitação após esgotar o saldo", evidencias: "Registro da necessidade pedagógica", chaveIdempotencia: "extra-estado-alterado" });
  if (!extra.ok || !extra.dado) throw new Error(JSON.stringify(extra));
  const pExtra = await prisma.propostaExtraRecuperacao.findUniqueOrThrow({ where: { id: extra.dado.id } });
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { oportunidadesExtrasAguardandoDecisao: 1 } } });
  entrar(gestor);
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: reserva.dado.id, motivo: "Escola liberou uma tentativa", evidencia: "Cancelamento institucional registrado" })).ok).toBe(true);
  const d = { propostaId: pExtra.id, entradaHash: pExtra.entradaHash, aprovada: true, motivo: "Conferência da exceção solicitada" };
  expect((await decidirExtraRecuperacao(d)).ok).toBe(false);
  expect(await consultarExtrasRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { itens: [{ podeDecidir: true, podeAprovar: false }] } });
  await expect(prisma.decisaoExtraRecuperacao.create({ data: { propostaId: pExtra.id, decisorId: gestor, aprovada: true, motivo: d.motivo } })).rejects.toThrow("saldo ou vínculo");
  expect((await decidirExtraRecuperacao({ ...d, aprovada: false })).ok).toBe(true);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { oportunidadesExtrasAguardandoDecisao: 0 } } });
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await consultarExtrasRecuperacao({ alocacaoId })).ok).toBe(false);
});

it("acompanhamento identifica correção pendente sem trocar nota e retira somente após decisão", async () => {
  await oficializarResultadoRegular("7");
  const nota = await prisma.versaoLancamentoAvaliacao.findFirstOrThrow({ where: { registro: { alocacaoId, codigoAvaliacao: "I1" } } });
  const proposta = await proporCorrecaoNota({ lancamentoId: nota.id, origemHash: nota.conteudoHash, versaoEsperada: 0,
    motivo: "Conferir divergência da avaliação", chaveIdempotencia: "pendencia-consolidado-correcao",
    notas: [{ habilidade: "FALA", nota: "5", comentarioAluno: "Conferência do resultado" }] });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: {
    pendenciasOperacionais: { correcoesRegulares: 1, correcoesRecuperacao: 0, planosAguardandoDecisao: 0, planosSemDisponibilizacao: 0, tentativasAguardandoRealizacao: 0 },
    resultado: { geral: { numerador: "7", denominador: "1" } },
  } });
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const outraMatricula = await prisma.matricula.create({ data: { alunoId, produtoId: m.produtoId, paisId: m.paisId, moeda: m.moeda, status: "ATIVA", ativadaEm: inicio } });
  const outraTurma = await prisma.turma.create({ data: { modalidadeId: t.modalidadeId, nivelId: t.nivelId, professorId: professor, dataInicio: new Date("2099-01-01"), vinculosDocentes: { create: { professorId: professor, inicio } } } });
  const outroVinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outraMatricula.id, turmaId: outraTurma.id, criadoEm: inicio } });
  expect(await consultarConsolidadoAvaliacoes(outroVinculo.id)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { correcoesRegulares: 0 }, resultado: { matriculaId: outraMatricula.id } } });
  entrar(gestor);
  const revisao = await revisarCorrecaoNota(proposta.dado.id);
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  expect((await decidirCorrecaoNota({ propostaId: proposta.dado.id, propostaHash: revisao.dado.propostaHash,
    impactosHash: revisao.dado.impactosHash, aprovada: false, motivo: "Nota original comprovada na conferência" })).ok).toBe(true);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { correcoesRegulares: 0 }, resultado: { geral: { numerador: "7", denominador: "1" } } } });
  entrar(professor);
  await prisma.usuario.update({ where: { id: professor }, data: { ativo: false } });
  expect((await consultarConsolidadoAvaliacoes(alocacaoId)).ok).toBe(false);
});

it("acompanhamento separa decisão do plano e disponibilização ao aluno", async () => {
  await oficializarResultadoRegular("5");
  const proposta = await proporPlanoRecuperacao(plano());
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { planosAguardandoDecisao: 1, planosSemDisponibilizacao: 0, habilidadesSemTentativa: 0 } } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Conferência do plano de avaliação" })).ok).toBe(true);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { planosAguardandoDecisao: 0, planosSemDisponibilizacao: 1, habilidadesSemTentativa: 4 } } });
  await disponibilizarPlano(p);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { planosAguardandoDecisao: 0, planosSemDisponibilizacao: 0, tentativasAguardandoRealizacao: 0, habilidadesSemTentativa: 4 } } });
});

it("acompanhamento distingue tentativas pendentes, realizadas e canceladas parcialmente", async () => {
  const { fala, escrita } = await prepararItensDesignacao();
  entrar(gestor);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { planosAguardandoDecisao: 0, planosSemDisponibilizacao: 0, tentativasAguardandoRealizacao: 2, habilidadesSemTentativa: 2 } } });
  entrar(professor);
  expect((await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação de fala aplicada" })).ok).toBe(true);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { tentativasAguardandoRealizacao: 1, habilidadesSemTentativa: 2 }, resultado: { recuperacoesPendentes: true } } });
  const reserva = await prisma.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: escrita.id } });
  entrar(gestor);
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: reserva.reservaId, motivo: "Escola cancelou somente a parte pendente", evidencia: "Atendimento acadêmico registrado" })).ok).toBe(true);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { tentativasAguardandoRealizacao: 0, habilidadesSemTentativa: 3 }, resultado: { recuperacoesPendentes: true } } });
});

it("frequência consulta o contrato histórico e sinaliza dados sem conclusão conferida", async () => {
  const e = await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date(data), fim: new Date("2026-01-10T11:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro da frequência", chaveIdempotencia: "frequencia-prevista", entradaHash: "fixture" } });
  let consulta = await consultarConsolidadoAvaliacoes(alocacaoId);
  expect(consulta.ok).toBe(true);
  if (!consulta.ok) throw new Error(consulta.erro);
  expect(consulta.dado!.frequencia).toMatchObject({ base: 0, atendeMinimo: null, pendencias: [{ aulaId: e.id, motivo: "CONCLUSAO_DA_AULA" }] });
  await prisma.aulaDiario.create({ data: { turmaId, professorId: professor, ocorridaEm: new Date(data), conteudo: "Diário anterior à agenda" } });
  consulta = await consultarConsolidadoAvaliacoes(alocacaoId);
  if (!consulta.ok) throw new Error(consulta.erro);
  expect(consulta.dado!.frequencia.pendenciasHistoricas).toEqual([expect.objectContaining({ motivo: "DIARIO_SEM_ENCONTRO_CONFERIDO" })]);
  await prisma.matricula.update({ where: { id: matriculaId }, data: { ativadaEm: null } });
  consulta = await consultarConsolidadoAvaliacoes(alocacaoId);
  if (!consulta.ok) throw new Error(consulta.erro);
  expect(consulta.dado!.frequencia).toMatchObject({ base: 0, atendeMinimo: null });
  expect(consulta.dado!.frequencia.pendenciasHistoricas).toContainEqual({ origemId: e.id, motivo: "SITUACAO_CONTRATUAL_NAO_CONFERIDA" });
});

async function criarFonteFrequenciaConcluida({ presente, participacao, comMatricula = false }: {
  presente: boolean;
  participacao?: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO";
  comMatricula?: boolean;
}) {
  const e = await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date(data), fim: new Date("2026-01-10T11:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro realizado", chaveIdempotencia: "frequencia-ministrada", entradaHash: "fixture" } });
  await prisma.aulaDiario.create({ data: { encontroId: e.id, turmaId, professorId: professor, ocorridaEm: new Date(data), conteudo: "Aula registrada",
    registros: { create: { alunoId, nomeAluno: "Aluno de teste", presente, ...(participacao ? { participacao } : {}), ...(comMatricula ? { matriculaId } : {}) } } } });
  await prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } });
  return e;
}

it("frequência conta presença registrada", async () => {
  await criarFonteFrequenciaConcluida({ presente: true });
  const consulta = await consultarConsolidadoAvaliacoes(alocacaoId);
  if (!consulta.ok) throw new Error(consulta.erro);
  expect(consulta.dado!.frequencia).toMatchObject({ base: 1, presencas: 1, atendeMinimo: true, pendencias: [], pendenciasHistoricas: [] });
});

it("frequência mantém ausência sem classificação em conferência", async () => {
  const e = await criarFonteFrequenciaConcluida({ presente: false });
  const consulta = await consultarConsolidadoAvaliacoes(alocacaoId);
  if (!consulta.ok) throw new Error(consulta.erro);
  expect(consulta.dado!.frequencia).toMatchObject({ base: 1, presencas: 0, atendeMinimo: null,
    pendenciasHistoricas: [{ origemId: e.id, motivo: "CONFERIR_AUSENCIA_E_REGULARIZACOES" }] });
});

it("frequência contabiliza impedimento com matrícula", async () => {
  await criarFonteFrequenciaConcluida({ presente: false, participacao: "IMPEDIDO_POR_RESTRICAO", comMatricula: true });
  const consulta = await consultarConsolidadoAvaliacoes(alocacaoId);
  if (!consulta.ok) throw new Error(consulta.erro);
  expect(consulta.dado!.frequencia).toMatchObject({ base: 1, presencas: 0, impedimentos: 1, atendeMinimo: false, pendenciasHistoricas: [] });
});
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  professor = (await criarUsuario(["PROFESSOR"])).id; gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, { nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra de teste para notas", chaveIdempotencia: "regra-lancamento-teste" }));
  const r = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, admin, { regraId: r.id, conteudoHash: r.conteudoHash, aprovada: true, motivo: "Publicação independente" }));
  const t = await prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, professorId: professor, dataInicio: new Date("2099-01-01"), vinculosDocentes: { create: { professorId: professor, inicio } } } }); turmaId = t.id;
  await prisma.turma.update({ where: { id: t.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno de teste", paisId: c.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio } })).id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } })).id;
  entrar(professor);
});
async function salvar(input: Parameters<typeof salvarLancamentoAvaliacao>[0] = entrada()) {
  const r = await salvarLancamentoAvaliacao(input);
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  return prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: r.dado.id } });
}
const decisao = (v: { id: string; conteudoHash: string }) => ({ lancamentoId: v.id, conteudoHash: v.conteudoHash, aprovada: true, motivo: "Notas conferidas pela gestão" });

const atividadeRecuperacao = (habilidade: typeof HABILIDADES[number]) => ({ habilidade, estrategia: "Estudo orientado da habilidade", avaliacaoProposta: "Reavaliação externa com registro docente" });
const plano = () => ({ alocacaoId, versaoEsperada: 0, motivo: "Plano a partir de insuficiência nas notas", chaveIdempotencia: "proposta-recuperacao-teste", atividades: HABILIDADES.map(atividadeRecuperacao) });
async function disponibilizarPlano(p: { id: string; entradaHash: string }) {
  const aprovada = await prisma.decisaoPlanoRecuperacao.findUniqueOrThrow({ where: { propostaId: p.id } });
  await aguardarInstanteRegistrado(aprovada.criadaEm);
  const r = await registrarDisponibilizacaoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, disponibilizadaEm: (await instanteAtualConferido()).toISOString(), condicoes: "Atividades e condições de avaliação disponíveis", evidenciaComunicacao: "Orientação ao aluno registrada pela escola" });
  if (!r.ok) throw new Error(JSON.stringify(r));
}
async function oficializarResultadoRegular(nota: string | Partial<Record<typeof HABILIDADES[number], string>>) {
  const notaDaHabilidade = (habilidade: typeof HABILIDADES[number]) => typeof nota === "string" ? nota : nota[habilidade] ?? "5";
  entrar(professor);
  const i = await salvar({ ...entrada(), submetida: true, notas: [{ habilidade: "FALA", nota: notaDaHabilidade("FALA"), comentarioAluno: "Resultado intermediário" }] });
  entrar(gestor); expect((await oficializarLancamentoAvaliacao(decisao(i))).ok).toBe(true);
  entrar(professor);
  const f = await salvar({ ...entrada(), codigoAvaliacao: "F1", chaveIdempotencia: "resultado-final-recuperacao", submetida: true, notas: HABILIDADES.map(habilidade => ({ habilidade, nota: notaDaHabilidade(habilidade), comentarioAluno: "Resultado final" })) });
  entrar(gestor); expect((await oficializarLancamentoAvaliacao(decisao(f))).ok).toBe(true);
  entrar(professor);
}

it("registra autorização de preparação após pausa e exige seu vínculo na proposta", async () => {
  const { autorizarPreparacaoEspecialRecuperacao } = await import("./recuperacao-autorizacao-preparacao");
  const { autorizarPreparacaoEspecialLocal } = await import("./recuperacao-autorizacao-preparacao-local");
  await oficializarResultadoRegular("5");
  const dados = { alocacaoId, motivo: "Preparar recuperação de insuficiência após pausa", prazoAte: new Date(Date.now()+86400000).toISOString(), chaveIdempotencia: "autorizar-preparacao-pausada" };
  entrar(gestor);
  expect(await autorizarPreparacaoEspecialRecuperacao(dados)).toMatchObject({ ok: false });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } = await import("@/server/matricula/pausa-proposta");
  const { aplicarPausaMatriculasTx } = await import("@/server/matricula/pausa-execucao");
  entrar(admin);
  const pausa = await solicitarPausaMatriculas(alunoId, { matriculaIds: [matriculaId], dataEfetiva: new Date().toISOString().slice(0,10), motivo: "Pausa com resultado insuficiente sem plano", chaveIdempotencia: "pausa-antes-preparacao" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Conferência independente da pausa" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, admin, new Date()));
  entrar(professor);
  expect(await autorizarPreparacaoEspecialRecuperacao(dados)).toMatchObject({ ok: false });
  entrar(gestor);
  const autorizada = await autorizarPreparacaoEspecialRecuperacao(dados);
  if (!autorizada.ok || !autorizada.dado) throw new Error(JSON.stringify(autorizada));
  expect(await autorizarPreparacaoEspecialRecuperacao(dados)).toEqual(autorizada);
  expect(await autorizarPreparacaoEspecialLocal({ alocacaoId, motivo: dados.motivo, prazoLocal: dados.prazoAte.slice(0,-1), fuso: "UTC", chaveIdempotencia: dados.chaveIdempotencia })).toEqual(autorizada);
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { podeAutorizarPreparacao: true, podePropor: true, autorizacaoPreparacao: { id: autorizada.dado.id, prazoAte: dados.prazoAte } } });
  expect(await autorizarPreparacaoEspecialRecuperacao({ ...dados, motivo: "Outro motivo usando a mesma chave" })).toMatchObject({ ok: false });
  const registro = await prisma.autorizacaoEspecialPreparacaoRecuperacao.findUniqueOrThrow({ where: { id: autorizada.dado.id } });
  expect(registro.snapshot).toMatchObject({ matriculaId, alocacaoId, turmaId, statusMatricula: "PAUSADA" });
  await expect(prisma.autorizacaoEspecialPreparacaoRecuperacao.update({ where: { id: registro.id }, data: { motivo: "Alteração indevida do histórico" } })).rejects.toThrow(/imutável/i);
  await expect(prisma.autorizacaoEspecialPreparacaoRecuperacao.create({ data: { ...registro, snapshot: { matriculaId, alocacaoId, turmaId, statusMatricula: "PAUSADA" }, id: "preparacao-docente-invalida", autorizadorId: professor, chaveIdempotencia: "docente-preparacao-invalida" } })).rejects.toThrow(/Fonte/i);
  await expect(prisma.autorizacaoEspecialPreparacaoRecuperacao.create({ data: { ...registro, id: "preparacao-fonte-invalida", chaveIdempotencia: "fonte-preparacao-invalida", snapshot: {} } })).rejects.toThrow(/Snapshot/i);
  expect(await prisma.propostaPlanoRecuperacao.count()).toBe(0);
  expect(await prisma.reservaTentativaRecuperacao.count()).toBe(0);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(0);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
  entrar(professor);
  expect(await proporPlanoRecuperacao(plano())).toMatchObject({ ok: false });
  const consultaDocente = await consultarPlanosRecuperacao({ alocacaoId });
  if (!consultaDocente.ok || !consultaDocente.dado) throw new Error(JSON.stringify(consultaDocente));
  expect(consultaDocente.dado).toMatchObject({ podeAutorizarPreparacao: false, podePropor: true, autorizacaoPreparacao: { id: registro.id } });
  expect(consultaDocente.dado.autorizacaoPreparacao).not.toHaveProperty("motivo");
  const entradaPlano = { ...plano(), autorizacaoPreparacaoId: registro.id };
  const proposta = await proporPlanoRecuperacao(entradaPlano);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await proporPlanoRecuperacao(entradaPlano)).toEqual(proposta);
  const planoRegistrado = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  expect(planoRegistrado).toMatchObject({ autorizacaoPreparacaoId: registro.id, matriculaId, alocacaoId });
  expect(await prisma.decisaoPlanoRecuperacao.count()).toBe(0);
  expect(await prisma.reservaTentativaRecuperacao.count()).toBe(0);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  expect(await proporPlanoRecuperacao({ ...entradaPlano, versaoEsperada: 1, chaveIdempotencia: "preparacao-autor-inativo" })).toMatchObject({ ok: false });
  entrar(admin);
  const decisaoPlano = { propostaId: planoRegistrado.id, propostaHash: planoRegistrado.entradaHash, aprovada: true, motivo: "Conferência independente da recuperação durante pausa" };
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { podePropor: false, autorizacaoPreparacao: null, planos: [expect.objectContaining({ podeAprovar: false })] } });
  expect(await decidirPlanoRecuperacao(decisaoPlano)).toMatchObject({ ok: false });
  await expect(prisma.decisaoPlanoRecuperacao.create({ data: { propostaId: planoRegistrado.id, decisorId: admin, aprovada: true, motivo: decisaoPlano.motivo } })).rejects.toThrow(/Autorização especial/i);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: true } });
  entrar(professor);
  expect(await decidirPlanoRecuperacao(decisaoPlano)).toMatchObject({ ok: false });
  await expect(prisma.decisaoPlanoRecuperacao.create({ data: { propostaId: planoRegistrado.id, decisorId: professor, aprovada: true, motivo: decisaoPlano.motivo } })).rejects.toThrow(/outra pessoa/i);
  entrar(admin);
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { planos: [expect.objectContaining({ podeAprovar: true })] } });
  expect(await decidirPlanoRecuperacao(decisaoPlano)).toMatchObject({ ok: true });
  expect(await consultarOperacaoRecuperacao({ propostaId: planoRegistrado.id })).toMatchObject({ ok: true, dado: { podeDisponibilizar: true, podeReservar: false } });
  await disponibilizarPlano(planoRegistrado);
  expect(await prisma.disponibilizacaoPlanoRecuperacao.count({ where: { propostaId: planoRegistrado.id } })).toBe(1);
  expect(await reservarTentativaRecuperacao({ propostaId: planoRegistrado.id, propostaHash: planoRegistrado.entradaHash, habilidades: ["FALA"], motivo: "Tentativa sem autorização própria de reserva", chaveIdempotencia: "nao-reservar-so-preparacao" })).toMatchObject({ ok: false });
  expect(await prisma.reservaTentativaRecuperacao.count()).toBe(0);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
  const { consultarHistoricoPreparacaoRecuperacao } = await import("./recuperacao-preparacao-historico");
  entrar(professor);
  expect(await consultarHistoricoPreparacaoRecuperacao({ alocacaoId })).toMatchObject({ ok: false });
  entrar(admin);
  for (let indice = 0; indice < 20; indice++) {
    const nova = await autorizarPreparacaoEspecialRecuperacao({ ...dados, chaveIdempotencia: `historico-preparacao-${indice}` });
    if (!nova.ok) throw new Error(JSON.stringify(nova));
  }
  const primeira = await consultarHistoricoPreparacaoRecuperacao({ alocacaoId });
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.historico).toHaveLength(20);
  expect(primeira.dado.proximoId).not.toBeNull();
  expect(primeira.dado.historico.find(a => a.id === registro.id)).toMatchObject({ quantidadePropostas: 1 });
  expect(primeira.dado.historico[0]).not.toHaveProperty("snapshot");
  expect(primeira.dado.historico[0]).not.toHaveProperty("entradaHash");
  const segunda = await consultarHistoricoPreparacaoRecuperacao({ alocacaoId, depoisId: primeira.dado.proximoId! });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.historico).toHaveLength(1);
  expect(segunda.dado.proximoId).toBeNull();
  expect(new Set([...primeira.dado.historico, ...segunda.dado.historico].map(a => a.id)).size).toBe(21);
  const outroVinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, ativa: false, criadoEm: new Date("2026-01-01T00:00:00Z"), encerradaEm: new Date("2026-01-02T00:00:00Z") } });
  expect(await consultarHistoricoPreparacaoRecuperacao({ alocacaoId: outroVinculo.id })).toMatchObject({ ok: true, dado: { historico: [], proximoId: null } });
});

it("disponibiliza plano aprovado antes da pausa sem substituir proposta ou decisão", async () => {
  await oficializarResultadoRegular("5");
  const proposta = await proporPlanoRecuperacao(plano());
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  entrar(gestor);
  expect(await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano aprovado ainda durante atividade" })).toMatchObject({ ok: true });
  const decisaoAntes = await prisma.decisaoPlanoRecuperacao.findUniqueOrThrow({ where: { propostaId: p.id } });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } = await import("@/server/matricula/pausa-proposta");
  const { aplicarPausaMatriculasTx } = await import("@/server/matricula/pausa-execucao");
  entrar(admin);
  const pausa = await solicitarPausaMatriculas(alunoId, { matriculaIds: [matriculaId], dataEfetiva: new Date().toISOString().slice(0,10), motivo: "Pausa antes de disponibilizar plano aprovado", chaveIdempotencia: "pausa-plano-ja-aprovado" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa conferida pelo financeiro" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, admin, new Date()));
  entrar(gestor);
  const { autorizarPreparacaoEspecialRecuperacao } = await import("./recuperacao-autorizacao-preparacao");
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { podeDisponibilizar: false, autorizacaoDisponibilizacao: null } });
  const autorizacao = await autorizarPreparacaoEspecialRecuperacao({ alocacaoId, motivo: "Continuar disponibilização do plano já aprovado", prazoAte: new Date(Date.now()+86400000).toISOString(), chaveIdempotencia: "continuar-plano-aprovado" });
  if (!autorizacao.ok || !autorizacao.dado) throw new Error(JSON.stringify(autorizacao));
  const grant = await prisma.autorizacaoEspecialPreparacaoRecuperacao.findUniqueOrThrow({ where: { id: autorizacao.dado.id } });
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { podeDisponibilizar: true, autorizacaoDisponibilizacao: { id: grant.id, prazoAte: grant.prazoAte.toISOString() } } });
  entrar(professor);
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { podeDisponibilizar: false, autorizacaoDisponibilizacao: null } });
  entrar(gestor);
  const entrada = { propostaId: p.id, propostaHash: p.entradaHash, disponibilizadaEm: (await instanteAtualConferido()).toISOString(), condicoes: "Atividades disponíveis para a pendência autorizada", evidenciaComunicacao: "Aluno informado pelo canal institucional" };
  expect(await registrarDisponibilizacaoRecuperacao(entrada)).toMatchObject({ ok: false });
  const especial = { ...entrada, autorizacaoPreparacaoId: autorizacao.dado.id };
  const local = { propostaId: p.id, propostaHash: p.entradaHash, dataHora: entrada.disponibilizadaEm.slice(0, -1), fuso: "UTC", condicoes: entrada.condicoes, evidenciaComunicacao: entrada.evidenciaComunicacao, autorizacaoPreparacaoId: grant.id };
  const disponibilizada = await disponibilizarRecuperacaoLocal(local);
  if (!disponibilizada.ok || !disponibilizada.dado) throw new Error(JSON.stringify(disponibilizada));
  expect(await registrarDisponibilizacaoRecuperacao(especial)).toEqual(disponibilizada);
  expect(await registrarDisponibilizacaoRecuperacao(entrada)).toMatchObject({ ok: false });
  expect(await prisma.disponibilizacaoPlanoRecuperacao.findUniqueOrThrow({ where: { id: disponibilizada.dado.id } })).toMatchObject({ autorizacaoPreparacaoId: autorizacao.dado.id });
  expect(await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: p.id } })).toEqual(p);
  expect(await prisma.decisaoPlanoRecuperacao.findUniqueOrThrow({ where: { propostaId: p.id } })).toEqual(decisaoAntes);
  expect(await prisma.propostaPlanoRecuperacao.count()).toBe(1);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
});

async function prepararItensDesignacao(habilidades: typeof HABILIDADES[number][] = ["FALA", "ESCRITA"], notasRegulares: string | Partial<Record<typeof HABILIDADES[number], string>> = "5") {
  await oficializarResultadoRegular(notasRegulares);
  const propostaPlano = plano();
  if (typeof notasRegulares !== "string") propostaPlano.atividades = propostaPlano.atividades.filter(a => habilidades.includes(a.habilidade));
  const rp = await proporPlanoRecuperacao(propostaPlano); if (!rp.ok || !rp.dado) throw new Error(JSON.stringify(rp));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: rp.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano com designação limitada" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const reserva = await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades, motivo: "Reservar para os avaliadores", chaveIdempotencia: "reserva-designacao-recuperacao" });
  if (!reserva.ok || !reserva.dado) throw new Error(JSON.stringify(reserva));
  const itens = await prisma.itemReservaTentativaRecuperacao.findMany({ where: { reservaId: reserva.dado.id } });
  return { p, fala: itens.find(i => i.habilidade === "FALA")!, escrita: itens.find(i => i.habilidade === "ESCRITA")! };
}

it("registra autorização especial de recuperação sem realizar nem aumentar tentativas", async () => {
  const { fala } = await prepararItensDesignacao();
  const d = { itemReservaId: fala.id, prazoAte: new Date(Date.now() + 86400000).toISOString(), motivo: "Regularizar pendência específica após pausa", chaveIdempotencia: "autorizacao-especial-recuperacao" };
  expect(await autorizarRealizacaoEspecialRecuperacao(d)).toMatchObject({ ok: false });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  entrar(professor);
  expect(await autorizarRealizacaoEspecialRecuperacao(d)).toMatchObject({ ok: false });
  expect(await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { podeAutorizar: true, historico: [] } });
  const antes = await prisma.itemReservaTentativaRecuperacao.count();
  const r = await autorizarRealizacaoEspecialRecuperacao(d);
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await autorizarRealizacaoEspecialRecuperacao(d)).toEqual(r);
  expect(await autorizarRealizacaoEspecialRecuperacao({ ...d, motivo: "Outra finalidade para a mesma chave" })).toMatchObject({ ok: false });
  const salvo = await prisma.autorizacaoEspecialRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  const consultaAutorizacao = await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id });
  expect(consultaAutorizacao).toMatchObject({ ok: true, dado: { historico: [{ id: salvo.id, motivo: d.motivo, prazoAte: d.prazoAte }] } });
  expect(JSON.stringify(consultaAutorizacao)).not.toMatch(/snapshot|entradaHash|chaveIdempotencia/);
  expect(await autorizarRecuperacaoEspecialLocal({ itemReservaId: fala.id, prazoLocal: d.prazoAte.slice(0,-1), fuso: "UTC", motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia })).toEqual(r);
  expect(await autorizarRecuperacaoEspecialLocal({ itemReservaId: fala.id, prazoLocal: d.prazoAte.slice(0,-1), fuso: "fuso-invalido", motivo: d.motivo, chaveIdempotencia: "fuso-invalido-recuperacao" })).toMatchObject({ ok: false });
  expect(salvo.snapshot).toMatchObject({ matriculaId, alocacaoId, itemReservaId: fala.id, statusMatricula: "PAUSADA" });
  await expect(prisma.realizacaoRecuperacao.create({ data: {
    itemReservaId: fala.id, professorId: professor, registradaPorId: professor,
    realizadaEm: await instanteAtualConferido(), evidencia: "Autorização não substitui histórico contratual ausente",
    autorizacaoEspecialId: salvo.id,
  } })).rejects.toThrow(/contratual|histórico|conferência/i);
  await expect(prisma.autorizacaoEspecialRecuperacao.create({ data: {
    itemReservaId: fala.id, autorizadorId: gestor, motivo: d.motivo, prazoAte: new Date(d.prazoAte),
    chaveIdempotencia: "autorizacao-fonte-invalida", entradaHash: "a".repeat(64), snapshot: { matriculaId: "outro-contrato" },
  } })).rejects.toThrow(/Fonte/);
  await expect(prisma.autorizacaoEspecialRecuperacao.create({ data: {
    itemReservaId: fala.id, autorizadorId: professor, motivo: d.motivo, prazoAte: new Date(d.prazoAte),
    chaveIdempotencia: "autorizacao-docente-direta", entradaHash: "a".repeat(64), snapshot: salvo.snapshot!,
  } })).rejects.toThrow(/gestor/);
  await expect(prisma.autorizacaoEspecialRecuperacao.update({ where: { id: salvo.id }, data: { motivo: "Alteração indevida da autorização" } })).rejects.toThrow();
  await expect(prisma.autorizacaoEspecialRecuperacao.delete({ where: { id: salvo.id } })).rejects.toThrow();
  expect(await prisma.itemReservaTentativaRecuperacao.count()).toBe(antes);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(0);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });

});

it("pagina autorizações de realização sem repetir registros nem aceitar cursor de outra tentativa", async () => {
  const { fala, escrita } = await prepararItensDesignacao();
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  entrar(gestor);
  const prazoAte = new Date(Date.now() + 86400000).toISOString();
  for (let i = 0; i < 21; i++) {
    expect(await autorizarRealizacaoEspecialRecuperacao({ itemReservaId: fala.id, prazoAte,
      motivo: `Autorização histórica de realização ${i}`, chaveIdempotencia: `pagina-realizacao-${i}` })).toMatchObject({ ok: true });
  }
  const outra = await autorizarRealizacaoEspecialRecuperacao({ itemReservaId: escrita.id, prazoAte,
    motivo: "Autorização de outra habilidade", chaveIdempotencia: "pagina-realizacao-outra" });
  if (!outra.ok || !outra.dado) throw new Error(JSON.stringify(outra));
  const primeira = await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id });
  if (!primeira.ok || !primeira.dado?.proximoId) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.historico).toHaveLength(20);
  const segunda = await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id, depoisId: primeira.dado.proximoId });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.historico).toHaveLength(1);
  expect(segunda.dado.proximoId).toBeNull();
  const esperadas = await prisma.autorizacaoEspecialRecuperacao.findMany({ where: { itemReservaId: fala.id }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], select: { id: true } });
  expect([...primeira.dado.historico, ...segunda.dado.historico].map(a => a.id)).toEqual(esperadas.map(a => a.id));
  expect(JSON.stringify(primeira)).not.toMatch(/snapshot|entradaHash|chaveIdempotencia/);
  expect(await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id, depoisId: outra.dado.id })).toMatchObject({ ok: false });
  expect(await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id, depoisId: "cursor-inexistente" })).toMatchObject({ ok: false });
  entrar(professor);
  expect(await consultarAutorizacoesEspeciaisRecuperacao({ itemReservaId: fala.id, depoisId: primeira.dado.proximoId })).toMatchObject({ ok: false });
});

it("realiza somente a recuperação autorizada após pausa contratual efetivamente aplicada", async () => {
  const { p, fala, escrita } = await prepararItensDesignacao();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } = await import("@/server/matricula/pausa-proposta");
  const { aplicarPausaMatriculasTx } = await import("@/server/matricula/pausa-execucao");
  entrar(admin);
  const pausa = await solicitarPausaMatriculas(alunoId, { matriculaIds: [matriculaId], dataEfetiva: new Date().toISOString().slice(0,10), motivo: "Pausa contratual com recuperação pendente", chaveIdempotencia: "pausa-recuperacao-autorizada" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa conferida independentemente" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, admin, new Date()));
  const situacoesSql = await prisma.$queryRaw<{ atual: string; anterior: string }[]>`SELECT situacao_matricula_no_instante(${matriculaId}, (clock_timestamp() AT TIME ZONE 'UTC')::timestamp) AS atual, situacao_matricula_no_instante(${matriculaId}, '2025-01-01'::timestamp) AS anterior`;
  expect(situacoesSql).toEqual([{ atual: "PAUSADA", anterior: "NAO_ATIVADA" }]);
  entrar(professor);
  const realizar = async (itemReservaId: string) => registrarRealizacaoRecuperacao({ itemReservaId, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação realizada na pendência autorizada" });
  expect(await realizar(fala.id)).toMatchObject({ ok: false });
  await expect(prisma.realizacaoRecuperacao.create({ data: {
    itemReservaId: fala.id, professorId: professor, registradaPorId: professor,
    realizadaEm: await instanteAtualConferido(), evidencia: "Tentativa direta durante pausa sem autorização",
  } })).rejects.toThrow(/contratual|autorização/i);
  entrar(gestor);
  const autorizacao = await autorizarRealizacaoEspecialRecuperacao({ itemReservaId: fala.id, prazoAte: new Date(Date.now()+86400000).toISOString(), motivo: "Autorizar somente fala durante pausa", chaveIdempotencia: "fala-pausa-autorizada" });
  if (!autorizacao.ok || !autorizacao.dado) throw new Error(JSON.stringify(autorizacao));
  entrar(professor);
  const operacao = await consultarOperacaoRecuperacao({ propostaId: p.id });
  if (!operacao.ok || !operacao.dado) throw new Error(JSON.stringify(operacao));
  expect(operacao.dado).toMatchObject({ situacaoContratual: "PAUSADA", podeReservar: false });
  const itensVisiveis = operacao.dado.reservas.flatMap(r => r.itens);
  expect(itensVisiveis.find(i => i.id === fala.id)?.autorizacaoEspecialAte).toEqual(expect.any(String));
  expect(itensVisiveis.find(i => i.id === escrita.id)?.autorizacaoEspecialAte).toBeNull();
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  const revogada = await consultarOperacaoRecuperacao({ propostaId: p.id });
  if (!revogada.ok || !revogada.dado) throw new Error(JSON.stringify(revogada));
  expect(revogada.dado.reservas.flatMap(r => r.itens).find(i => i.id === fala.id)?.autorizacaoEspecialAte).toBeNull();
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: true } });
  await expect(prisma.realizacaoRecuperacao.create({ data: {
    itemReservaId: escrita.id, professorId: professor, registradaPorId: professor,
    realizadaEm: await instanteAtualConferido(), evidencia: "Tentativa de usar autorização de outra habilidade",
    autorizacaoEspecialId: autorizacao.dado.id,
  } })).rejects.toThrow(/Autorização especial/);
  expect(await realizar(escrita.id)).toMatchObject({ ok: false });
  const realizada = await realizar(fala.id);
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  expect(await prisma.realizacaoRecuperacao.findUniqueOrThrow({ where: { id: realizada.dado.id } })).toMatchObject({ autorizacaoEspecialId: autorizacao.dado.id });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
  const { autorizarReservaEspecialRecuperacao } = await import("./recuperacao-autorizacao-reserva-especial");
  const { consultarAutorizacoesReservaRecuperacao } = await import("./recuperacao-autorizacao-reserva-consulta");
  const { autorizarReservaEspecialLocal } = await import("./recuperacao-autorizacao-reserva-local");
  const autorizarReserva = { propostaId: p.id, habilidade: "FALA" as const, motivo: "Reserva específica de fala durante pausa", prazoAte: new Date(Date.now()+86400000).toISOString(), chaveIdempotencia: "reserva-especial-pausa-fala" };
  expect(await autorizarReservaEspecialRecuperacao(autorizarReserva)).toMatchObject({ ok: false });
  expect(await consultarAutorizacoesReservaRecuperacao({ propostaId: p.id })).toMatchObject({ ok: false });
  entrar(gestor);
  const especial = await autorizarReservaEspecialRecuperacao(autorizarReserva);
  if (!especial.ok || !especial.dado) throw new Error(JSON.stringify(especial));
  expect(await autorizarReservaEspecialRecuperacao(autorizarReserva)).toEqual(especial);
  expect(await autorizarReservaEspecialLocal({ propostaId: p.id, habilidade: "FALA", motivo: autorizarReserva.motivo, prazoLocal: autorizarReserva.prazoAte.slice(0, -1), fuso: "UTC", chaveIdempotencia: autorizarReserva.chaveIdempotencia })).toEqual(especial);
  const consultaReserva = await consultarAutorizacoesReservaRecuperacao({ propostaId: p.id });
  if (!consultaReserva.ok || !consultaReserva.dado) throw new Error(JSON.stringify(consultaReserva));
  expect(consultaReserva.dado).toMatchObject({ podeAutorizar: true, historico: [expect.objectContaining({ id: especial.dado.id, habilidade: "FALA", podeReservar: true, reserva: null })] });
  expect(consultaReserva.dado.historico[0]).not.toHaveProperty("snapshot");
  expect(consultaReserva.dado.historico[0].autorizador).not.toHaveProperty("papeis");
  expect(await autorizarReservaEspecialLocal({ propostaId: p.id, habilidade: "FALA", motivo: "Autorização com fuso inválido", prazoLocal: "2026-12-10T10:00", fuso: "Invalido", chaveIdempotencia: "fuso-reserva-invalido" })).toMatchObject({ ok: false });
  const base = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const], motivo: "Reservar pendência expressamente autorizada", chaveIdempotencia: "reserva-consumo-especial-fala" };
  expect(await reservarTentativaRecuperacao(base)).toMatchObject({ ok: false });
  expect(await reservarTentativaRecuperacao({ ...base, habilidades: ["ESCRITA"], autorizacaoEspecialReservaId: especial.dado.id })).toMatchObject({ ok: false });
  const reservada = await reservarTentativaRecuperacao({ ...base, autorizacaoEspecialReservaId: especial.dado.id });
  if (!reservada.ok || !reservada.dado) throw new Error(JSON.stringify(reservada));
  expect(await consultarAutorizacoesReservaRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { historico: [expect.objectContaining({ id: especial.dado.id, podeReservar: false, reserva: { id: reservada.dado.id } })] } });
  expect(await reservarTentativaRecuperacao({ ...base, autorizacaoEspecialReservaId: especial.dado.id })).toEqual(reservada);
  expect(await reservarTentativaRecuperacao({ ...base, chaveIdempotencia: "reutilizacao-especial-proibida", autorizacaoEspecialReservaId: especial.dado.id })).toMatchObject({ ok: false });
  await expect(prisma.itemReservaTentativaRecuperacao.create({ data: { reservaId: reservada.dado.id, habilidade: "ESCRITA" } })).rejects.toThrow(/habilidade/i);
  await expect(prisma.autorizacaoEspecialReservaRecuperacao.update({ where: { id: especial.dado.id }, data: { motivo: "Tentativa de alterar autorização" } })).rejects.toThrow(/imutável/i);
  const nova = await autorizarReservaEspecialRecuperacao({ ...autorizarReserva, chaveIdempotencia: "reserva-especial-limite-fala" });
  if (!nova.ok || !nova.dado) throw new Error(JSON.stringify(nova));
  expect(await reservarTentativaRecuperacao({ ...base, chaveIdempotencia: "reserva-especial-esgotada", autorizacaoEspecialReservaId: nova.dado.id })).toMatchObject({ ok: false });
});

it.each([false, true])("preserva encerramento efetivo ao realizar recuperação com autorização específica; preparar após encerramento=%s", async (prepararDepois) => {
  let fala: { id: string } | null = null;
  if (prepararDepois) await oficializarResultadoRegular("5");
  else fala = (await prepararItensDesignacao()).fala;
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato sintético Q151", url: "/api/files/q151.pdf" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL", contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: admin } });
  const condicoes = await prisma.condicoesEncerramentoMatricula.create({ data: {
    matriculaId, documentoId: documento.id, preparadorId: financeiro, decisorId: admin, status: "APROVADA", decididaEm: new Date(), motivoDecisao: "Contrato conferido independentemente", versao: 1, motivo: "Condições de encerramento do contrato",
    regras: { diaEncerramento: "EXCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Conforme contrato sintético", multa: { tipo: "SEM_PREVISAO", motivo: "Sem previsão contratual de multa" } },
  } });
  const { solicitarEncerramentoMatriculas } = await import("@/server/matricula/encerramento-solicitacao");
  const { salvarRascunhoAcertoEncerramento } = await import("@/server/matricula/encerramento-rascunho");
  const { decidirAcertoEncerramento } = await import("@/server/matricula/encerramento-decisao");
  const { efetivarAcertoEncerramento } = await import("@/server/matricula/encerramento-efetivar");
  entrar(admin);
  const pedido = await solicitarEncerramentoMatriculas({ alunoId, matriculaIds: [matriculaId], dataSolicitada: new Date().toISOString().slice(0,10), motivo: "Encerramento solicitado com pendência acadêmica", evidenciaPedido: "Solicitação institucional identificada", chaveIdempotencia: "q151-encerramento-pedido" });
  if (!pedido.ok || !pedido.dado) throw new Error(JSON.stringify(pedido));
  entrar(financeiro);
  const rascunho = await salvarRascunhoAcertoEncerramento({ alunoId, solicitacaoId: pedido.dado.solicitacaoId, contratos: [{ matriculaId, condicoesId: condicoes.id, parcelas: [], multa: { tipo: "SEM_PREVISAO" }, outrasCobrancas: [] }], chaveIdempotencia: "q151-encerramento-acerto", motivo: "Acerto sem cobranças pendentes", versaoAnterior: 0 });
  if (!rascunho.ok || !rascunho.dado) throw new Error(JSON.stringify(rascunho));
  entrar(admin);
  const decisao = await decidirAcertoEncerramento({ alunoId, rascunhoId: rascunho.dado.id, aprovar: true, motivo: "Acerto conferido por outra pessoa" });
  if (!decisao.ok || !decisao.dado) throw new Error(JSON.stringify(decisao));
  entrar(financeiro);
  const efetivacao = await efetivarAcertoEncerramento({ alunoId, decisaoId: decisao.dado.id });
  if (!efetivacao.ok) throw new Error(JSON.stringify(efetivacao));
  const encerrada = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const alocacao = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } });
  expect(encerrada.status).toBe("ENCERRADA"); expect(alocacao.ativa).toBe(false);
  expect(await prisma.$queryRaw<{ situacao: string }[]>`SELECT situacao_matricula_no_instante(${matriculaId}, (clock_timestamp() AT TIME ZONE 'UTC')::timestamp) AS situacao`).toEqual([{ situacao: "ENCERRADA" }]);
  if (prepararDepois) {
    const { autorizarPreparacaoEspecialRecuperacao } = await import("./recuperacao-autorizacao-preparacao");
    const { autorizarReservaEspecialRecuperacao } = await import("./recuperacao-autorizacao-reserva-especial");
    entrar(professor);
    expect(await proporPlanoRecuperacao(plano())).toMatchObject({ ok: false });
    entrar(gestor);
    const preparacao = await autorizarPreparacaoEspecialRecuperacao({ alocacaoId, motivo: "Preparar pendência do vínculo encerrado", prazoAte: new Date(Date.now()+86400000).toISOString(), chaveIdempotencia: "encerrada-preparar-recuperacao" });
    if (!preparacao.ok || !preparacao.dado) throw new Error(JSON.stringify(preparacao));
    entrar(professor);
    const proposta = await proporPlanoRecuperacao({ ...plano(), autorizacaoPreparacaoId: preparacao.dado.id });
    if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
    const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
    entrar(admin);
    expect(await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Revisão independente do plano após encerramento" })).toMatchObject({ ok: true });
    await disponibilizarPlano(p);
    const reservaBase = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const], motivo: "Reservar pendência do contrato encerrado", chaveIdempotencia: "encerrada-reservar-fala" };
    expect(await reservarTentativaRecuperacao(reservaBase)).toMatchObject({ ok: false });
    const autorizacaoReserva = await autorizarReservaEspecialRecuperacao({ propostaId: p.id, habilidade: "FALA", motivo: "Autorizar reserva da pendência encerrada", prazoAte: new Date(Date.now()+86400000).toISOString(), chaveIdempotencia: "encerrada-autorizacao-reserva" });
    if (!autorizacaoReserva.ok || !autorizacaoReserva.dado) throw new Error(JSON.stringify(autorizacaoReserva));
    const reserva = await reservarTentativaRecuperacao({ ...reservaBase, autorizacaoEspecialReservaId: autorizacaoReserva.dado.id });
    if (!reserva.ok || !reserva.dado) throw new Error(JSON.stringify(reserva));
    fala = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: reserva.dado.id, habilidade: "FALA" } });
  }
  if (!fala) throw new Error("A tentativa precisa ser preparada pelo caminho conferido.");
  entrar(professor);
  expect(await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Tentativa antes da autorização especial" })).toMatchObject({ ok: false });
  entrar(gestor);
  const autorizada = await autorizarRealizacaoEspecialRecuperacao({ itemReservaId: fala.id, prazoAte: new Date(Date.now()+86400000).toISOString(), motivo: "Concluir a pendência após encerramento", chaveIdempotencia: "q151-pos-encerramento" });
  if (!autorizada.ok || !autorizada.dado) throw new Error(JSON.stringify(autorizada));
  entrar(professor);
  const realizada = await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação da pendência expressamente autorizada" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  expect(await prisma.realizacaoRecuperacao.findUniqueOrThrow({ where: { id: realizada.dado.id } })).toMatchObject({ autorizacaoEspecialId: autorizada.dado.id });
  const notaEntrada = { realizacaoId: realizada.dado.id, nota: "8", comentarioAluno: "Resultado da recuperação autorizada após encerramento", submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-apos-encerramento" };
  const nota = await salvarNotaRecuperacao(notaEntrada);
  if (!nota.ok || !nota.dado) throw new Error(JSON.stringify(nota));
  expect(await salvarNotaRecuperacao(notaEntrada)).toEqual(nota);
  const n = await prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: nota.dado.id } });
  const { consultarResultadosPortalAluno } = await import("@/server/portal-aluno/resultados");
  const sessaoAluno = { sessaoId: "sessao-academica-teste", contaId: "conta-academica-teste", alunoId, email: "aluno@teste.invalid" };
  const portalAntes = await consultarResultadosPortalAluno(sessaoAluno);
  const vinculoAntes = portalAntes.matriculas.find(m => m.matriculaId === matriculaId)?.alocacoes.find(a => a.alocacaoId === alocacaoId);
  expect(vinculoAntes?.recuperacoes).not.toContainEqual(expect.objectContaining({ habilidade: "FALA", nota: "8" }));
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultado: { numerador: "5", denominador: "1" } })]) } } });
  const conferirNota = { notaId: n.id, entradaHash: n.entradaHash, aprovada: true, motivo: "Conferência independente após encerramento" };
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  expect(await decidirNotaRecuperacao(conferirNota)).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await decidirNotaRecuperacao(conferirNota)).toMatchObject({ ok: true });
  const portalDepois = await consultarResultadosPortalAluno(sessaoAluno);
  const vinculoDepois = portalDepois.matriculas.find(m => m.matriculaId === matriculaId)?.alocacoes.find(a => a.alocacaoId === alocacaoId);
  expect(vinculoDepois).toMatchObject({ situacao: "PARCIAL_NAO_FINAL", resultadoFinal: null, recuperacoes: expect.arrayContaining([{ habilidade: "FALA", nota: "8", comentarioAluno: notaEntrada.comentarioAluno }]) });
  expect(vinculoDepois?.consolidado?.habilidades).toContainEqual(expect.objectContaining({ habilidade: "FALA", resultado: { numerador: "8", denominador: "1" } }));
  expect(JSON.stringify(portalDepois)).not.toMatch(/autorizacaoEspecialId|entradaHash|chaveIdempotencia|Concluir a pendência após encerramento/);
  expect((await consultarResultadosPortalAluno({ ...sessaoAluno, alunoId: "outro-aluno-sem-vinculo" })).matriculas).toEqual([]);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultadoOriginal: { numerador: "5", denominador: "1" }, resultado: { numerador: "8", denominador: "1" } })]) } } });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toEqual(encerrada);
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } })).toEqual(alocacao);
});

async function registrarPresencaParaFechamento(chaveIdempotencia: string) {
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date("2026-01-09T10:00:00.000Z"), fim: new Date("2026-01-09T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA",
    motivo: "Aula concluída para o fechamento acadêmico que fundamenta o impacto.",
    chaveIdempotencia, entradaHash: `fixture-${chaveIdempotencia}`,
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id, turmaId, professorId: professor, ocorridaEm: encontro.inicio,
    conteudo: "Diário com presença conferida antes do fechamento acadêmico.",
    registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno de teste", presente: true, participacao: "PRESENTE" } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
}

async function confirmarFechamentoSuficienteParaImpacto(chaveIdempotencia: string) {
  entrar(gestor);
  const revisao = await revisarFechamentoAcademico({ alocacaoId });
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  expect(revisao.dado.elegibilidade).toMatchObject({ situacao: "SUFICIENTE", podeFechar: true, podeProgredir: true, pendencias: [] });
  const fechado = await confirmarFechamentoAcademico({
    alocacaoId, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Fechamento suficiente real preservado na mudança acadêmica usada pelo impacto.", chaveIdempotencia,
  });
  if (!fechado.ok || !fechado.dado) throw new Error(JSON.stringify(fechado));
  return prisma.fechamentoAcademico.findUniqueOrThrow({ where: { id: fechado.dado.id } });
}
async function aguardarInstanteRegistrado(instante: Date) {
  // Timestamp(3) do PostgreSQL pode arredondar o instante para o próximo ms.
  // O teste só informa um evento posterior quando esse instante já chegou.
  const restante = instante.getTime() - Date.now();
  if (restante > 5000) throw new Error("Relógios do teste exigem sincronização");
  if (restante >= 0) await new Promise(resolve => setTimeout(resolve, restante + 2));
}
async function instanteAtualConferido() {
  const [relogio] = await prisma.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS agora`;
  await aguardarInstanteRegistrado(relogio.agora);
  return new Date();
}

it("corrige recuperação por decisão independente, reduz resultado errado e preserva originais", async () => {
  const { fala } = await prepararItensDesignacao(["FALA"], {
    FALA: "5", COMPREENSAO_ORAL: "8", LEITURA: "8", ESCRITA: "8",
  });
  entrar(professor);
  const realizada = await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação com ata para conferência" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const lancada = await salvarNotaRecuperacao({ realizacaoId: realizada.dado.id, nota: "8", comentarioAluno: "Resultado original", submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-original-correcao" });
  if (!lancada.ok || !lancada.dado) throw new Error(JSON.stringify(lancada));
  const nota = await prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: lancada.dado.id } });
  expect((await consultarBaseCorrecaoRecuperacao(nota.id)).ok).toBe(false);
  entrar(gestor);
  expect((await decidirNotaRecuperacao({ notaId: nota.id, entradaHash: nota.entradaHash, aprovada: true, motivo: "Conferência da primeira nota" })).ok).toBe(true);
  await registrarPresencaParaFechamento("frequencia-fechamento-impacto-recuperacao");
  const fechamento = await confirmarFechamentoSuficienteParaImpacto("fechamento-impacto-recuperacao");
  entrar(professor);
  const base = await consultarBaseCorrecaoRecuperacao(nota.id);
  expect(base).toMatchObject({ ok: true, dado: { origemId: nota.id, nota: "8", versaoEsperada: 0 } });
  const d = { notaId: nota.id, origemId: nota.id, nota: "4", comentarioAluno: "Correção de erro de lançamento", motivo: "Conferência identificou nota digitada incorretamente", versaoEsperada: 0, chaveIdempotencia: "corrigir-recuperacao-1" };
  expect((await proporCorrecaoRecuperacao({ ...d, nota: "11" })).ok).toBe(false);
  expect((await proporCorrecaoRecuperacao({ ...d, nota: "8", comentarioAluno: nota.comentarioAluno })).ok).toBe(false);
  const proposta = await proporCorrecaoRecuperacao(d);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await proporCorrecaoRecuperacao(d)).toEqual(proposta);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { correcoesRecuperacao: 1 } } });
  const historico = await consultarCorrecoesRecuperacao({ notaId: nota.id });
  expect(historico).toMatchObject({ ok: true, dado: { vigente: { nota: "8" }, propostas: [expect.objectContaining({ podeRevisar: false, nota: "4" })] } });
  expect(JSON.stringify(historico)).not.toMatch(/chaveIdempotencia|entradaHash|telefone|email/);
  expect((await proporCorrecaoRecuperacao({ ...d, nota: "3" })).ok).toBe(false);
  const falaResultado = (valor: string) => ({ ok: true, dado: { resultado: { habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultado: { numerador: valor, denominador: "1" } })]) } } });
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject(falaResultado("8"));
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const revisaoPropria = await revisarCorrecaoRecuperacao(proposta.dado.id);
  expect(revisaoPropria).toMatchObject({ ok: true, dado: { podeAprovar: false } });
  entrar(gestor);
  const revisao = await revisarCorrecaoRecuperacao(proposta.dado.id);
  expect(await consultarCorrecoesRecuperacao({ notaId: nota.id })).toMatchObject({ ok: true, dado: { propostas: [expect.objectContaining({ podeRevisar: true })] } });
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  const decisao = { propostaId: proposta.dado.id, propostaHash: revisao.dado.propostaHash, impactosHash: revisao.dado.impactosHash, aprovada: true, motivo: "Conferida a evidência e os efeitos da correção" };
  entrar(professor);
  expect((await decidirCorrecaoRecuperacao(decisao)).ok).toBe(false);
  await expect(prisma.decisaoCorrecaoRecuperacao.create({ data: { propostaId: decisao.propostaId, decisorId: professor, aprovada: true, motivo: decisao.motivo, impactos: {} } })).rejects.toThrow();
  entrar(gestor);
  expect((await decidirCorrecaoRecuperacao({ ...decisao, impactosHash: "0".repeat(64) })).ok).toBe(false);
  expect(await listarRevisoesPorCorrecao({})).toMatchObject({ ok: true, dado: { itens: [] } });
  const turma = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: { modalidadeId: turma.modalidadeId, nivelId: turma.nivelId, professorId: professor, nome: "Destino após recuperação", dataInicio: new Date("2099-01-01") } });
  // Estado preexistente para validar detecção de impacto; não executa transferência neste fluxo.
  // A aprovação preserva um fechamento suficiente real, capturado antes da correção.
  const mudanca = await prisma.solicitacaoMudancaAcademica.create({ data: { alunoId, matriculaId, alocacaoOrigemId: alocacaoId, turmaOrigemId: turmaId, turmaDestinoId: destino.id,
    motivo: "Transferência já aprovada", horarioCompativel: true, snapshot: { matriculaOrigemId: matriculaId }, status: "APROVADA", solicitanteId: professor, aprovadorId: gestor, motivoDecisao: "Aprovação de teste", decididoEm: new Date(),
    fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash } });
  expect((await decidirCorrecaoRecuperacao(decisao)).ok).toBe(false);
  const atualizada = await revisarCorrecaoRecuperacao(proposta.dado.id);
  if (!atualizada.ok || !atualizada.dado) throw new Error(JSON.stringify(atualizada));
  decisao.impactosHash = atualizada.dado.impactosHash;
  const aplicada = await decidirCorrecaoRecuperacao(decisao);
  expect(aplicada).toMatchObject({ ok: true, dado: { aplicada: true } });
  if (!aplicada.ok || !aplicada.dado) throw new Error(JSON.stringify(aplicada));
  const [casoRecuperacao] = await casosRevisaoProgressao(mudanca.id);
  expect(await casosRevisaoProgressao(mudanca.id)).toHaveLength(1);
  expect(casoRecuperacao).toMatchObject({
    matriculaId, solicitacaoId: mudanca.id, alocacaoFonteId: alocacaoId,
    decisaoCorrecaoNotaId: null, decisaoCorrecaoRecuperacaoId: aplicada.dado.id,
    snapshotImpacto: { id: mudanca.id, status: "APROVADA", turmaDestinoId: destino.id },
  });
  await esperarCasoDeRevisaoImutavel(casoRecuperacao!);
  expect(await consultarCasoRevisaoProgressao({ casoId: casoRecuperacao!.id })).toMatchObject({ ok: true, dado: {
    id: casoRecuperacao!.id, situacao: "PENDENTE_REVISAO", statusNaCorrecao: "APROVADA",
    matricula: { id: matriculaId }, origem: { tipo: "RECUPERACAO", alocacaoFonteId: alocacaoId, decisaoId: aplicada.dado.id },
    solicitacao: { id: mudanca.id, status: "APROVADA" },
  } });
  entrar((await criarUsuario(["SECRETARIA_ACADEMICA"])).id);
  expect((await consultarCasoRevisaoProgressao({ casoId: casoRecuperacao!.id })).ok).toBe(false);
  entrar(gestor);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { pendenciasOperacionais: { correcoesRecuperacao: 0 } } });
  expect(await decidirCorrecaoRecuperacao(decisao)).toEqual(aplicada);
  expect(await casosRevisaoProgressao(mudanca.id)).toHaveLength(1);
  const filaRecuperacao = await listarRevisoesPorCorrecao({});
  expect(filaRecuperacao).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ tipo: "RECUPERACAO", notaRecuperacaoId: nota.id, lancamentoId: null, matricula: expect.objectContaining({ id: matriculaId }), impactos: [expect.objectContaining({ casoId: casoRecuperacao!.id, solicitacaoId: mudanca.id, statusNaCorrecao: "APROVADA", statusAtual: "APROVADA" })] })] } });
  expect(JSON.stringify(filaRecuperacao)).not.toMatch(/telefone|email|chaveIdempotencia|entradaHash/);
  expect((await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: mudanca.id } })).status).toBe("APROVADA");
  // Corrigir uma recuperação erroneamente alta devolve o melhor resultado válido original.
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject(falaResultado("5"));
  expect((await prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: nota.id } })).nota).toBe("8");
  expect(await consultarNotaRecuperacao({ realizacaoId: nota.realizacaoId })).toMatchObject({ ok: true, dado: { notas: [expect.objectContaining({ nota: "8", correcaoVigente: expect.objectContaining({ nota: "4" }) })] } });
  expect((await proporCorrecaoRecuperacao({ ...d, versaoEsperada: 1, chaveIdempotencia: "origem-superada-recuperacao" })).ok).toBe(false);
  const outra = await proporCorrecaoRecuperacao({ ...d, origemId: proposta.dado.id, nota: "7", versaoEsperada: 1, chaveIdempotencia: "correcao-recuperacao-segunda" });
  if (!outra.ok || !outra.dado) throw new Error(JSON.stringify(outra));
  const admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  entrar(admin);
  const rv = await revisarCorrecaoRecuperacao(outra.dado.id);
  if (!rv.ok || !rv.dado) throw new Error(JSON.stringify(rv));
  expect((await decidirCorrecaoRecuperacao({ propostaId: outra.dado.id, propostaHash: rv.dado.propostaHash, impactosHash: rv.dado.impactosHash, aprovada: false, motivo: "A evidência não confirma a segunda alteração" })).ok).toBe(true);
  expect(await casosRevisaoProgressao(mudanca.id)).toHaveLength(1);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject(falaResultado("5"));
  await expect(prisma.propostaCorrecaoRecuperacao.deleteMany()).rejects.toThrow();
  expect(await consultarCorrecoesRecuperacao({ notaId: nota.id, antesVersao: 2 })).toMatchObject({ ok: true, dado: { vigente: { nota: "4" }, propostas: [expect.objectContaining({ versao: 1, podeRevisar: false })] } });
  // A mesma fila inclui correções regulares e pagina o conjunto, não cada fonte separadamente.
  const regular = await prisma.versaoLancamentoAvaliacao.findFirstOrThrow({ where: { registro: { alocacaoId, codigoAvaliacao: "I1" } }, orderBy: { versao: "desc" } });
  let origemHash = regular.conteudoHash;
  for (let versao = 1; versao <= 20; versao++) {
    const c = await prisma.propostaCorrecaoNota.create({ data: { lancamentoId: regular.id, autorId: gestor, versao, notas: [{ habilidade: "FALA", nota: "5", comentarioAluno: `Conferência ${versao}` }], origemHash,
      motivo: "Correção histórica para paginação", chaveIdempotencia: `fila-mista-${versao}`, entradaHash: String(versao).padStart(64, "0") } });
    await prisma.decisaoCorrecaoNota.create({ data: { propostaId: c.id, decisorId: admin, aprovada: true, motivo: "Conferência independente da correção", impactos: atualizada.dado.impactos.mudancas } });
    origemHash = c.entradaHash;
  }
  const primeira = await listarRevisoesPorCorrecao({}), segunda = await listarRevisoesPorCorrecao({ pagina: 2 });
  expect(primeira).toMatchObject({ ok: true, dado: { temProxima: true } });
  expect(segunda).toMatchObject({ ok: true, dado: { temProxima: false } });
  if (!primeira.ok || !primeira.dado || !segunda.ok || !segunda.dado) throw new Error("Fila indisponível");
  expect(primeira.dado.itens).toHaveLength(20); expect(segunda.dado.itens).toHaveLength(1);
  expect(new Set([...primeira.dado.itens, ...segunda.dado.itens].map(i => i.id)).size).toBe(21);
  expect(primeira.dado.itens.some(i => i.tipo === "RECUPERACAO")).toBe(true);
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await listarRevisoesPorCorrecao({})).ok).toBe(false);
  expect((await consultarCorrecoesRecuperacao({ notaId: nota.id })).ok).toBe(false);
  expect((await consultarBaseCorrecaoRecuperacao(nota.id)).ok).toBe(false);
  expect((await proporCorrecaoRecuperacao(d)).ok).toBe(false);
});

it("regulariza realização histórica sem transferir autoria e conserva leitura própria após revogação", async () => {
  const { fala, escrita } = await prepararItensDesignacao();
  const substituto = (await criarUsuario(["PROFESSOR"])).id, estranho = (await criarUsuario(["PROFESSOR"])).id;
  const quando = (await instanteAtualConferido()).toISOString();
  const dados = { itemReservaId: fala.id, realizadaEm: quando, realizadaPorId: professor, motivoRegularizacao: "Regularização com evidência do professor anterior", evidencia: "Ata da avaliação aplicada antes da substituição" };
  entrar(substituto);
  expect((await registrarRealizacaoRecuperacao(dados)).ok).toBe(false);
  entrar(gestor);
  expect((await designarProfessorRecuperacao({ itemReservaId: fala.id, professorId: substituto, versaoEsperada: 0, motivo: "Regularizar avaliação já realizada", chaveIdempotencia: "designar-regularizacao" })).ok).toBe(true);
  // A situação atual do realizador não deve apagar sua autoria histórica.
  await prisma.usuario.update({ where: { id: professor }, data: { ativo: false } });
  entrar(substituto);
  const consulta = await consultarTentativaRecuperacaoDesignada(fala.id);
  expect(consulta).toMatchObject({ ok: true, dado: { professoresHistoricos: expect.arrayContaining([expect.objectContaining({ id: professor })]) } });
  expect((await registrarRealizacaoRecuperacao({ ...dados, motivoRegularizacao: undefined })).ok).toBe(false);
  expect((await registrarRealizacaoRecuperacao({ ...dados, realizadaPorId: estranho })).ok).toBe(false);
  expect((await registrarRealizacaoRecuperacao({ ...dados, itemReservaId: escrita.id })).ok).toBe(false);
  await expect(prisma.realizacaoRecuperacao.create({ data: { itemReservaId: fala.id, professorId: professor, registradaPorId: substituto, realizadaEm: new Date(quando), evidencia: dados.evidencia } })).rejects.toThrow();
  await expect(prisma.realizacaoRecuperacao.create({ data: { itemReservaId: fala.id, professorId: estranho, registradaPorId: substituto, motivoRegularizacao: dados.motivoRegularizacao, realizadaEm: new Date(quando), evidencia: dados.evidencia } })).rejects.toThrow();
  const resultado = await realizarRecuperacaoLocal({ ...dados, dataHora: dataHoraAvaliacaoLocal(new Date(quando), "UTC"), fuso: "UTC" });
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  expect(await registrarRealizacaoRecuperacao(dados)).toMatchObject({ ok: true, dado: { id: resultado.dado.id } });
  const r = await prisma.realizacaoRecuperacao.findUniqueOrThrow({ where: { id: resultado.dado.id } });
  expect(r).toMatchObject({ professorId: professor, registradaPorId: substituto, motivoRegularizacao: dados.motivoRegularizacao });
  expect((await registrarRealizacaoRecuperacao({ ...dados, evidencia: "Outra evidência não pode sobrescrever" })).ok).toBe(false);
  entrar(gestor);
  expect((await designarProfessorRecuperacao({ itemReservaId: fala.id, professorId: null, versaoEsperada: 1, motivo: "Regularização encerrada para este professor", chaveIdempotencia: "revogar-regularizacao" })).ok).toBe(true);
  entrar(substituto);
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: fala.id })] } });
  expect(await consultarNotaRecuperacao({ realizacaoId: r.id })).toMatchObject({ ok: true, dado: { podeLancar: false, motivoRegularizacao: dados.motivoRegularizacao, notas: [] } });
  expect(await listarRecuperacoesRealizadas({ alocacaoId })).toMatchObject({ ok: true, dado: { realizacoes: [expect.objectContaining({ id: r.id })] } });
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  await expect(prisma.realizacaoRecuperacao.update({ where: { id: r.id }, data: { registradaPorId: estranho } })).rejects.toThrow();
});

it("designação permite registrar nota de outro realizador sem abrir o plano ou apagar autoria", async () => {
  const { p, fala, escrita } = await prepararItensDesignacao(), substituto = (await criarUsuario(["PROFESSOR"])).id;
  entrar(professor);
  const realizada = await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação aplicada pelo professor original" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const designacao = { itemReservaId: fala.id, professorId: substituto, versaoEsperada: 0, motivo: "Professor substituto registra resultado da evidência", chaveIdempotencia: "designar-nota-recuperacao" };
  expect((await designarProfessorRecuperacao(designacao)).ok).toBe(false);
  expect((await consultarDesignacaoRecuperacao({ itemReservaId: fala.id })).ok).toBe(false);
  entrar(gestor);
  const antesDesignacao = await consultarDesignacaoRecuperacao({ itemReservaId: fala.id });
  expect(antesDesignacao).toMatchObject({ ok: true, dado: { podeAlterar: true, versaoEsperada: 0, atual: null, historico: [], professores: expect.arrayContaining([expect.objectContaining({ id: substituto })]) } });
  expect(JSON.stringify(antesDesignacao)).not.toMatch(/chaveIdempotencia|entradaHash|email|telefone|senha|password/);
  expect(await consultarDesignacaoRecuperacao({ itemReservaId: fala.id, buscaProfessor: "Nome inexistente específico" })).toMatchObject({ ok: true, dado: { professores: [], refinarBusca: false } });
  const atribuida = await designarProfessorRecuperacao(designacao); expect(atribuida.ok).toBe(true);
  expect(await designarProfessorRecuperacao(designacao)).toEqual(atribuida);
  expect(await consultarDesignacaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { versaoEsperada: 1, atual: { id: substituto, habilitado: true }, historico: [expect.objectContaining({ versao: 1 })] } });
  entrar(substituto);
  expect(await listarTentativasRecuperacaoDesignadas()).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: fala.id, habilidade: "FALA", realizada: true })] } });
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).toMatchObject({ ok: true, dado: { modo: "historico", itens: [] } });
  const detalheAtribuido = await consultarTentativaRecuperacaoDesignada(fala.id);
  expect(detalheAtribuido).toMatchObject({ ok: true, dado: { atividade: { habilidade: "FALA" }, realizacao: { id: realizada.dado.id } } });
  expect(JSON.stringify(detalheAtribuido)).not.toMatch(/ESCRITA|entradaHash|chaveIdempotencia|telefone|email|responsavelFinanceiro/);
  expect((await consultarTentativaRecuperacaoDesignada(escrita.id)).ok).toBe(false);
  expect(await consultarNotaRecuperacao({ realizacaoId: realizada.dado.id })).toMatchObject({ ok: true, dado: { podeLancar: true } });
  expect(await listarRecuperacoesRealizadas({ alocacaoId })).toMatchObject({ ok: true, dado: { realizacoes: [expect.objectContaining({ id: realizada.dado.id })] } });
  expect((await consultarConsolidadoAvaliacoes(alocacaoId)).ok).toBe(false);
  expect((await consultarOperacaoRecuperacao({ propostaId: p.id })).ok).toBe(false);
  expect((await registrarRealizacaoRecuperacao({ itemReservaId: escrita.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Tentativa fora da designação" })).ok).toBe(false);
  const nota = { realizacaoId: realizada.dado.id, nota: "8", comentarioAluno: "Registro conferido com evidência da avaliação", submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-por-substituto" };
  expect((await salvarNotaRecuperacao(nota)).ok).toBe(true);
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: fala.id, realizacaoId: realizada.dado.id })] } });
  const n = await prisma.notaRecuperacao.findFirstOrThrow();
  expect(n.autorId).toBe(substituto);
  expect((await prisma.realizacaoRecuperacao.findUniqueOrThrow({ where: { id: realizada.dado.id } })).professorId).toBe(professor);
  entrar(gestor);
  expect((await designarProfessorRecuperacao({ ...designacao, professorId: null, versaoEsperada: 1, chaveIdempotencia: "revogar-designacao-nota" })).ok).toBe(true);
  expect(await consultarDesignacaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { atual: null, versaoEsperada: 2, historico: [expect.objectContaining({ versao: 2, professor: null }), expect.objectContaining({ versao: 1 })] } });
  expect(await consultarDesignacaoRecuperacao({ itemReservaId: fala.id, antesVersao: 2 })).toMatchObject({ ok: true, dado: { versaoEsperada: 2, historico: [expect.objectContaining({ versao: 1 })] } });
  entrar(substituto);
  expect(await listarTentativasRecuperacaoDesignadas()).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ realizacaoId: realizada.dado.id })] } });
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico", depoisId: fala.id })).toMatchObject({ ok: true, dado: { itens: [] } });
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  expect(await consultarNotaRecuperacao({ realizacaoId: realizada.dado.id })).toMatchObject({ ok: true, dado: { podeLancar: false, notas: [expect.objectContaining({ autor: "Usuário Teste" })] } });
  expect((await salvarNotaRecuperacao({ ...nota, versaoEsperada: 1, chaveIdempotencia: "alterar-apos-revogacao" })).ok).toBe(false);
  entrar(gestor);
  expect((await designarProfessorRecuperacao({ ...designacao, versaoEsperada: 2, chaveIdempotencia: "redesignacao-antes-oficial" })).ok).toBe(true);
  entrar(substituto);
  await prisma.usuario.updateMany({ where: { id: { in: [professor, substituto] } }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const dec = { notaId: n.id, entradaHash: n.entradaHash, aprovada: true, motivo: "Conferência independente da nota atribuída" };
  expect((await decidirNotaRecuperacao(dec)).ok).toBe(false);
  entrar(professor); expect((await decidirNotaRecuperacao(dec)).ok).toBe(false);
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ realizacaoId: realizada.dado.id })] } });
  entrar(gestor); expect((await decidirNotaRecuperacao(dec)).ok).toBe(true);
  entrar(substituto);
  expect(await listarTentativasRecuperacaoDesignadas()).toMatchObject({ ok: true, dado: { itens: [] } });
  expect((await consultarTentativaRecuperacaoDesignada(fala.id)).ok).toBe(false);
  expect(await consultarNotaRecuperacao({ realizacaoId: realizada.dado.id })).toMatchObject({ ok: true, dado: { podeLancar: false } });
  entrar(gestor);
  expect((await designarProfessorRecuperacao({ ...designacao, versaoEsperada: 2, chaveIdempotencia: "redesignar-apos-oficial" })).ok).toBe(false);
  expect(await consultarDesignacaoRecuperacao({ itemReservaId: fala.id })).toMatchObject({ ok: true, dado: { podeAlterar: false, professores: [] } });
  await expect(prisma.designacaoRecuperacao.deleteMany()).rejects.toThrow("imutável");
});

it("designação da tentativa autoriza realização somente a partir da atribuição e revogação remove acesso", async () => {
  const { fala } = await prepararItensDesignacao(), substituto = (await criarUsuario(["PROFESSOR"])).id;
  expect((await listarTentativasRecuperacaoDesignadas()).ok).toBe(false);
  const antes = new Date();
  const d = { itemReservaId: fala.id, professorId: substituto, versaoEsperada: 0, motivo: "Substituir professor para aplicação da recuperação", chaveIdempotencia: "designacao-realizacao-recuperacao" };
  expect((await designarProfessorRecuperacao(d)).ok).toBe(true);
  entrar(substituto);
  expect(await listarTentativasRecuperacaoDesignadas()).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: fala.id, realizada: false })] } });
  expect(await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await consultarTentativaRecuperacaoDesignada(fala.id)).toMatchObject({ ok: true, dado: { realizacao: null, atividade: { habilidade: "FALA" } } });
  expect((await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: antes.toISOString(), evidencia: "Instante antes da autorização" })).ok).toBe(false);
  const r = await registrarRealizacaoRecuperacao({ itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Aplicação pelo professor designado" });
  expect(r.ok).toBe(true);
  const historicoRealizador = await listarTentativasRecuperacaoDesignadas({ modo: "historico" });
  expect(historicoRealizador).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: fala.id })] } });
  expect(JSON.stringify(historicoRealizador)).not.toMatch(/ESCRITA|telefone|email|responsavelFinanceiro|entradaHash|chaveIdempotencia/);
  expect((await prisma.realizacaoRecuperacao.findUniqueOrThrow({ where: { itemReservaId: fala.id } })).professorId).toBe(substituto);
  entrar(gestor);
  expect((await designarProfessorRecuperacao({ ...d, professorId: null, versaoEsperada: 1, chaveIdempotencia: "revogacao-realizacao-recuperacao" })).ok).toBe(true);
  entrar(substituto);
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await consultarNotaRecuperacao({ realizacaoId: r.dado.id })).toMatchObject({ ok: true, dado: { podeLancar: false } });
  await prisma.usuario.update({ where: { id: substituto }, data: { ativo: false } });
  expect((await listarTentativasRecuperacaoDesignadas()).ok).toBe(false);
  expect((await listarTentativasRecuperacaoDesignadas({ modo: "historico" })).ok).toBe(false);
  expect((await consultarNotaRecuperacao({ realizacaoId: r.dado.id })).ok).toBe(false);
});

it("opera plano aprovado com prazo e saldo por habilidade, preservando consumo após cancelamento parcial", async () => {
  await oficializarResultadoRegular("5");
  const rp = await proporPlanoRecuperacao(plano()); if (!rp.ok || !rp.dado) throw new Error(JSON.stringify(rp));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: rp.dado.id } });
  expect((await consultarOperacaoRecuperacao({ propostaId: p.id })).ok).toBe(false);
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Autorizar execução do plano" })).ok).toBe(true);
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { podeDisponibilizar: true, podeReservar: false, saldo: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", disponiveis: 2, reservadas: 0, consumidas: 0 })]) } });
  const agora = new Date(), fuso = "America/Sao_Paulo";
  const disp = { propostaId: p.id, propostaHash: p.entradaHash, dataHora: dataHoraAvaliacaoLocal(agora, fuso), fuso, condicoes: "Condições efetivamente oferecidas", evidenciaComunicacao: "Comunicação realizada pela equipe" };
  expect((await disponibilizarRecuperacaoLocal({ ...disp, fuso: "Fuso/Invalido" })).ok).toBe(false);
  expect((await disponibilizarRecuperacaoLocal(disp)).ok).toBe(true);
  expect((await prisma.disponibilizacaoPlanoRecuperacao.findUniqueOrThrow({ where: { propostaId: p.id } })).disponibilizadaEm).toEqual(agora);
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { podeDisponibilizar: false, podeReservar: true } });
  const rr = await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA", "ESCRITA"], motivo: "Reservar para execução pedagógica", chaveIdempotencia: "reserva-consulta-operacao" });
  if (!rr.ok || !rr.dado) throw new Error(JSON.stringify(rr));
  const item = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: rr.dado.id, habilidade: "FALA" } });
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { saldo: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", disponiveis: 1, reservadas: 1, consumidas: 0 })]) } });
  entrar(professor);
  const consulta = await consultarOperacaoRecuperacao({ propostaId: p.id });
  expect(consulta).toMatchObject({ ok: true, dado: { propostaHash: null, podeDisponibilizar: false, podeReservar: false, reservas: [expect.objectContaining({ podeCancelarPelaEscola: false, itens: expect.arrayContaining([expect.objectContaining({ id: item.id, podeRegistrarRealizacao: true })]) })] } });
  expect(JSON.stringify(consulta)).not.toMatch(/chaveIdempotencia|entradaHash|responsavelFinanceiro|telefone|email/);
  expect((await realizarRecuperacaoLocal({ itemReservaId: item.id, dataHora: dataHoraAvaliacaoLocal(new Date(), fuso), fuso, evidencia: "Avaliação oral concluída no horário informado" })).ok).toBe(true);
  entrar(gestor);
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: rr.dado.id, motivo: "Escola cancela somente o que não realizou", evidencia: "Cancelamento institucional documentado" })).ok).toBe(true);
  expect(await consultarOperacaoRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { saldo: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", consumidas: 1, reservadas: 0, disponiveis: 1 }), expect.objectContaining({ habilidade: "ESCRITA", consumidas: 0, reservadas: 0, disponiveis: 2 })]), reservas: [expect.objectContaining({ podeCancelarPelaEscola: false })] } });
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await consultarOperacaoRecuperacao({ propostaId: p.id })).ok).toBe(false);
});

it("consulta planos com notas de origem, revisão independente e bloqueio de versão antiga", async () => {
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { podePropor: false, planos: [] } });
  await oficializarResultadoRegular("5");
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { podePropor: true, obrigatorias: expect.arrayContaining([...HABILIDADES]), versaoEsperada: 0 } });
  expect((await proporPlanoRecuperacao(plano())).ok).toBe(true);
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const propria = await consultarPlanosRecuperacao({ alocacaoId });
  expect(propria).toMatchObject({ ok: true, dado: { planos: [expect.objectContaining({ podeDecidir: false, propostaHash: null, fontesMudaram: false })] } });
  expect(JSON.stringify(propria)).not.toMatch(/chaveIdempotencia|responsavelFinanceiro|telefone|email/);
  entrar(gestor);
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { planos: [expect.objectContaining({ podeAprovar: true, base: expect.objectContaining({ geral: { numerador: "5", denominador: "1" } }) })] } });
  entrar(professor);
  expect((await proporPlanoRecuperacao({ ...plano(), versaoEsperada: 1, chaveIdempotencia: "plano-revisado-na-consulta" })).ok).toBe(true);
  entrar(gestor);
  const revisao = await consultarPlanosRecuperacao({ alocacaoId });
  expect(revisao).toMatchObject({ ok: true, dado: { versaoEsperada: 2, planos: [expect.objectContaining({ versao: 2, podeAprovar: true }), expect.objectContaining({ versao: 1, podeAprovar: false, podeDecidir: true })] } });
  expect(await consultarPlanosRecuperacao({ alocacaoId, antesVersao: 2 })).toMatchObject({ ok: true, dado: { planos: [expect.objectContaining({ versao: 1 })] } });
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  const p = revisao.dado.planos[0];
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.propostaHash!, aprovada: true, motivo: "Revisão do plano exibido na consulta" })).ok).toBe(true);
  expect(await consultarPlanosRecuperacao({ alocacaoId })).toMatchObject({ ok: true, dado: { planos: [expect.objectContaining({ podeDecidir: false, propostaHash: null, decisao: expect.objectContaining({ aprovada: true }) }), expect.anything()] } });
  const estranho = (await criarUsuario(["PROFESSOR"])).id; entrar(estranho);
  expect((await consultarPlanosRecuperacao({ alocacaoId })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } }); entrar(gestor);
  expect((await consultarPlanosRecuperacao({ alocacaoId })).ok).toBe(false);
});

it("oficializa recuperação sem apagar a origem, inclusive após cancelamento parcial da reserva", async () => {
  await oficializarResultadoRegular("5");
  const proposta = await proporPlanoRecuperacao(plano()); if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano para avaliar notas" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const reserva = await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA", "ESCRITA"], motivo: "Recuperação por habilidades", chaveIdempotencia: "notas-reserva-recuperacao" });
  if (!reserva.ok || !reserva.dado) throw new Error(JSON.stringify(reserva));
  const item = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: reserva.dado.id, habilidade: "FALA" } });
  entrar(professor);
  const realizada = await registrarRealizacaoRecuperacao({ itemReservaId: item.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação realizada de fala" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  entrar(gestor);
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: reserva.dado.id, motivo: "Cancelamento apenas da escrita pendente", evidencia: "Ausência de oferta pela escola" })).ok).toBe(true);
  const segundaReserva = await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Nova oportunidade dentro da cota", chaveIdempotencia: "segunda-nota-reserva-recuperacao" });
  if (!segundaReserva.ok || !segundaReserva.dado) throw new Error(JSON.stringify(segundaReserva));
  const segundoItem = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: segundaReserva.dado.id } });
  entrar(professor);
  const segundaRealizada = await registrarRealizacaoRecuperacao({ itemReservaId: segundoItem.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Segunda avaliação oral realizada" });
  if (!segundaRealizada.ok || !segundaRealizada.dado) throw new Error(JSON.stringify(segundaRealizada));
  entrar(gestor);
  const d = { realizacaoId: realizada.dado.id, nota: null as string | null, comentarioAluno: "Evolução na habilidade de fala", submetida: false, versaoEsperada: 0, chaveIdempotencia: "rascunho-nota-recuperacao" };
  expect((await salvarNotaRecuperacao(d)).ok).toBe(false);
  expect(await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId })).toMatchObject({ ok: true, dado: { podeLancar: false, versaoEsperada: 0, notas: [], identificacao: { matriculaId } } });
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await salvarNotaRecuperacao(d)).ok).toBe(false);
  expect((await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId })).ok).toBe(false);
  expect((await listarRecuperacoesRealizadas({ alocacaoId })).ok).toBe(false);
  entrar(professor);
  expect(await listarRecuperacoesRealizadas({ alocacaoId })).toMatchObject({ ok: true, dado: { realizacoes: expect.arrayContaining([expect.objectContaining({ id: d.realizacaoId, estado: "Sem nota" })]) } });
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: {
    resultado: { recuperacoesPendentes: true, geral: { numerador: "5", denominador: "1" }, habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", memoriaRecuperacao: [expect.objectContaining({ nota: null, pendencia: "NOTA_AUSENTE" }), expect.objectContaining({ nota: null, pendencia: "NOTA_AUSENTE" })] })]) },
    fontesRecuperacao: expect.arrayContaining([expect.objectContaining({ realizacaoId: d.realizacaoId, notaId: null, entradaHash: null, decisaoId: null })]),
  } });
  expect(await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId })).toMatchObject({ ok: true, dado: { podeLancar: true } });
  expect((await salvarNotaRecuperacao({ ...d, nota: "11" })).ok).toBe(false);
  await expect(prisma.notaRecuperacao.create({ data: { realizacaoId: d.realizacaoId, autorId: professor, versao: 1, nota: "11", comentarioAluno: "Nota fora da escala", submetida: true, chaveIdempotencia: "nota-sql-invalida", entradaHash: "0".repeat(64) } })).rejects.toThrow("Nota fora da escala");
  expect((await salvarNotaRecuperacao({ ...d, submetida: true })).ok).toBe(false);
  const rascunho = await salvarNotaRecuperacao(d); expect(rascunho.ok).toBe(true);
  expect(await salvarNotaRecuperacao(d)).toEqual(rascunho);
  const n1 = await prisma.notaRecuperacao.findFirstOrThrow();
  entrar(gestor);
  expect((await decidirNotaRecuperacao({ notaId: n1.id, entradaHash: n1.entradaHash, aprovada: true, motivo: "Não pode oficializar rascunho" })).ok).toBe(false);
  entrar(professor);
  const sub = { ...d, nota: "8", submetida: true, versaoEsperada: 1, chaveIdempotencia: "submeter-nota-recuperacao" };
  expect((await salvarNotaRecuperacao(sub)).ok).toBe(true);
  const n = await prisma.notaRecuperacao.findFirstOrThrow({ orderBy: { versao: "desc" } });
  const consultaDocente = await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId });
  expect(consultaDocente).toMatchObject({ ok: true, dado: { notas: [expect.objectContaining({ podeDecidir: false, entradaHash: null }), expect.anything()] } });
  expect(JSON.stringify(consultaDocente)).not.toMatch(/chaveIdempotencia|responsavelFinanceiro|telefone|email/);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { geral: { numerador: "5", denominador: "1" }, recuperacoesPendentes: true } } });
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const decisaoNota = { notaId: n.id, entradaHash: n.entradaHash, aprovada: true, motivo: "Conferência independente da recuperação" };
  expect((await decidirNotaRecuperacao(decisaoNota)).ok).toBe(false);
  await expect(prisma.decisaoNotaRecuperacao.create({ data: { notaId: n.id, decisorId: professor, aprovada: true, motivo: "Autoaprovação indevida" } })).rejects.toThrow("Outra pessoa");
  entrar(gestor);
  expect(await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId })).toMatchObject({ ok: true, dado: { podeLancar: false, notas: [expect.objectContaining({ podeAprovar: true, entradaHash: n.entradaHash }), expect.anything()] } });
  expect((await decidirNotaRecuperacao({ ...decisaoNota, entradaHash: "0".repeat(64) })).ok).toBe(false);
  const oficial = await decidirNotaRecuperacao(decisaoNota); expect(oficial.ok).toBe(true);
  expect(await decidirNotaRecuperacao(decisaoNota)).toEqual(oficial);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { recuperacoesPendentes: true, geral: { numerador: "23", denominador: "4" }, habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultadoOriginal: { numerador: "5", denominador: "1" }, resultado: { numerador: "8", denominador: "1" } })]) } } });
  entrar(professor);
  expect((await salvarNotaRecuperacao({ ...sub, versaoEsperada: 2, chaveIdempotencia: "alterar-recuperacao-oficial" })).ok).toBe(false);
  await expect(prisma.notaRecuperacao.update({ where: { id: n.id }, data: { nota: "10" } })).rejects.toThrow("imutáveis");
  expect(await prisma.notaRecuperacao.count()).toBe(2);
  expect(await prisma.decisaoNotaRecuperacao.count()).toBe(1);
  const inferior = { ...sub, realizacaoId: segundaRealizada.dado.id, nota: "4", versaoEsperada: 0, chaveIdempotencia: "segunda-recuperacao-nota-inferior" };
  expect((await salvarNotaRecuperacao(inferior)).ok).toBe(true);
  const inferiorNota = await prisma.notaRecuperacao.findFirstOrThrow({ where: { realizacaoId: segundaRealizada.dado.id } });
  entrar(gestor);
  expect((await decidirNotaRecuperacao({ notaId: inferiorNota.id, entradaHash: inferiorNota.entradaHash, aprovada: true, motivo: "Nota inferior também fica no histórico" })).ok).toBe(true);
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { recuperacoesPendentes: false, geral: { numerador: "23", denominador: "4" }, habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultado: { numerador: "8", denominador: "1" }, memoriaRecuperacao: [expect.objectContaining({ nota: "8", melhorou: true }), expect.objectContaining({ nota: "4", melhorou: false })] })]) } } });
  expect(await prisma.realizacaoRecuperacao.count()).toBe(2);
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR"] } });
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  await prisma.vinculoDocente.updateMany({ where: { turmaId, fim: null }, data: { fim: new Date() } });
  await prisma.turma.update({ where: { id: turmaId }, data: { professorId: substituto } });
  entrar(professor);
  expect(await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId })).toMatchObject({ ok: true, dado: { podeLancar: false, oficial: true, notas: [expect.objectContaining({ podeDecidir: false }), expect.anything()] } });
  expect(await listarRecuperacoesRealizadas({ alocacaoId })).toMatchObject({ ok: true, dado: { realizacoes: expect.arrayContaining([expect.objectContaining({ id: d.realizacaoId, estado: "Oficializada" })]) } });
  await prisma.usuario.update({ where: { id: professor }, data: { ativo: false } });
  expect((await consultarNotaRecuperacao({ realizacaoId: d.realizacaoId })).ok).toBe(false);
  expect((await listarRecuperacoesRealizadas({ alocacaoId })).ok).toBe(false);
});

it("realização consome apenas a habilidade aplicada e cancelamento libera somente as pendentes", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano para registrar realização" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const reserva = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const, "ESCRITA" as const], motivo: "Avaliar habilidades em momentos distintos", chaveIdempotencia: "reserva-realizacao-habilidades" };
  const reservada = await reservarTentativaRecuperacao(reserva); if (!reservada.ok || !reservada.dado) throw new Error(JSON.stringify(reservada));
  const itens = await prisma.itemReservaTentativaRecuperacao.findMany({ where: { reservaId: reservada.dado.id } });
  const fala = itens.find(i => i.habilidade === "FALA")!, escrita = itens.find(i => i.habilidade === "ESCRITA")!;
  const d = { itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação oral aplicada pelo professor" };
  expect((await registrarRealizacaoRecuperacao(d)).ok).toBe(false);
  entrar(professor);
  expect((await registrarRealizacaoRecuperacao({ ...d, realizadaEm: data })).ok).toBe(false);
  expect((await registrarRealizacaoRecuperacao({ ...d, realizadaEm: new Date(Date.now() + 60000).toISOString() })).ok).toBe(false);
  const realizada = await registrarRealizacaoRecuperacao(d); expect(realizada.ok).toBe(true);
  expect(await registrarRealizacaoRecuperacao(d)).toEqual(realizada);
  expect((await registrarRealizacaoRecuperacao({ ...d, evidencia: "Outra evidência na mesma realização" })).ok).toBe(false);
  expect(await prisma.realizacaoRecuperacao.count()).toBe(1);
  entrar(gestor);
  expect((await cancelarReservaRecuperacaoPelaEscola({ reservaId: reservada.dado.id, motivo: "Escola cancela apenas a avaliação ainda pendente", evidencia: "Ocorrência institucional registrada" })).ok).toBe(true);
  expect((await reservarTentativaRecuperacao({ ...reserva, chaveIdempotencia: "reserva-apos-realizacao-parcial" })).ok).toBe(true);
  expect((await reservarTentativaRecuperacao({ ...reserva, habilidades: ["FALA"], chaveIdempotencia: "fala-ja-consumida-e-reservada" })).ok).toBe(false);
  expect((await reservarTentativaRecuperacao({ ...reserva, habilidades: ["ESCRITA"], chaveIdempotencia: "escrita-liberada-disponivel" })).ok).toBe(true);
  entrar(professor);
  expect((await registrarRealizacaoRecuperacao({ ...d, itemReservaId: escrita.id, realizadaEm: (await instanteAtualConferido()).toISOString() })).ok).toBe(false);
  const consolidado = await consultarConsolidadoAvaliacoes(alocacaoId);
  expect(consolidado.ok && consolidado.dado?.resultado.atendeRequisitosNotas).toBe(false);
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "RecuperacaoRealizada" } })).toBe(1);
  await expect(prisma.realizacaoRecuperacao.deleteMany()).rejects.toThrow("imutável");
});

it("escola não libera tentativa inteiramente realizada", async () => {
  await oficializarResultadoRegular("6");
  const r = await proporPlanoRecuperacao({ ...plano(), atividades: [atividadeRecuperacao("FALA")] }); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Aprovar recuperação de fala" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const reserva = await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Reservar fala para avaliação", chaveIdempotencia: "reserva-consumo-definitivo" }); if (!reserva.ok || !reserva.dado) throw new Error(JSON.stringify(reserva));
  const item = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: reserva.dado.id } });
  entrar(professor);
  expect((await registrarRealizacaoRecuperacao({ itemReservaId: item.id, realizadaEm: (await instanteAtualConferido()).toISOString(), evidencia: "Avaliação realizada e registrada" })).ok).toBe(true);
  entrar(gestor);
  const c = { reservaId: reserva.dado.id, motivo: "Tentativa de liberar realização já ocorrida", evidencia: "Registro de teste da tentativa de cancelamento" };
  expect((await cancelarReservaRecuperacaoPelaEscola(c)).ok).toBe(false);
  await expect(prisma.cancelamentoReservaRecuperacao.create({ data: { ...c, autorId: gestor } })).rejects.toThrow("Reserva sem habilidades");
});

it("prorrogação independente preserva prazo original e libera reservas no prazo estendido", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano para testar prorrogação" })).ok).toBe(true);
  expect((await consultarProrrogacoesRecuperacao({ propostaId: p.id })).ok).toBe(false);
  await disponibilizarPlano(p);
  const disp = await prisma.disponibilizacaoPlanoRecuperacao.findUniqueOrThrow({ where: { propostaId: p.id } });
  const novoPrazo = new Date(disp.prazoAte.getTime() + 3600000).toISOString();
  entrar(professor);
  const d = { disponibilizacaoId: disp.id, prazoAnterior: disp.prazoAte.toISOString(), novoPrazo, versaoEsperada: 0, motivo: "Conceder tempo adicional justificado", chaveIdempotencia: "prorrogacao-recuperacao-teste" };
  expect(await consultarProrrogacoesRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { podePropor: true, versaoEsperada: 0, prazoVigente: d.prazoAnterior, propostas: [] } });
  const local = { disponibilizacaoId: d.disponibilizacaoId, prazoAnterior: d.prazoAnterior, versaoEsperada: 0, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, dataHora: dataHoraAvaliacaoLocal(new Date(novoPrazo), "America/Costa_Rica"), fuso: "America/Costa_Rica" };
  const proposta = await proporProrrogacaoRecuperacaoLocal(local); if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await proporProrrogacaoRecuperacao(d)).toEqual(proposta);
  const pr = await prisma.propostaProrrogacaoRecuperacao.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const decisaoPrazo = { propostaId: pr.id, propostaHash: pr.entradaHash, aprovada: true, motivo: "Justificativa de prazo conferida" };
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const consultaPropria = await consultarProrrogacoesRecuperacao({ propostaId: p.id });
  expect(consultaPropria).toMatchObject({ ok: true, dado: { propostas: [expect.objectContaining({ podeDecidir: false, propostaHash: null, novoPrazo })] } });
  expect(JSON.stringify(consultaPropria)).not.toMatch(/chaveIdempotencia|entradaHash|responsavelFinanceiro|telefone|email/);
  expect((await decidirProrrogacaoRecuperacao(decisaoPrazo)).ok).toBe(false);
  await expect(prisma.decisaoProrrogacaoRecuperacao.create({ data: { propostaId: pr.id, decisorId: professor, aprovada: true, motivo: decisaoPrazo.motivo } })).rejects.toThrow("Outra pessoa");
  entrar(gestor);
  expect(await consultarProrrogacoesRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { propostas: [expect.objectContaining({ podeAprovar: true, propostaHash: pr.entradaHash })] } });
  const aprovada = await decidirProrrogacaoRecuperacao(decisaoPrazo); expect(aprovada.ok).toBe(true);
  expect(await decidirProrrogacaoRecuperacao(decisaoPrazo)).toEqual(aprovada);
  expect(await consultarProrrogacoesRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { prazoOriginal: disp.prazoAte.toISOString(), prazoVigente: novoPrazo, propostas: [expect.objectContaining({ podeDecidir: false, propostaHash: null })] } });
  expect(await prisma.$transaction(tx => prazoRecuperacaoVigente(tx, disp.id))).toEqual(new Date(novoPrazo));
  const sql = await prisma.$queryRaw<{ prazo: Date }[]>`SELECT prazo_recuperacao_vigente(${disp.id}) as prazo`;
  expect(sql[0].prazo).toEqual(new Date(novoPrazo));
  expect((await prisma.disponibilizacaoPlanoRecuperacao.findUniqueOrThrow({ where: { id: disp.id } })).prazoAte).toEqual(disp.prazoAte);
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(disp.prazoAte.getTime() + 1));
    expect((await reservarTentativaRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA"], motivo: "Reserva dentro da extensão aprovada", chaveIdempotencia: "reserva-prazo-prorrogado" })).ok).toBe(true);
  } finally { vi.useRealTimers(); }
  await expect(prisma.propostaProrrogacaoRecuperacao.deleteMany()).rejects.toThrow("imutável");
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await consultarProrrogacoesRecuperacao({ propostaId: p.id })).ok).toBe(false);
});

it("prorrogação superada não é aprovada e rejeição mantém o prazo vigente", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano para testar revisão de prazo" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const disp = await prisma.disponibilizacaoPlanoRecuperacao.findUniqueOrThrow({ where: { propostaId: p.id } });
  entrar(professor);
  const d = { disponibilizacaoId: disp.id, prazoAnterior: disp.prazoAte.toISOString(), novoPrazo: new Date(disp.prazoAte.getTime() + 3600000).toISOString(), versaoEsperada: 0, motivo: "Solicitação de extensão de prazo", chaveIdempotencia: "prorrogacao-versao-1" };
  expect((await proporProrrogacaoRecuperacao({ ...d, novoPrazo: d.prazoAnterior })).ok).toBe(false);
  expect((await proporProrrogacaoRecuperacao(d)).ok).toBe(true);
  expect((await proporProrrogacaoRecuperacao({ ...d, versaoEsperada: 1, chaveIdempotencia: "prorrogacao-versao-2" })).ok).toBe(true);
  const [p1, p2] = await prisma.propostaProrrogacaoRecuperacao.findMany({ orderBy: { versao: "asc" } });
  entrar(gestor);
  expect(await consultarProrrogacoesRecuperacao({ propostaId: p.id })).toMatchObject({ ok: true, dado: { propostas: [expect.objectContaining({ versao: 2, podeAprovar: true }), expect.objectContaining({ versao: 1, podeAprovar: false })] } });
  expect(await consultarProrrogacoesRecuperacao({ propostaId: p.id, antesVersao: 2 })).toMatchObject({ ok: true, dado: { propostas: [expect.objectContaining({ versao: 1, podeAprovar: false })] } });
  expect((await decidirProrrogacaoRecuperacao({ propostaId: p1.id, propostaHash: p1.entradaHash, aprovada: true, motivo: "Revisão da proposta anterior" })).ok).toBe(false);
  expect((await decidirProrrogacaoRecuperacao({ propostaId: p2.id, propostaHash: p2.entradaHash, aprovada: false, motivo: "Justificativa insuficiente para extensão" })).ok).toBe(true);
  expect(await prisma.$transaction(tx => prazoRecuperacaoVigente(tx, disp.id))).toEqual(disp.prazoAte);
});

it("prazo de recuperação nasce da disponibilização comprovada e não reinicia por edição", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  const reserva = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const], motivo: "Reserva depende de disponibilização", chaveIdempotencia: "reserva-disponibilizacao-teste" };
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano aprovado para disponibilizar" })).ok).toBe(true);
  expect((await reservarTentativaRecuperacao(reserva)).ok).toBe(false);
  const d = { propostaId: p.id, propostaHash: p.entradaHash, disponibilizadaEm: (await instanteAtualConferido()).toISOString(), condicoes: "Material e aplicação disponíveis ao aluno", evidenciaComunicacao: "Orientação ao aluno registrada na secretaria" };
  expect((await registrarDisponibilizacaoRecuperacao({ ...d, disponibilizadaEm: data })).ok).toBe(false);
  expect((await registrarDisponibilizacaoRecuperacao({ ...d, disponibilizadaEm: new Date(Date.now() + 60000).toISOString() })).ok).toBe(false);
  const disponibilizada = await registrarDisponibilizacaoRecuperacao(d);
  if (!disponibilizada.ok || !disponibilizada.dado) throw new Error(JSON.stringify(disponibilizada));
  expect(new Date(disponibilizada.dado.prazoAte).getTime() - new Date(d.disponibilizadaEm).getTime()).toBe(1000 * 60000);
  expect(await registrarDisponibilizacaoRecuperacao(d)).toEqual(disponibilizada);
  expect((await registrarDisponibilizacaoRecuperacao({ ...d, condicoes: "Tentativa de alterar condições registradas" })).ok).toBe(false);
  expect((await reservarTentativaRecuperacao(reserva)).ok).toBe(true);
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(disponibilizada.dado.prazoAte));
    expect((await reservarTentativaRecuperacao({ ...reserva, chaveIdempotencia: "reserva-no-limite-do-prazo" })).ok).toBe(false);
  } finally { vi.useRealTimers(); }
  expect(await prisma.itemReservaTentativaRecuperacao.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "PlanoRecuperacaoDisponibilizado", agregadoId: matriculaId } })).toBe(1);
  await expect(prisma.disponibilizacaoPlanoRecuperacao.deleteMany()).rejects.toThrow("imutável");
});

it("cancelamento pela escola libera habilidades uma vez e preserva reservas originais", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano de recuperação conferido" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const d = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const, "ESCRITA" as const], motivo: "Reserva para avaliar duas habilidades", chaveIdempotencia: "reserva-cancelamento-escola-1" };
  const primeira = await reservarTentativaRecuperacao(d); if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  expect((await reservarTentativaRecuperacao({ ...d, chaveIdempotencia: "reserva-cancelamento-escola-2" })).ok).toBe(true);
  expect((await reservarTentativaRecuperacao({ ...d, chaveIdempotencia: "reserva-cancelamento-escola-3" })).ok).toBe(false);
  const c = { reservaId: primeira.dado.id, motivo: "Escola não poderá oferecer esta tentativa", evidencia: "Ocorrência institucional conferida pela gestão" };
  entrar(professor);
  expect((await cancelarReservaRecuperacaoPelaEscola(c)).ok).toBe(false);
  entrar(gestor);
  const cancelada = await cancelarReservaRecuperacaoPelaEscola(c); expect(cancelada.ok).toBe(true);
  expect(await cancelarReservaRecuperacaoPelaEscola(c)).toEqual(cancelada);
  expect((await cancelarReservaRecuperacaoPelaEscola({ ...c, motivo: "Outro motivo para o mesmo cancelamento" })).ok).toBe(false);
  expect(await prisma.itemReservaTentativaRecuperacao.count({ where: { reservaId: primeira.dado.id } })).toBe(2);
  expect(await reservarTentativaRecuperacao(d)).toEqual(primeira);
  expect((await reservarTentativaRecuperacao({ ...d, chaveIdempotencia: "reserva-cancelamento-escola-3" })).ok).toBe(true);
  expect((await reservarTentativaRecuperacao({ ...d, chaveIdempotencia: "reserva-cancelamento-escola-4" })).ok).toBe(false);
  expect(await prisma.itemReservaTentativaRecuperacao.count({ where: { reserva: { cancelamento: null } } })).toBe(4);
  expect(await prisma.evento.count({ where: { tipo: "TentativaRecuperacaoCanceladaPelaEscola", agregadoId: matriculaId } })).toBe(1);
  await expect(prisma.cancelamentoReservaRecuperacao.deleteMany()).rejects.toThrow("imutável");
  await expect(prisma.itemReservaTentativaRecuperacao.create({ data: { reservaId: primeira.dado.id, habilidade: "COMPREENSAO_ORAL" } })).rejects.toThrow("cancelada");
});

it("reserva de recuperação exige plano aprovado e habilidades previstas", async () => {
  await oficializarResultadoRegular("6");
  const r = await proporPlanoRecuperacao({ ...plano(), atividades: [atividadeRecuperacao("FALA")] }); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  const d = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const], motivo: "Reservar avaliação de recuperação", chaveIdempotencia: "reserva-recuperacao-permissao" };
  expect((await reservarTentativaRecuperacao(d)).ok).toBe(false);
  entrar(gestor);
  expect((await reservarTentativaRecuperacao(d)).ok).toBe(false);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano de fala conferido" })).ok).toBe(true);
  await disponibilizarPlano(p);
  expect((await reservarTentativaRecuperacao({ ...d, habilidades: ["ESCRITA"] })).ok).toBe(false);
  const reserva = await reservarTentativaRecuperacao(d); expect(reserva.ok).toBe(true);
  expect(await reservarTentativaRecuperacao(d)).toEqual(reserva);
  expect((await reservarTentativaRecuperacao({ ...d, motivo: "Outra justificativa na mesma chave" })).ok).toBe(false);
  expect(await prisma.reservaTentativaRecuperacao.count()).toBe(1);
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "TentativaRecuperacaoReservada" } })).toBe(1);
  await expect(prisma.reservaTentativaRecuperacao.deleteMany()).rejects.toThrow("imutável");
});

it("reservas concorrentes não excedem limite por habilidade e nova versão do plano não reinicia saldo", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano de recuperação conferido" })).ok).toBe(true);
  await disponibilizarPlano(p);
  const d = { propostaId: p.id, propostaHash: p.entradaHash, habilidades: ["FALA" as const], motivo: "Reservar oportunidade de fala", chaveIdempotencia: "reserva-inicial-fala" };
  expect((await reservarTentativaRecuperacao(d)).ok).toBe(true);
  const resultados = await Promise.allSettled(["concorrente-1", "concorrente-2"].map(chaveIdempotencia => prisma.$transaction(tx => reservarTentativaRecuperacaoTx(tx, gestor, { ...d, chaveIdempotencia }))));
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
  expect(await prisma.itemReservaTentativaRecuperacao.count({ where: { habilidade: "FALA" } })).toBe(2);
  entrar(professor);
  const r2 = await proporPlanoRecuperacao({ ...plano(), versaoEsperada: 1, chaveIdempotencia: "novo-plano-mesmo-limite" }); if (!r2.ok || !r2.dado) throw new Error(JSON.stringify(r2));
  const p2 = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r2.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: p2.id, propostaHash: p2.entradaHash, aprovada: true, motivo: "Nova versão sem reiniciar tentativas" })).ok).toBe(true);
  await disponibilizarPlano(p2);
  const proxima = { ...d, propostaId: p2.id, propostaHash: p2.entradaHash, chaveIdempotencia: "reserva-plano-novo" };
  expect((await reservarTentativaRecuperacao(proxima)).ok).toBe(false);
  expect((await reservarTentativaRecuperacao({ ...proxima, habilidades: ["ESCRITA"] })).ok).toBe(true);
  const direta = await prisma.reservaTentativaRecuperacao.create({ data: { propostaId: p2.id, autorId: gestor, motivo: d.motivo, chaveIdempotencia: "reserva-direta-teste", entradaHash: "teste" } });
  await expect(prisma.itemReservaTentativaRecuperacao.create({ data: { reservaId: direta.id, habilidade: "FALA" } })).rejects.toThrow("esgotado");
});

it("plano exige decisão independente, preserva aprovação e repete decisão sem duplicar", async () => {
  await oficializarResultadoRegular("5");
  const r = await proporPlanoRecuperacao(plano()); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  const d = { propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Plano pedagógico conferido pela gestão" };
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  expect((await decidirPlanoRecuperacao(d)).ok).toBe(false);
  await expect(prisma.decisaoPlanoRecuperacao.create({ data: { propostaId: p.id, decisorId: professor, aprovada: true, motivo: d.motivo } })).rejects.toThrow("outra pessoa");
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ ...d, propostaHash: "0".repeat(64) })).ok).toBe(false);
  const aprovada = await decidirPlanoRecuperacao(d); expect(aprovada.ok).toBe(true);
  expect(await decidirPlanoRecuperacao(d)).toEqual(aprovada);
  expect((await decidirPlanoRecuperacao({ ...d, aprovada: false })).ok).toBe(false);
  expect(await prisma.decisaoPlanoRecuperacao.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "PlanoRecuperacaoAprovado", agregadoId: matriculaId } })).toBe(1);
  await expect(prisma.decisaoPlanoRecuperacao.deleteMany()).rejects.toThrow("imutável");
});

it("proposta substituída ou notas corrigidas exigem nova conferência antes de aprovar recuperação", async () => {
  await oficializarResultadoRegular("5");
  const p1 = await proporPlanoRecuperacao(plano()); if (!p1.ok || !p1.dado) throw new Error(JSON.stringify(p1));
  const p2 = await proporPlanoRecuperacao({ ...plano(), versaoEsperada: 1, chaveIdempotencia: "plano-revisao-nova-versao" }); if (!p2.ok || !p2.dado) throw new Error(JSON.stringify(p2));
  const antigo = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: p1.dado.id } });
  const atual = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: p2.dado.id } });
  entrar(gestor);
  expect((await decidirPlanoRecuperacao({ propostaId: antigo.id, propostaHash: antigo.entradaHash, aprovada: true, motivo: "Conferência de versão antiga" })).ok).toBe(false);
  entrar(professor);
  const nota = await prisma.versaoLancamentoAvaliacao.findFirstOrThrow({ where: { registro: { alocacaoId, codigoAvaliacao: "I1" } } });
  const c = await proporCorrecaoNota({ lancamentoId: nota.id, origemHash: nota.conteudoHash, versaoEsperada: 0, chaveIdempotencia: "correcao-muda-base-plano", motivo: "Corrigir a nota usada no plano", notas: [{ habilidade: "FALA", nota: "4", comentarioAluno: "Nota corrigida" }] });
  if (!c.ok || !c.dado) throw new Error(JSON.stringify(c));
  entrar(gestor);
  const revisao = await revisarCorrecaoNota(c.dado.id); if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  expect((await decidirCorrecaoNota({ propostaId: c.dado.id, propostaHash: revisao.dado.propostaHash, impactosHash: revisao.dado.impactosHash, aprovada: true, motivo: "Correção de nota conferida" })).ok).toBe(true);
  const d = { propostaId: atual.id, propostaHash: atual.entradaHash, aprovada: true, motivo: "Revisão do plano após correção" };
  expect(await decidirPlanoRecuperacao(d)).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
  expect((await decidirPlanoRecuperacao({ ...d, aprovada: false })).ok).toBe(true);
});

it("plano de recuperação preserva notas oficiais e exige cobertura das habilidades insuficientes", async () => {
  await oficializarResultadoRegular("5");
  expect((await proporPlanoRecuperacao({ ...plano(), atividades: [atividadeRecuperacao("FALA")] })).ok).toBe(false);
  const r = await proporPlanoRecuperacao(plano());
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await proporPlanoRecuperacao(plano())).toEqual(r);
  expect((await proporPlanoRecuperacao({ ...plano(), motivo: "Conteúdo alterado com mesma chave" })).ok).toBe(false);
  expect((await proporPlanoRecuperacao({ ...plano(), chaveIdempotencia: "versao-desatualizada-plano" })).ok).toBe(false);
  const p = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: r.dado.id } });
  expect(p.matriculaId).toBe(matriculaId); expect(p.preparadorId).toBe(professor);
  expect(p.snapshot).toMatchObject({ estado: "ACOMPANHAMENTO_REGULAR", resultado: { atendeRequisitosNotas: false } });
  expect(await prisma.evento.count({ where: { tipo: "PlanoRecuperacaoProposto", agregadoId: matriculaId } })).toBe(1);
  await expect(prisma.propostaPlanoRecuperacao.delete({ where: { id: p.id } })).rejects.toThrow("imutável");
  const depois = await consultarConsolidadoAvaliacoes(alocacaoId);
  expect(depois.ok && depois.dado?.resultado.atendeRequisitosNotas).toBe(false);
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await proporPlanoRecuperacao({ ...plano(), versaoEsperada: 1 })).ok).toBe(false);
});

it("recuperação não substitui avaliação pendente nem é criada para notas suficientes", async () => {
  expect((await proporPlanoRecuperacao(plano())).ok).toBe(false);
  await oficializarResultadoRegular("8");
  expect((await proporPlanoRecuperacao(plano())).ok).toBe(false);
  expect(await prisma.propostaPlanoRecuperacao.count()).toBe(0);
});

it("insuficiência apenas na média geral permite identificar habilidades específicas no plano", async () => {
  await oficializarResultadoRegular("6");
  const r = await proporPlanoRecuperacao({ ...plano(), atividades: [atividadeRecuperacao("FALA")] });
  expect(r.ok).toBe(true);
  const p = await prisma.propostaPlanoRecuperacao.findFirstOrThrow();
  expect(p.atividades).toEqual([atividadeRecuperacao("FALA")]);
});

it("gestão consulta designação, busca professores ativos e preserva histórico após oficialização", async () => {
  const v = await salvar({ ...entrada(), submetida: true });
  const substituto = await criarUsuario(["PROFESSOR"]);
  await prisma.usuario.update({ where: { id: substituto.id }, data: { nome: "Avaliador substituto teste" } });
  const inativo = await criarUsuario(["PROFESSOR"]);
  await prisma.usuario.update({ where: { id: inativo.id }, data: { nome: "Avaliador inativo teste", ativo: false } });
  const consulta = { alocacaoId, codigoAvaliacao: "I1", busca: "Avaliador" };
  expect((await consultarDesignacoesAvaliacao(consulta)).ok).toBe(false);
  entrar(gestor);
  const inicial = await consultarDesignacoesAvaliacao(consulta);
  if (!inicial.ok || !inicial.dado) throw new Error(JSON.stringify(inicial));
  expect(inicial.dado.professores).toEqual([{ id: substituto.id, nome: "Avaliador substituto teste" }]);
  expect(inicial.dado.versaoEsperada).toBe(0);
  expect(inicial.dado.identificacao.matriculaId).toBe(matriculaId);
  expect((await designarAvaliador({ alocacaoId, codigoAvaliacao: "I1", professorId: substituto.id, versaoEsperada: 0, motivo: "Designar avaliador para continuidade", chaveIdempotencia: "consulta-gestao-designacao" })).ok).toBe(true);
  const historico = await consultarDesignacoesAvaliacao(consulta);
  if (!historico.ok || !historico.dado) throw new Error(JSON.stringify(historico));
  expect(historico.dado.atual?.professor?.id).toBe(substituto.id);
  expect(historico.dado.historico[0].gestor.id).toBe(gestor);
  expect(historico.dado.versaoEsperada).toBe(1);
  expect(JSON.stringify(historico.dado)).not.toMatch(/chaveIdempotencia|entradaHash|senha|email/);
  const paginada = await consultarDesignacoesAvaliacao({ ...consulta, pagina: 2 });
  expect(paginada.ok && paginada.dado?.historico).toEqual([]);
  expect((await consultarDesignacoesAvaliacao({ ...consulta, codigoAvaliacao: "inexistente" })).ok).toBe(false);
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(true);
  const fechada = await consultarDesignacoesAvaliacao(consulta);
  if (!fechada.ok || !fechada.dado) throw new Error(JSON.stringify(fechada));
  expect(fechada.dado.podeAlterar).toBe(false);
  expect(fechada.dado.professores).toEqual([]);
  expect(fechada.dado.historico).toHaveLength(1);
});

it("avaliador designado consulta somente a avaliação atribuída e perde acesso após troca ou revogação", async () => {
  const v = await salvar();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const outro = (await criarUsuario(["PROFESSOR"])).id;
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outraM = await prisma.matricula.create({ data: { alunoId, produtoId: m.produtoId, paisId: m.paisId, moeda: m.moeda, status: "ATIVA", ativadaEm: inicio } });
  const outraA = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outraM.id, turmaId, criadoEm: inicio, ativa: false, encerradaEm: new Date("2026-02-01") } });
  entrar(gestor);
  const d = { alocacaoId, codigoAvaliacao: "I1", professorId: substituto, versaoEsperada: 0, motivo: "Continuidade da avaliação pendente", chaveIdempotencia: "acesso-designado-teste" };
  expect((await designarAvaliador(d)).ok).toBe(true);
  entrar(substituto);
  const consulta = await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  expect(consulta.dado.versoes.map(n => n.id)).toEqual([v.id]);
  expect(consulta.dado.versoes[0].autor.id).toBe(professor);
  expect(consulta.dado.podeLancar).toBe(true);
  expect(consulta.dado.versoes[0].podeDecidir).toBe(false);
  const lista = await listarAvaliacoesAlocacao(alocacaoId);
  if (!lista.ok || !lista.dado) throw new Error(JSON.stringify(lista));
  expect(lista.dado.avaliacoes.map(a => a.codigo)).toEqual(["I1"]);
  const painel = await listarVinculosAvaliacoes({ modo: "designadas" });
  if (!painel.ok || !painel.dado) throw new Error(JSON.stringify(painel));
  expect(painel.dado.itens.map(a => a.id)).toEqual([alocacaoId]);
  const segundaPagina = await listarVinculosAvaliacoes({ modo: "designadas", pagina: 2 });
  expect(segundaPagina.ok && segundaPagina.dado?.itens).toEqual([]);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "F1" })).ok).toBe(false);
  expect((await consultarLancamentosAvaliacao({ alocacaoId: outraA.id, codigoAvaliacao: "I1" })).ok).toBe(false);
  expect((await consultarConsolidadoAvaliacoes(alocacaoId)).ok).toBe(false);
  expect(JSON.stringify(consulta.dado)).not.toContain(outraM.id);
  entrar(gestor);
  expect((await designarAvaliador({ ...d, professorId: outro, versaoEsperada: 1, chaveIdempotencia: "troca-designado-acesso" })).ok).toBe(true);
  entrar(substituto);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(false);
  expect((await listarAvaliacoesAlocacao(alocacaoId)).ok).toBe(false);
  const retirado = await listarVinculosAvaliacoes({ modo: "designadas" });
  expect(retirado.ok && retirado.dado?.itens).toEqual([]);
  entrar(outro);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(true);
  entrar(gestor);
  expect((await designarAvaliador({ ...d, professorId: null, versaoEsperada: 2, chaveIdempotencia: "revoga-designado-acesso" })).ok).toBe(true);
  entrar(outro);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(false);
});

it("consulta delegada confere papel atual e termina com a oficialização da pendência", async () => {
  const v = await salvar({ ...entrada(), submetida: true });
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  entrar(gestor);
  expect((await designarAvaliador({ alocacaoId, codigoAvaliacao: "I1", professorId: substituto, versaoEsperada: 0, motivo: "Conferir avaliação do vínculo", chaveIdempotencia: "designacao-papel-atual" })).ok).toBe(true);
  entrar(substituto);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(true);
  await prisma.usuario.update({ where: { id: substituto }, data: { papeis: ["SECRETARIA_ACADEMICA"] } });
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: substituto }, data: { papeis: ["PROFESSOR"], ativo: false } });
  expect((await listarAvaliacoesAlocacao(alocacaoId)).ok).toBe(false);
  await prisma.usuario.update({ where: { id: substituto }, data: { ativo: true } });
  entrar(gestor);
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(true);
  entrar(substituto);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(false);
});

it("realizador anterior consulta seu registro regularizado sem acessar trabalho posterior do substituto", async () => {
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  await prisma.vinculoDocente.updateMany({ where: { turmaId, professorId: professor }, data: { fim: new Date("2026-02-01T00:00:00Z") } });
  entrar(gestor);
  expect((await designarAvaliador({ alocacaoId, codigoAvaliacao: "I1", professorId: substituto, versaoEsperada: 0, motivo: "Regularizar avaliação anterior à saída", chaveIdempotencia: "historico-realizador-designacao" })).ok).toBe(true);
  entrar(substituto);
  const antiga = await salvar({ ...entrada(), realizadaPorId: professor, motivoRegularizacao: "Registro antigo sem lançamento no ERP", evidenciasRegularizacao: "Ficha original de avaliação e identificação do professor" });
  const posterior = await salvar({ ...entrada(), realizadaEm: (await instanteAtualConferido()).toISOString(), versaoEsperada: 1, chaveIdempotencia: "avaliacao-posterior-substituto", notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Comentário exclusivo da avaliação posterior" }] });
  entrar(professor);
  const r = await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(r.dado.versoes.map(v => v.id)).toEqual([antiga.id]);
  expect(r.dado.versoes[0].realizadaPor?.id).toBe(professor);
  expect(r.dado.versoes[0].autor.id).toBe(substituto);
  expect(r.dado.podeLancar).toBe(false);
  expect(r.dado.versoes[0].podeDecidir).toBe(false);
  expect(JSON.stringify(r.dado.versoes)).not.toContain(posterior.id);
  expect(JSON.stringify(r.dado)).not.toContain("Comentário exclusivo");
  const lista = await listarAvaliacoesAlocacao(alocacaoId);
  expect(lista.ok && lista.dado?.avaliacoes.map(a => a.codigo)).toEqual(["I1"]);
  const painel = await listarVinculosAvaliacoes({ modo: "historico" });
  expect(painel.ok && painel.dado?.itens.map(a => a.id)).toEqual([alocacaoId]);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "F1" })).ok).toBe(false);
  expect((await consultarConsolidadoAvaliacoes(alocacaoId)).ok).toBe(false);
  expect((await salvarLancamentoAvaliacao({ ...entrada(), versaoEsperada: 2, chaveIdempotencia: "realizador-antigo-tenta-editar" })).ok).toBe(false);
});

it("substituto regulariza avaliação histórica com autoria distinta e conferência independente", async () => {
  const original = await salvar();
  const substituto = (await criarUsuario(["PROFESSOR", "GERENTE_PEDAGOGICO"])).id;
  entrar(gestor);
  expect((await designarAvaliador({ alocacaoId, codigoAvaliacao: "I1", professorId: substituto, versaoEsperada: 0, motivo: "Regularização por saída do titular", chaveIdempotencia: "autoria-designacao-historica" })).ok).toBe(true);
  entrar(substituto);
  const base = { ...entrada(), versaoEsperada: 1, submetida: true, chaveIdempotencia: "regularizacao-nota-historica" };
  expect((await salvarLancamentoAvaliacao(base)).ok).toBe(false);
  expect((await salvarLancamentoAvaliacao({ ...base, realizadaPorId: professor })).ok).toBe(false);
  const dados = { ...base, realizadaPorId: professor, motivoRegularizacao: "Lançamento a partir de registro do titular", evidenciasRegularizacao: "Ficha da avaliação realizada, conferida pela gestão" };
  const v = await salvar(dados);
  expect(v.autorId).toBe(substituto); expect(v.realizadaPorId).toBe(professor);
  expect((await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: original.id } })).autorId).toBe(professor);
  expect((await salvarLancamentoAvaliacao(dados)).ok).toBe(true);
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(false);
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  entrar(professor);
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(false);
  await expect(prisma.decisaoLancamentoAvaliacao.create({ data: { lancamentoId: v.id, decisorId: professor, aprovada: true, motivo: "Tentativa direta de aprovar realização própria" } })).rejects.toThrow("outra pessoa");
  entrar(gestor);
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(true);
  const consulta = await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  expect(consulta.dado.versoes[0].realizadaPor?.id).toBe(professor);
  expect(consulta.dado.versoes[0].evidenciasRegularizacao).toBe(dados.evidenciasRegularizacao);
});

it("substituto realiza avaliação após designação e revogação impede novos lançamentos", async () => {
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  entrar(gestor);
  const d = { alocacaoId, codigoAvaliacao: "I1", professorId: substituto, versaoEsperada: 0, motivo: "Aplicação por avaliador substituto", chaveIdempotencia: "designacao-realizacao-propria" };
  expect((await designarAvaliador(d)).ok).toBe(true);
  await aguardarInstanteRegistrado((await prisma.designacaoAvaliacao.findUniqueOrThrow({ where: { gestorId_chaveIdempotencia: { gestorId: gestor, chaveIdempotencia: d.chaveIdempotencia } } })).criadaEm);
  entrar(substituto);
  const v = await salvar({ ...entrada(), realizadaEm: (await instanteAtualConferido()).toISOString() });
  expect(v.realizadaPorId).toBe(substituto); expect(v.motivoRegularizacao).toBeNull();
  entrar(gestor);
  expect((await designarAvaliador({ ...d, professorId: null, versaoEsperada: 1, chaveIdempotencia: "revogacao-bloqueio-escrita" })).ok).toBe(true);
  entrar(substituto);
  expect((await salvarLancamentoAvaliacao({ ...entrada(), realizadaEm: (await instanteAtualConferido()).toISOString(), versaoEsperada: 1, chaveIdempotencia: "revogado-novo-lancamento" })).ok).toBe(false);
  await expect(prisma.versaoLancamentoAvaliacao.create({ data: { registroId: v.registroId, versao: 2, autorId: substituto, realizadaPorId: substituto, realizadaEm: v.realizadaEm, notas: v.notas!, submetida: false, conteudoHash: v.conteudoHash, entradaHash: v.entradaHash, chaveIdempotencia: "revogado-direto-banco" } })).rejects.toThrow("sem atribuição");
});

it("designação versionada preserva turma, autoria e histórico após revogação", async () => {
  const v = await salvar();
  const substituto = (await criarUsuario(["PROFESSOR"])).id; entrar(gestor);
  const d = { alocacaoId, codigoAvaliacao: "I1", professorId: substituto, versaoEsperada: 0, motivo: "Substituição para avaliação pendente", chaveIdempotencia: "designacao-avaliacao-teste" };
  const r = await designarAvaliador(d); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await designarAvaliador(d)).toEqual(r);
  expect((await designarAvaliador({ ...d, professorId: professor })).ok).toBe(false);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).professorId).toBe(professor);
  expect((await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: v.id } })).autorId).toBe(professor);
  expect((await designarAvaliador({ ...d, professorId: null, versaoEsperada: 1, chaveIdempotencia: "revogar-designacao-teste" })).ok).toBe(true);
  const historico = await prisma.designacaoAvaliacao.findMany({ orderBy: { versao: "asc" } });
  expect(historico.map(d => d.professorId)).toEqual([substituto, null]);
  expect(historico.every(d => d.registroId === v.registroId)).toBe(true);
  await expect(prisma.designacaoAvaliacao.deleteMany()).rejects.toThrow("imutáveis");
});

it("designação exige gestão, professor ativo e avaliação ainda pendente", async () => {
  const v = await salvar({ ...entrada(), submetida: true });
  const d = { alocacaoId, codigoAvaliacao: "I1", professorId: professor, versaoEsperada: 0, motivo: "Avaliação sob nova responsabilidade", chaveIdempotencia: "designacao-restrita-teste" };
  expect((await designarAvaliador(d)).ok).toBe(false);
  entrar(gestor);
  expect((await designarAvaliador({ ...d, professorId: gestor })).ok).toBe(false);
  expect((await designarAvaliador({ ...d, codigoAvaliacao: "INEXISTENTE" })).ok).toBe(false);
  await oficializarLancamentoAvaliacao(decisao(v));
  expect((await designarAvaliador(d)).ok).toBe(false);
  expect(await prisma.designacaoAvaliacao.count()).toBe(0);
});

it.each([
  [{ habilidade: "FALA", nota: "999", comentarioAluno: "" }],
  [{ habilidade: "ESCRITA", nota: "7", comentarioAluno: "" }],
  [{ habilidade: "FALA", nota: 7, comentarioAluno: "" }],
  [{ habilidade: "FALA", nota: "7", comentarioAluno: { texto: "Formato incorreto" } }],
  [{ habilidade: "FALA", nota: "7", comentarioAluno: "", campoExtra: true }],
])("banco rejeita conteúdo inválido de nota e correção: %j", async nota => {
  const v = await salvar();
  await expect(prisma.versaoLancamentoAvaliacao.create({ data: { registroId: v.registroId, versao: 2, autorId: professor, realizadaEm: v.realizadaEm,
    notas: [nota], submetida: true, conteudoHash: v.conteudoHash, chaveIdempotencia: "nota-direta-invalida", entradaHash: v.entradaHash } })).rejects.toThrow();
  const oficial = await salvar({ ...entrada(), submetida: true, versaoEsperada: 1, chaveIdempotencia: "nota-oficial-base-integridade" });
  entrar(gestor); await oficializarLancamentoAvaliacao(decisao(oficial));
  await expect(prisma.propostaCorrecaoNota.create({ data: { lancamentoId: oficial.id, versao: 1, autorId: gestor, notas: [nota], origemHash: oficial.conteudoHash,
    motivo: "Escrita direta de teste", chaveIdempotencia: "correcao-direta-invalida", entradaHash: oficial.entradaHash } })).rejects.toThrow();
  expect(await prisma.propostaCorrecaoNota.count()).toBe(0);
  expect(await prisma.versaoLancamentoAvaliacao.count()).toBe(2);
});

it("mudança aprovada após a revisão invalida a aprovação e depois aparece na fila sem ser desfeita", async () => {
  const v = await salvar({ ...entrada(), submetida: true }); entrar(gestor); await oficializarLancamentoAvaliacao(decisao(v)); entrar(professor);
  const final = await salvar({ ...entrada(), codigoAvaliacao: "F1", submetida: true, chaveIdempotencia: "final-para-fechamento-impacto",
    notas: HABILIDADES.map(habilidade => ({ habilidade, nota: "8", comentarioAluno: "Resultado final suficiente antes da correção." })) });
  entrar(gestor); await oficializarLancamentoAvaliacao(decisao(final));
  await registrarPresencaParaFechamento("frequencia-fechamento-impacto-regular");
  const fechamento = await confirmarFechamentoSuficienteParaImpacto("fechamento-impacto-regular");
  entrar(professor);
  const proposta = await proporCorrecaoNota({ lancamentoId: v.id, origemHash: v.conteudoHash, notas: [{ habilidade: "FALA", nota: "5", comentarioAluno: "" }], motivo: "Correção com impacto pedagógico", versaoEsperada: 0, chaveIdempotencia: "correcao-com-impacto" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(gestor); const previa = await revisarCorrecaoNota(proposta.dado.id); if (!previa.ok || !previa.dado) throw new Error("Prévia indisponível");
  expect(await listarRevisoesPorCorrecao({})).toMatchObject({ ok: true, dado: { itens: [] } });
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: { modalidadeId: t.modalidadeId, nivelId: t.nivelId, professorId: professor, nome: "Destino de teste", dataInicio: new Date("2099-01-01") } });
  // Estado acadêmico preexistente; este teste não executa o fluxo de transferência.
  // A aprovação carrega o fechamento real que a correção posterior tornará obsoleto.
  const mudanca = await prisma.solicitacaoMudancaAcademica.create({ data: { alunoId, matriculaId, alocacaoOrigemId: alocacaoId, turmaOrigemId: turmaId, turmaDestinoId: destino.id,
    motivo: "Transferência de teste aprovada", horarioCompativel: true, snapshot: { matriculaOrigemId: matriculaId }, status: "APROVADA", solicitanteId: professor, aprovadorId: gestor, motivoDecisao: "Aprovação pedagógica de teste", decididoEm: new Date(),
    fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash } });
  const input = { propostaId: proposta.dado.id, propostaHash: previa.dado.propostaHash, impactosHash: previa.dado.impactosHash, aprovada: true, motivo: "Conferência da correção" };
  expect((await decidirCorrecaoNota(input)).ok).toBe(false);
  const atual = await revisarCorrecaoNota(proposta.dado.id); if (!atual.ok || !atual.dado) throw new Error("Revisão indisponível");
  const aplicada = await decidirCorrecaoNota({ ...input, impactosHash: atual.dado.impactosHash });
  expect(aplicada).toMatchObject({ ok: true, dado: { aplicada: true } });
  if (!aplicada.ok || !aplicada.dado) throw new Error(JSON.stringify(aplicada));
  const [casoRegular] = await casosRevisaoProgressao(mudanca.id);
  expect(await casosRevisaoProgressao(mudanca.id)).toHaveLength(1);
  expect(casoRegular).toMatchObject({
    matriculaId, solicitacaoId: mudanca.id, alocacaoFonteId: alocacaoId,
    decisaoCorrecaoNotaId: aplicada.dado.id, decisaoCorrecaoRecuperacaoId: null,
    snapshotImpacto: { id: mudanca.id, status: "APROVADA", turmaDestinoId: destino.id },
  });
  await esperarCasoDeRevisaoImutavel(casoRegular!);
  expect(await consultarCasoRevisaoProgressao({ casoId: casoRegular!.id })).toMatchObject({ ok: true, dado: {
    id: casoRegular!.id, situacao: "PENDENTE_REVISAO", statusNaCorrecao: "APROVADA",
    matricula: { id: matriculaId }, origem: { tipo: "REGULAR", alocacaoFonteId: alocacaoId, decisaoId: aplicada.dado.id },
    solicitacao: { id: mudanca.id, status: "APROVADA" },
  } });
  entrar((await criarUsuario(["SECRETARIA_ACADEMICA"])).id);
  expect((await consultarCasoRevisaoProgressao({ casoId: casoRegular!.id })).ok).toBe(false);
  entrar(gestor);
  expect(await decidirCorrecaoNota({ ...input, impactosHash: atual.dado.impactosHash })).toEqual(aplicada);
  expect(await casosRevisaoProgressao(mudanca.id)).toHaveLength(1);
  const fila = await listarRevisoesPorCorrecao({});
  expect(fila).toMatchObject({ ok: true, dado: { itens: [{ matricula: { id: matriculaId }, impactos: [{ casoId: casoRegular!.id, solicitacaoId: mudanca.id, statusNaCorrecao: "APROVADA", statusAtual: "APROVADA", destino: { nome: "Destino de teste" } }] }] } });
  expect(JSON.stringify(fila)).not.toMatch(/telefone|email|chaveIdempotencia|entradaHash/);
  expect((await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: mudanca.id } })).status).toBe("APROVADA");
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "CorrecaoNotaRevisaoNecessaria" } })).toBe(1);
  expect((await cancelarMudancaAcademica(mudanca.id, {
    motivo: "A progressão aprovada será cancelada e resolvida pelo fluxo de revisão.",
  })).ok).toBe(true);
  const revisaoResolucao = await revisarResolucaoRevisaoProgressao({
    solicitacaoId: mudanca.id, acao: "REGISTRAR_CANCELAMENTO",
  });
  expect(revisaoResolucao).toMatchObject({ ok: true, dado: {
    solicitacaoId: mudanca.id, acao: "REGISTRAR_CANCELAMENTO", versaoAtual: 0,
    casos: [{ id: casoRegular!.id, casoHash: expect.stringMatching(/^[a-f0-9]{64}$/) }],
  } });
  if (!revisaoResolucao.ok || !revisaoResolucao.dado) throw new Error(JSON.stringify(revisaoResolucao));
  const entradaResolucao = {
    solicitacaoId: mudanca.id, acao: "REGISTRAR_CANCELAMENTO" as const,
    estadoHash: revisaoResolucao.dado.estadoHash, versaoEsperada: revisaoResolucao.dado.versaoAtual,
    motivo: "Registro da resolução do caso após o cancelamento formal da progressão.",
    chaveIdempotencia: "resolucao-cancelamento-correcao-regular",
  };
  const propostaResolucao = await proporResolucaoRevisaoProgressao(entradaResolucao);
  expect(propostaResolucao).toMatchObject({ ok: true, dado: { versao: 1 } });
  expect(await proporResolucaoRevisaoProgressao(entradaResolucao)).toEqual(propostaResolucao);
  if (!propostaResolucao.ok || !propostaResolucao.dado) throw new Error(JSON.stringify(propostaResolucao));
  const decisaoResolucao = {
    propostaId: propostaResolucao.dado.id, estadoHash: revisaoResolucao.dado.estadoHash, aprovada: true,
    motivo: "Aprovação independente da resolução após conferir o cancelamento do pedido.",
  };
  expect((await decidirResolucaoRevisaoProgressao(decisaoResolucao)).ok).toBe(false);
  const administradorResolucao = (await criarUsuario(["ADMINISTRADOR"])).id;
  entrar(administradorResolucao);
  const aprovadaResolucao = await decidirResolucaoRevisaoProgressao(decisaoResolucao);
  expect(aprovadaResolucao).toMatchObject({ ok: true, dado: { aprovada: true } });
  expect(await decidirResolucaoRevisaoProgressao(decisaoResolucao)).toEqual(aprovadaResolucao);
  expect(await consultarCasoRevisaoProgressao({ casoId: casoRegular!.id })).toMatchObject({ ok: true, dado: {
    id: casoRegular!.id, situacao: "RESOLVIDA", solicitacao: { id: mudanca.id, status: "CANCELADA" },
  } });
  entrar(professor); expect((await listarRevisoesPorCorrecao({})).ok).toBe(false);
});

it("materializa uma correção histórica regular legítima sem alterar a decisão ou o pedido", async () => {
  await oficializarResultadoRegular("8");
  await registrarPresencaParaFechamento("frequencia-fechamento-materializacao-historica");
  const fechamento = await confirmarFechamentoSuficienteParaImpacto("fechamento-materializacao-historica");
  const turmaAtual = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: {
    modalidadeId: turmaAtual.modalidadeId, nivelId: turmaAtual.nivelId, professorId: professor,
    nome: "Destino do pedido histórico regular", dataInicio: new Date("2099-01-01T00:00:00.000Z"),
  } });
  const solicitacao = await prisma.solicitacaoMudancaAcademica.create({ data: {
    alunoId, matriculaId, alocacaoOrigemId: alocacaoId, turmaOrigemId: turmaId, turmaDestinoId: destino.id,
    motivo: "Pedido aprovado antes da persistência automática de casos de revisão.", horarioCompativel: true,
    snapshot: { matriculaOrigemId: matriculaId }, status: "APROVADA", solicitanteId: professor,
    aprovadorId: gestor, motivoDecisao: "Aprovação histórica preservada para preparar o caso de revisão.", decididoEm: new Date(),
    fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash,
  } });
  const lancamento = await prisma.versaoLancamentoAvaliacao.findFirstOrThrow({ where: {
    registro: { alocacaoId, codigoAvaliacao: "I1" },
  } });
  entrar(professor);
  const proposta = await proporCorrecaoNota({
    lancamentoId: lancamento.id, origemHash: lancamento.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção histórica regular legítima." }],
    motivo: "Correção aprovada antes da versão que passou a persistir automaticamente os casos.",
    versaoEsperada: 0, chaveIdempotencia: "proposta-correcao-historica-materializar",
  });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const impactoOriginal = {
    id: solicitacao.id, status: "APROVADA" as const, turmaDestinoId: destino.id,
    decididoEm: solicitacao.decididoEm!.toISOString(), executadoEm: null,
  };
  const decisaoHistorica = await prisma.decisaoCorrecaoNota.create({ data: {
    propostaId: proposta.dado.id, decisorId: gestor, aprovada: true,
    motivo: "Decisão histórica legítima preservada sem usar o helper de casos.", impactos: [impactoOriginal],
  } });
  const pedidoOriginal = await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.id } });
  const eventosAntes = await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "CasosHistoricosCorrecaoPreparados" } });

  entrar((await criarUsuario(["SECRETARIA_ACADEMICA"])).id);
  expect((await materializarCasosHistoricosCorrecao({ tipo: "REGULAR", decisaoId: decisaoHistorica.id })).ok).toBe(false);
  entrar(professor);
  expect((await materializarCasosHistoricosCorrecao({ tipo: "REGULAR", decisaoId: decisaoHistorica.id })).ok).toBe(false);
  expect(await casosRevisaoProgressao(solicitacao.id)).toEqual([]);

  entrar(gestor);
  const materializada = await materializarCasosHistoricosCorrecao({ tipo: "REGULAR", decisaoId: decisaoHistorica.id });
  expect(materializada).toMatchObject({ ok: true, dado: {
    criados: 1, total: 1, casos: [expect.objectContaining({ solicitacaoId: solicitacao.id })],
  } });
  if (!materializada.ok || !materializada.dado) throw new Error(JSON.stringify(materializada));
  expect(await casosRevisaoProgressao(solicitacao.id)).toEqual([expect.objectContaining({
    id: materializada.dado.casos[0]!.id, matriculaId, solicitacaoId: solicitacao.id, alocacaoFonteId: alocacaoId,
    decisaoCorrecaoNotaId: decisaoHistorica.id, decisaoCorrecaoRecuperacaoId: null, snapshotImpacto: impactoOriginal,
  })]);
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "CasosHistoricosCorrecaoPreparados" } })).toBe(eventosAntes + 1);
  expect(await materializarCasosHistoricosCorrecao({ tipo: "REGULAR", decisaoId: decisaoHistorica.id })).toMatchObject({ ok: true, dado: {
    criados: 0, total: 1, casos: [{ id: materializada.dado.casos[0]!.id, solicitacaoId: solicitacao.id }],
  } });
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "CasosHistoricosCorrecaoPreparados" } })).toBe(eventosAntes + 1);
  expect(await prisma.decisaoCorrecaoNota.findUniqueOrThrow({ where: { id: decisaoHistorica.id } })).toEqual(decisaoHistorica);
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.id } })).toEqual(pedidoOriginal);
});

it("materializa uma correção histórica de recuperação com o envelope de impactos original", async () => {
  const { fala } = await prepararItensDesignacao(["FALA"], {
    FALA: "5", COMPREENSAO_ORAL: "8", LEITURA: "8", ESCRITA: "8",
  });
  entrar(professor);
  const realizada = await registrarRealizacaoRecuperacao({
    itemReservaId: fala.id, realizadaEm: (await instanteAtualConferido()).toISOString(),
    evidencia: "Realização original da recuperação que fundamenta a correção histórica.",
  });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const notaLancada = await salvarNotaRecuperacao({
    realizacaoId: realizada.dado.id, nota: "7", comentarioAluno: "Nota original da recuperação.",
    submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-recuperacao-historica-materializar",
  });
  if (!notaLancada.ok || !notaLancada.dado) throw new Error(JSON.stringify(notaLancada));
  const nota = await prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: notaLancada.dado.id } });
  entrar(gestor);
  expect((await decidirNotaRecuperacao({
    notaId: nota.id, entradaHash: nota.entradaHash, aprovada: true,
    motivo: "Conferência independente da nota que antecede a correção histórica.",
  })).ok).toBe(true);
  await registrarPresencaParaFechamento("frequencia-fechamento-materializacao-recuperacao");
  const fechamento = await confirmarFechamentoSuficienteParaImpacto("fechamento-materializacao-recuperacao");
  const turmaAtual = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: {
    modalidadeId: turmaAtual.modalidadeId, nivelId: turmaAtual.nivelId, professorId: professor,
    nome: "Destino do pedido histórico de recuperação", dataInicio: new Date("2099-01-01T00:00:00.000Z"),
  } });
  const solicitacao = await prisma.solicitacaoMudancaAcademica.create({ data: {
    alunoId, matriculaId, alocacaoOrigemId: alocacaoId, turmaOrigemId: turmaId, turmaDestinoId: destino.id,
    motivo: "Pedido aprovado antes da criação automática de casos de recuperação.", horarioCompativel: true,
    snapshot: { matriculaOrigemId: matriculaId }, status: "APROVADA", solicitanteId: professor,
    aprovadorId: gestor, motivoDecisao: "Aprovação histórica preservada para a recuperação.", decididoEm: new Date(),
    fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash,
  } });
  entrar(professor);
  const proposta = await proporCorrecaoRecuperacao({
    notaId: nota.id, origemId: nota.id, nota: "8", comentarioAluno: "Correção histórica de recuperação.",
    motivo: "Correção aprovada antes da persistência automática dos casos de recuperação.",
    versaoEsperada: 0, chaveIdempotencia: "proposta-correcao-recuperacao-historica",
  });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const impactoOriginal = {
    id: solicitacao.id, status: "APROVADA" as const, turmaDestinoId: destino.id,
    decididoEm: solicitacao.decididoEm!.toISOString(), executadoEm: null,
  };
  const decisaoHistorica = await prisma.decisaoCorrecaoRecuperacao.create({ data: {
    propostaId: proposta.dado.id, decisorId: gestor, aprovada: true,
    motivo: "Decisão histórica de recuperação preservada sem o helper de casos.",
    impactos: { mudancas: [impactoOriginal] },
  } });
  const pedidoOriginal = await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.id } });
  expect(await casosRevisaoProgressao(solicitacao.id)).toEqual([]);

  entrar(gestor);
  const materializada = await materializarCasosHistoricosCorrecao({ tipo: "RECUPERACAO", decisaoId: decisaoHistorica.id });
  expect(materializada).toMatchObject({ ok: true, dado: {
    criados: 1, total: 1, casos: [expect.objectContaining({ solicitacaoId: solicitacao.id })],
  } });
  if (!materializada.ok || !materializada.dado) throw new Error(JSON.stringify(materializada));
  expect(await casosRevisaoProgressao(solicitacao.id)).toEqual([expect.objectContaining({
    id: materializada.dado.casos[0]!.id, matriculaId, solicitacaoId: solicitacao.id, alocacaoFonteId: alocacaoId,
    decisaoCorrecaoNotaId: null, decisaoCorrecaoRecuperacaoId: decisaoHistorica.id, snapshotImpacto: impactoOriginal,
  })]);
  expect(await materializarCasosHistoricosCorrecao({ tipo: "RECUPERACAO", decisaoId: decisaoHistorica.id })).toMatchObject({ ok: true, dado: {
    criados: 0, total: 1, casos: [{ id: materializada.dado.casos[0]!.id, solicitacaoId: solicitacao.id }],
  } });
  expect(await prisma.decisaoCorrecaoRecuperacao.findUniqueOrThrow({ where: { id: decisaoHistorica.id } })).toEqual(decisaoHistorica);
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.id } })).toEqual(pedidoOriginal);
});

it("materialização histórica e banco recusam a fonte da mesma matrícula sem equivalência aplicada", async () => {
  await oficializarResultadoRegular("8");
  await registrarPresencaParaFechamento("frequencia-fechamento-caso-sem-cadeia");
  const fechamento = await confirmarFechamentoSuficienteParaImpacto("fechamento-caso-sem-cadeia");
  const turmaAtual = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: {
    modalidadeId: turmaAtual.modalidadeId, nivelId: turmaAtual.nivelId, professorId: professor,
    nome: "Destino do pedido usado na tentativa forjada", dataInicio: new Date("2099-01-01T00:00:00.000Z"),
  } });
  const solicitacao = await prisma.solicitacaoMudancaAcademica.create({ data: {
    alunoId, matriculaId, alocacaoOrigemId: alocacaoId, turmaOrigemId: turmaId, turmaDestinoId: destino.id,
    motivo: "Pedido aprovado que não tem relação com a fonte histórica forjada.", horarioCompativel: true,
    snapshot: { matriculaOrigemId: matriculaId }, status: "APROVADA", solicitanteId: professor,
    aprovadorId: gestor, motivoDecisao: "Aprovação preservada para validar o alcance do caso.", decididoEm: new Date(),
    fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash,
  } });

  const turmaFonte = await prisma.turma.create({ data: {
    modalidadeId: turmaAtual.modalidadeId, nivelId: turmaAtual.nivelId, professorId: professor,
    nome: "Fonte histórica sem equivalência aplicada", dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId: professor, inicio } },
  } });
  await prisma.turma.update({ where: { id: turmaFonte.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  const alocacaoFonte = await prisma.alocacaoTurma.create({ data: {
    alunoId, matriculaId, turmaId: turmaFonte.id, ativa: false,
    criadoEm: inicio, encerradaEm: new Date("2026-01-20T00:00:00.000Z"),
  } });
  entrar(professor);
  const lancamentoFonte = await salvarLancamentoAvaliacao({
    ...entrada(), alocacaoId: alocacaoFonte.id, submetida: true,
    notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Fonte histórica válida sem cadeia aplicada." }],
    chaveIdempotencia: "lancamento-fonte-sem-cadeia",
  });
  if (!lancamentoFonte.ok || !lancamentoFonte.dado) throw new Error(JSON.stringify(lancamentoFonte));
  const versaoFonte = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: lancamentoFonte.dado.id } });
  entrar(gestor);
  expect((await oficializarLancamentoAvaliacao(decisao(versaoFonte))).ok).toBe(true);
  entrar(professor);
  const proposta = await proporCorrecaoNota({
    lancamentoId: versaoFonte.id, origemHash: versaoFonte.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção usada para a tentativa de adulteração." }],
    motivo: "A fonte histórica foi corrigida, mas não possui equivalência aplicada até o pedido.",
    versaoEsperada: 0, chaveIdempotencia: "proposta-fonte-sem-cadeia",
  });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const impactoForjado = {
    id: solicitacao.id, status: "APROVADA", turmaDestinoId: destino.id,
    decididoEm: solicitacao.decididoEm!.toISOString(), executadoEm: null,
  };
  const decisaoForjada = await prisma.decisaoCorrecaoNota.create({ data: {
    propostaId: proposta.dado.id, decisorId: gestor, aprovada: true,
    motivo: "Decisão direta com impacto forjado para testar o guard de alcance.", impactos: [impactoForjado],
  } });

  entrar(gestor);
  expect((await materializarCasosHistoricosCorrecao({ tipo: "REGULAR", decisaoId: decisaoForjada.id })).ok).toBe(false);
  expect(await casosRevisaoProgressao(solicitacao.id)).toEqual([]);

  await expect(prisma.$executeRaw`
    INSERT INTO "CasoRevisaoProgressao" (
      id, "matriculaId", "solicitacaoId", "decisaoCorrecaoNotaId", "decisaoCorrecaoRecuperacaoId",
      "alocacaoFonteId", "snapshotImpacto"
    ) VALUES (
      ${`caso-forjado-sem-cadeia-${alocacaoFonte.id}`}, ${matriculaId}, ${solicitacao.id}, ${decisaoForjada.id}, NULL,
      ${alocacaoFonte.id}, ${JSON.stringify(impactoForjado)}::jsonb
    )
  `).rejects.toThrow("não é alcançada por equivalência aplicada");
  expect(await casosRevisaoProgressao(solicitacao.id)).toEqual([]);
});

it("aprova correções em cadeia e recalcula com a nota vigente, preservando originais", async () => {
  const v = await salvar({ ...entrada(), submetida: true }); entrar(gestor); await oficializarLancamentoAvaliacao(decisao(v)); entrar(professor);
  const d = { lancamentoId: v.id, origemHash: v.conteudoHash, notas: [{ habilidade: "FALA" as const, nota: "5", comentarioAluno: "Nota corrigida" }], motivo: "Corrigir digitação anterior", versaoEsperada: 0, chaveIdempotencia: "correcao-aplicavel-teste" };
  const p = await proporCorrecaoNota(d); if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  entrar(gestor); const r = await revisarCorrecaoNota(p.dado.id); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const decisaoInput = { propostaId: p.dado.id, propostaHash: r.dado.propostaHash, impactosHash: r.dado.impactosHash, aprovada: true, motivo: "Conferi a correção proposta" };
  const a = await decidirCorrecaoNota(decisaoInput); expect(a.ok).toBe(true); expect(await decidirCorrecaoNota(decisaoInput)).toEqual(a);
  expect(await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: true, dado: { versoes: [{ notas: [{ nota: "7" }], vigente: { notas: [{ nota: "5" }], correcaoId: p.dado.id } }] } });
  const consolidado = await consultarConsolidadoAvaliacoes(alocacaoId);
  if (!consolidado.ok || !consolidado.dado) throw new Error("Consolidado indisponível");
  expect(consolidado.dado.resultado.habilidades[0].memoria[0].nota).toBe("5");
  expect(consolidado.dado.fontes[0].correcaoId).toBe(p.dado.id);
  entrar(professor);
  const nova = { ...d, notas: [{ ...d.notas[0], nota: "6" }], versaoEsperada: 1, chaveIdempotencia: "segunda-correcao-aplicavel" };
  expect((await proporCorrecaoNota(nova)).ok).toBe(false);
  const p2 = await proporCorrecaoNota({ ...nova, origemHash: r.dado.propostaHash });
  if (!p2.ok || !p2.dado) throw new Error(JSON.stringify(p2));
  entrar(gestor); const r2 = await revisarCorrecaoNota(p2.dado.id);
  if (!r2.ok || !r2.dado) throw new Error(JSON.stringify(r2));
  expect((await decidirCorrecaoNota({ ...decisaoInput, propostaId: p2.dado.id, propostaHash: r2.dado.propostaHash, impactosHash: r2.dado.impactosHash })).ok).toBe(true);
  expect(await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: true, dado: { versoes: [{ notas: [{ nota: "7" }], vigente: { notas: [{ nota: "6" }], correcaoId: p2.dado.id } }] } });
  const historico = await consultarCorrecoesNota({ lancamentoId: v.id });
  expect(historico).toMatchObject({ ok: true, dado: { identificacao: { matriculaId, aluno: "Aluno de teste", nivel: "A1" } } });
  expect(historico).toMatchObject({ ok: true, dado: { versaoEsperada: 2, vigente: { notas: [{ nota: "6" }] }, propostas: [
    { anteriores: [{ nota: "5" }], notas: [{ nota: "6" }], podeRevisar: false },
    { anteriores: [{ nota: "7" }], notas: [{ nota: "5" }], podeRevisar: false },
  ] } });
  expect(JSON.stringify(historico)).not.toMatch(/chaveIdempotencia|entradaHash|telefone|email/);
  expect(await consultarCorrecoesNota({ lancamentoId: v.id, pagina: 2 })).toMatchObject({ ok: true, dado: { propostas: [], versaoEsperada: 2 } });
  entrar(professor); await prisma.vinculoDocente.updateMany({ where: { turmaId }, data: { fim: new Date() } });
  expect((await consultarCorrecoesNota({ lancamentoId: v.id })).ok).toBe(false);
  expect((await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: v.id } })).notas).toEqual(v.notas);
});

it("correção impede autoaprovação, versão antiga e decisões concorrentes duplicadas", async () => {
  const v = await salvar({ ...entrada(), submetida: true }); entrar(gestor); await oficializarLancamentoAvaliacao(decisao(v));
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } }); entrar(professor);
  const d = { lancamentoId: v.id, origemHash: v.conteudoHash, notas: [{ habilidade: "FALA" as const, nota: "5", comentarioAluno: "" }], motivo: "Corrigir avaliação lançada", versaoEsperada: 0, chaveIdempotencia: "correcao-concorrente-teste" };
  const p = await proporCorrecaoNota(d); if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  const r = await revisarCorrecaoNota(p.dado.id); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(r.dado.podeDecidir).toBe(false);
  const i = { propostaId: p.dado.id, propostaHash: r.dado.propostaHash, impactosHash: r.dado.impactosHash, aprovada: true, motivo: "Decisão da correção" };
  expect((await decidirCorrecaoNota(i)).ok).toBe(false);
  await expect(prisma.decisaoCorrecaoNota.create({ data: { propostaId: p.dado.id, decisorId: professor, aprovada: true, motivo: "Teste direto", impactos: [] } })).rejects.toThrow("outra pessoa");
  const p2 = await proporCorrecaoNota({ ...d, versaoEsperada: 1, chaveIdempotencia: "correcao-mais-recente" }); if (!p2.ok || !p2.dado) throw new Error(JSON.stringify(p2));
  entrar(gestor); expect((await decidirCorrecaoNota(i)).ok).toBe(false);
  const r2 = await revisarCorrecaoNota(p2.dado.id); if (!r2.ok || !r2.dado) throw new Error(JSON.stringify(r2));
  const i2 = { ...i, propostaId: p2.dado.id, propostaHash: r2.dado.propostaHash, impactosHash: r2.dado.impactosHash };
  const outro = (await criarUsuario(["ADMINISTRADOR"])).id;
  const rs = await Promise.allSettled([prisma.$transaction(tx => decidirCorrecaoNotaTx(tx, gestor, i2)), prisma.$transaction(tx => decidirCorrecaoNotaTx(tx, outro, { ...i2, aprovada: false }))]);
  expect(rs.filter(x => x.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.decisaoCorrecaoNota.count()).toBe(1);
  await expect(prisma.decisaoCorrecaoNota.deleteMany()).rejects.toThrow("imutáveis");
});

it("proposta de correção preserva a nota oficial até decisão, com reenvio e imutabilidade", async () => {
  const v = await salvar({ ...entrada(), submetida: true }); entrar(gestor);
  await oficializarLancamentoAvaliacao(decisao(v)); entrar(professor);
  const d = { lancamentoId: v.id, origemHash: v.conteudoHash, notas: [{ habilidade: "FALA" as const, nota: "5", comentarioAluno: "Correção do lançamento" }], motivo: "Erro de digitação da nota", versaoEsperada: 0, chaveIdempotencia: "proposta-correcao-teste" };
  const resultados = await Promise.all([1, 2].map(() => prisma.$transaction(tx => proporCorrecaoNotaTx(tx, professor, d))));
  expect(resultados[0]).toEqual(resultados[1]);
  expect(await proporCorrecaoNota(d)).toMatchObject({ ok: true, dado: resultados[0] });
  expect(await prisma.propostaCorrecaoNota.count()).toBe(1);
  expect((await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: v.id } })).notas).toEqual(v.notas);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" }))).toMatchObject({ ok: true, dado: { oficial: true, versoes: [{ notas: [{ nota: "7" }] }] } });
  expect((await proporCorrecaoNota({ ...d, notas: [{ ...d.notas[0], nota: "6" }] })).ok).toBe(false);
  await expect(prisma.propostaCorrecaoNota.update({ where: { id: resultados[0].id }, data: { motivo: "Alterar histórico" } })).rejects.toThrow("imutáveis");
  await expect(prisma.propostaCorrecaoNota.deleteMany()).rejects.toThrow("imutáveis");
});

it("correção exige origem oficial, mudança válida e atribuição docente vigente", async () => {
  const v = await salvar({ ...entrada(), submetida: true });
  const d = { lancamentoId: v.id, origemHash: v.conteudoHash, notas: [{ habilidade: "FALA" as const, nota: "5", comentarioAluno: "" }], motivo: "Conferência da nota original", versaoEsperada: 0, chaveIdempotencia: "proposta-correcao-invalida" };
  expect((await proporCorrecaoNota(d)).ok).toBe(false);
  entrar(gestor); await oficializarLancamentoAvaliacao(decisao(v));
  expect((await proporCorrecaoNota({ ...d, notas: entrada().notas })).ok).toBe(false);
  expect((await proporCorrecaoNota({ ...d, origemHash: "0".repeat(64) })).ok).toBe(false);
  expect((await proporCorrecaoNota({ ...d, notas: [{ ...d.notas[0], nota: "99" }] })).ok).toBe(false);
  await prisma.vinculoDocente.updateMany({ where: { turmaId }, data: { fim: new Date() } }); entrar(professor);
  expect((await proporCorrecaoNota(d)).ok).toBe(false);
  entrar(gestor); expect((await proporCorrecaoNota(d)).ok).toBe(true);
  expect(await prisma.propostaCorrecaoNota.count()).toBe(1);
});

it("entrada local converte no servidor e conserva idempotência e autorização", async () => {
  const { realizadaEm, ...base } = entrada();
  const local = { ...base, realizadaLocal: "2026-01-10T04:00", fuso: "America/Costa_Rica" };
  const r = await salvarLancamentoAvaliacaoLocal(local);
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect((await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: r.dado.id } })).realizadaEm.toISOString()).toBe(realizadaEm);
  expect(await salvarLancamentoAvaliacaoLocal(local)).toEqual(r);
  expect((await salvarLancamentoAvaliacaoLocal({ ...local, fuso: "America/Sao_Paulo" })).ok).toBe(false);
  expect((await salvarLancamentoAvaliacaoLocal({ ...local, realizadaLocal: "2026-03-08T02:30", fuso: "America/New_York" })).ok).toBe(false);
  expect(await prisma.versaoLancamentoAvaliacao.count()).toBe(1);
  entrar((await criarUsuario(["PROFESSOR"])).id);
  expect((await salvarLancamentoAvaliacaoLocal({ ...local, chaveIdempotencia: "outro-professor-local" })).ok).toBe(false);
});

it("painel encontra histórico encerrado próprio sem devolver escrita ou consolidado amplo", async () => {
  expect(await listarVinculosAvaliacoes({})).toMatchObject({ ok: true, dado: { itens: [{ id: alocacaoId }], temProxima: false } });
  expect(await listarVinculosAvaliacoes({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [] } });
  await salvar();
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { ativa: false, encerradaEm: new Date("2026-02-01") } });
  await prisma.vinculoDocente.updateMany({ where: { turmaId }, data: { fim: new Date() } });
  const outro = (await criarUsuario(["PROFESSOR"])).id;
  await prisma.turma.update({ where: { id: turmaId }, data: { professorId: outro } });
  expect(await listarVinculosAvaliacoes({})).toMatchObject({ ok: true, dado: { itens: [] } });
  const historico = await listarVinculosAvaliacoes({ modo: "historico" });
  expect(historico).toMatchObject({ ok: true, dado: { itens: [{ id: alocacaoId, ativa: false }] } });
  expect(JSON.stringify(historico)).not.toMatch(/telefone|email|responsavelFinanceiro|notas|chaveIdempotencia/);
  expect(await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: true, dado: { podeLancar: false } });
  expect((await consultarConsolidadoAvaliacoes(alocacaoId)).ok).toBe(false);
  entrar(outro);
  expect(await listarVinculosAvaliacoes({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [] } });
  entrar(gestor);
  expect(await listarVinculosAvaliacoes({ modo: "historico" })).toMatchObject({ ok: true, dado: { itens: [{ id: alocacaoId }] } });
  entrar(professor);
  await prisma.usuario.update({ where: { id: professor }, data: { ativo: false } });
  expect((await listarVinculosAvaliacoes({ modo: "historico" })).ok).toBe(false);
});

it("consolida só notas oficiais do vínculo com pesos publicados e preserva pendências", async () => {
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { completa: false, geral: null } } });
  const i = await salvar({ ...entrada(), submetida: true });
  const parcial = await consultarConsolidadoAvaliacoes(alocacaoId);
  expect(parcial).toMatchObject({ ok: true, dado: { resultado: { completa: false, habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", memoria: expect.arrayContaining([expect.objectContaining({ nota: null, pendencia: "AGUARDANDO_OFICIALIZACAO" })]) })]) } } });
  entrar(gestor); await oficializarLancamentoAvaliacao(decisao(i)); entrar(professor);
  const final = await salvar({ ...entrada(), codigoAvaliacao: "F1", chaveIdempotencia: "avaliacao-final-consolidado", submetida: true,
    notas: ["FALA", "COMPREENSAO_ORAL", "LEITURA", "ESCRITA"].map(habilidade => ({ habilidade: habilidade as "FALA", nota: "9", comentarioAluno: "" })) });
  expect(await consultarConsolidadoAvaliacoes(alocacaoId)).toMatchObject({ ok: true, dado: { resultado: { completa: false, geral: null } } });
  entrar(gestor); await oficializarLancamentoAvaliacao(decisao(final));
  const r = await consultarConsolidadoAvaliacoes(alocacaoId);
  expect(r).toMatchObject({ ok: true, dado: { resultado: { matriculaId, completa: true,
    habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultado: { numerador: "17", denominador: "2" } })]), geral: { numerador: "71", denominador: "8" } } } });
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("ATIVA");
  const estranho = (await criarUsuario(["PROFESSOR"])).id; entrar(estranho);
  expect((await consultarConsolidadoAvaliacoes(alocacaoId)).ok).toBe(false);
});

it("conserva rascunho, submete versão nova e oficializa sem duplicar ou alterar origem", async () => {
  const d = entrada(); d.notas[0].nota = null;
  const rascunho = await salvar(d); entrar(gestor);
  expect((await oficializarLancamentoAvaliacao(decisao(rascunho))).ok).toBe(false);
  entrar(professor);
  const submetida = await salvar({ ...entrada(), submetida: true, versaoEsperada: 1, chaveIdempotencia: "lancamento-teste-2" });
  entrar(gestor);
  const r = await oficializarLancamentoAvaliacao(decisao(submetida)); expect(r.ok).toBe(true);
  expect(await oficializarLancamentoAvaliacao(decisao(submetida))).toEqual(r);
  expect(await prisma.decisaoLancamentoAvaliacao.count()).toBe(1);
  expect((await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: rascunho.id } })).notas).toEqual(d.notas);
  expect(await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: true, dado: { registro: { matriculaId, turmaId }, versoes: [{ versao: 2, decisao: { aprovada: true } }, { versao: 1, decisao: null }] } });
  await expect(prisma.versaoLancamentoAvaliacao.update({ where: { id: submetida.id }, data: { notas: [] } })).rejects.toThrow("imutáveis");
  await expect(prisma.registroAvaliacaoMatricula.deleteMany()).rejects.toThrow("imutáveis");
  entrar(professor);
  expect((await salvarLancamentoAvaliacao({ ...entrada(), versaoEsperada: 2, chaveIdempotencia: "alterar-nota-oficial" })).ok).toBe(false);
});

it("rejeita autooficialização com papéis acumulados, também no banco", async () => {
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"] } });
  const v = await salvar({ ...entrada(), submetida: true });
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(false);
  await expect(prisma.decisaoLancamentoAvaliacao.create({ data: { lancamentoId: v.id, decisorId: professor, aprovada: true, motivo: "Via banco" } })).rejects.toThrow("outra pessoa");
});

it.each(["futura", "antesAlocacao", "escala", "habilidade", "incompleta"])("recusa lançamento inválido: %s", async tipo => {
  const d = entrada();
  if (tipo === "futura") d.realizadaEm = "2099-01-01T00:00:00Z";
  if (tipo === "antesAlocacao") d.realizadaEm = "2020-01-01T00:00:00Z";
  if (tipo === "escala") d.notas[0].nota = "11";
  if (tipo === "habilidade") d.codigoAvaliacao = "F1";
  if (tipo === "incompleta") { d.submetida = true; d.notas[0].nota = null; }
  expect((await salvarLancamentoAvaliacao(d)).ok).toBe(false);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
});

it("outro professor não lê ou escreve; ex-professor mantém apenas leitura do próprio histórico", async () => {
  await salvar(); const substituto = (await criarUsuario(["PROFESSOR"])).id;
  entrar(substituto);
  expect((await listarAvaliacoesAlocacao(alocacaoId)).ok).toBe(false);
  expect((await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).ok).toBe(false);
  expect((await salvarLancamentoAvaliacao(entrada())).ok).toBe(false);
  await prisma.vinculoDocente.updateMany({ where: { turmaId, fim: null }, data: { fim: new Date() } });
  await prisma.turma.update({ where: { id: turmaId }, data: { professorId: substituto } });
  entrar(professor);
  expect(await listarAvaliacoesAlocacao(alocacaoId)).toMatchObject({ ok: true, dado: { avaliacoes: [{ codigo: "I1" }] } });
  const lista = await listarAvaliacoesAlocacao(alocacaoId);
  if (!lista.ok || !lista.dado) throw new Error("Consulta negada");
  expect(lista.dado.avaliacoes).toHaveLength(1);
  expect(await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: true, dado: { podeLancar: false, versoes: [{ versao: 1 }] } });
  expect((await salvarLancamentoAvaliacao(entrada())).ok).toBe(false);
});

it("apresenta ações conforme versão, autoria e oficialização, sem campos privados", async () => {
  expect(await listarAvaliacoesAlocacao(alocacaoId)).toMatchObject({ ok: true, dado: { avaliacoes: [{ codigo: "I1" }, { codigo: "F1" }] } });
  const consultar = () => consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" });
  expect(await consultar()).toMatchObject({ ok: true, dado: { podeLancar: true, versaoEsperada: 0, oficial: false } });
  const v1 = await salvar({ ...entrada(), submetida: true });
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  expect(await consultar()).toMatchObject({ ok: true, dado: { versoes: [{ podeDecidir: false, podeAprovar: false }] } });
  const v2 = await salvar({ ...entrada(), submetida: true, versaoEsperada: 1, chaveIdempotencia: "segunda-versao-tela" });
  entrar(gestor);
  expect(await consultar()).toMatchObject({ ok: true, dado: { podeLancar: false, versaoEsperada: 2,
    versoes: [{ id: v2.id, podeDecidir: true, podeAprovar: true }, { id: v1.id, podeDecidir: true, podeAprovar: false }] } });
  expect((await oficializarLancamentoAvaliacao(decisao(v2))).ok).toBe(true);
  entrar(professor);
  const r = await consultar();
  expect(r).toMatchObject({ ok: true, dado: { podeLancar: false, oficial: true } });
  expect(JSON.stringify(r)).not.toMatch(/chaveIdempotencia|entradaHash|responsavelFinanceiro|telefone|email/);
  const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; entrar(secretaria);
  expect((await listarAvaliacoesAlocacao(alocacaoId)).ok).toBe(false);
  expect((await consultar()).ok).toBe(false);
});

it("reenvios concorrentes geram só uma versão; revisão nova impede oficializar versão anterior", async () => {
  const d = { ...entrada(), submetida: true };
  const rs = await Promise.all([1, 2].map(() => prisma.$transaction(tx => salvarLancamentoTx(tx, professor, d))));
  expect(rs[0]).toEqual(rs[1]);
  const v = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: rs[0].id } });
  await salvar({ ...entrada(), versaoEsperada: 1, chaveIdempotencia: "revisao-posterior-nota" });
  entrar(gestor);
  expect((await oficializarLancamentoAvaliacao(decisao(v))).ok).toBe(false);
  expect(await prisma.decisaoLancamentoAvaliacao.count()).toBe(0);
});

it("decisões concorrentes conservam resultado único", async () => {
  const v = await salvar({ ...entrada(), submetida: true }), outro = (await criarUsuario(["ADMINISTRADOR"])).id;
  const rs = await Promise.allSettled([prisma.$transaction(tx => oficializarLancamentoTx(tx, gestor, decisao(v))), prisma.$transaction(tx => oficializarLancamentoTx(tx, outro, { ...decisao(v), aprovada: false }))]);
  expect(rs.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.decisaoLancamentoAvaliacao.count()).toBe(1);
});

it("vincula ao contrato da alocação, sem herdar outro contrato da pessoa", async () => {
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId, produtoId: m.produtoId, paisId: m.paisId, moeda: m.moeda, status: "PAUSADA" } });
  const v = await salvar();
  const r = await prisma.registroAvaliacaoMatricula.findUniqueOrThrow({ where: { id: v.registroId } });
  expect(r.matriculaId).toBe(matriculaId);
  const consulta = await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: "I1" });
  expect(consulta).toMatchObject({ ok: true, dado: { identificacao: { matriculaId, aluno: "Aluno de teste", nivel: "A1" } } });
  expect(JSON.stringify(consulta)).not.toContain(outra.id);
  expect(await prisma.registroAvaliacaoMatricula.count({ where: { matriculaId: outra.id } })).toBe(0);
  await expect(prisma.registroAvaliacaoMatricula.create({ data: { matriculaId: outra.id, turmaId, alocacaoId, regraId: r.regraId, codigoAvaliacao: "F1" } })).rejects.toThrow("matrícula e turma corretas");
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: outra.id } })).status).toBe("PAUSADA");
});

