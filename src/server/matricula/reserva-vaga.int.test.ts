import { revisarNovaReservaParticular, confirmarNovaReservaParticular, consultarFormularioNovaReserva } from "./nova-reserva-particular";
import { revisarNovaReservaParticularTx, criarNovaReservaParticularTx } from "./nova-reserva-particular-tx";
import { conferirReservaParticularSecretaria, listarReservasParticularesSecretaria } from "./reserva-painel";
import { rodarVencimentoParticulares } from "./reserva-particular-cron";
import { proximaReservaParticularVencida } from "./reserva-particular-cursor";
import { vincularNovaReservaParticularTx, resolverReservaParticularAtual } from "./reserva-particular-cadeia";
import { prepararResolucaoParticular, decidirResolucaoParticular, consultarResolucoesParticulares } from "./reserva-particular-resolucao";
import { consultarProfessoresParticular, revisarAgendaParticularComercial } from "./preparacao-comercial";
import { solicitarIndisponibilidadeDocente, decidirIndisponibilidadeDocente } from "@/server/agenda/indisponibilidade";
import { consultarIndisponibilidadesDocentes } from "@/server/agenda/indisponibilidade-consulta";
import { reservarAgendaParticularTx } from "./reserva-particular-tx";
import { conferirDisponibilidadeGrade } from "@/server/agenda/grade-disponibilidade";
import { conferirAgendaParticularTx } from "./agenda-particular-estado";
import { prepararProcessoEnvioTx, iniciarTentativaAssinaturaTx, registrarResultadoEnvioTx } from "@/server/contratos/envio-tx";
import { preservarConclusaoAssinaturaTx } from "@/server/contratos/conclusao-assinatura-tx";
import { consultarConclusaoContratual } from "@/server/contratos/conclusao-consulta";
import { GET as baixarArquivoAssinatura } from "@/app/api/matriculas/[id]/assinaturas/[conclusaoId]/[tipo]/route";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { ConferirParticipantesSchema } from "@/server/contratos/participantes-schema";
import { prepararExcecaoAdmissao, decidirExcecaoAdmissao, consultarExcecoesAdmissao } from "./excecao-admissao";
import { conferirContinuidadeReserva } from "./excecao-admissao-estado";
import { consultarConferenciaAssinatura, registrarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";
import { receberTx, receberComDestinacoesTx } from "@/server/financeiro/recebimentos";
import { TipoDestinacaoRecebimento } from "@prisma/client";
import { GET as baixarPdfPrevia } from "@/app/api/matriculas/[id]/previas/[previaId]/pdf/route";
import { GET as baixarPdfOriginal } from "@/app/api/matriculas/[id]/originais/[artefatoId]/pdf/route";
import { preservarOriginalContratual, consultarOriginaisContratuais } from "@/server/contratos/originais";
import * as geradorPdf from "@/server/contratos/pdf-previa";
import { conferirParticipantesContratuais, consultarConferenciasParticipantes, consultarFormularioParticipantes } from "@/server/contratos/participantes";
import { prepararModeloContratual, decidirModeloContratual } from "@/server/contratos/modelos";
import { consultarPreenchimentoContratual, registrarPreviaContratual, consultarPreviaContratual, consultarPainelPrevias } from "@/server/contratos/previas";
import { consultarRevisaoEmissao, conferirEEmitirEntrada, consultarTelaEmissao } from "@/server/secretaria/conferencia-emissao";
import { emitirEntradaTx } from "./emissao-entrada-tx";
import { registrarCondicoesEntrada, consultarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
import { consultarPendenciasPreparacao } from "@/server/secretaria/prontidao-preparacao";
import { decidirPrecoPreparacao } from "./preparacao-preco";
import { registrarPagadorPreparacao, consultarPagadorPreparacao, consultarTelaPagador, consultarHistoricoPagador } from "@/server/secretaria/pagador-preparacao";
import { exigirEntradaMensalRegistrada } from "./entrada-ativacao";
import { consultarPagamentosEntradaParticular } from "./entrada-particular-consulta";
import { concluirMatricula } from "./acoes";
import { configurarEntradaOferta, consultarEntradasOfertas } from "@/server/catalogo/entrada-oferta";
import { exigirPrecoPreparacaoAutorizado } from "./preco-autorizado";
import { confirmarContratoMatricula } from "@/server/secretaria/acoes";
import { consultarAceiteOriginal, confirmarAceiteOriginal } from "@/server/contratos/aceite";
import { confirmarAceiteOriginalTx } from "@/server/contratos/aceite-tx";
import { exigirContratoAceito } from "./ativacao";
import { ativarPreparacaoTx } from "./ativacao-preparacao-tx";
import { registrarCompraHorasAntecipadas } from "./compra-horas";
import { consultarPreparacaoContratacao } from "./preparacao-consulta";
import { consultarCadastrosPreparacao, prepararContratacao, prepararContratacaoNovaPessoa, consultarOfertasPreparacao } from "./preparacao-comercial";
import { prepararContratacaoTx } from "./preparacao-comercial-tx";
import { reservarVagaContratacao, consultarTurmasParaReserva } from "./reserva-comercial";
import { prepararResolucaoReserva, decidirResolucaoReserva, consultarResolucoesReserva } from "./reserva-resolucao";
import { listarReservasSecretaria, conferirReservaSecretaria } from "./reserva-painel";
import { conferirVencimentoReservaTx } from "./reserva-vencimento-tx";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { listarTurmasAbertas } from "./consultas";
import { listarTurmas } from "@/server/turmas/consultas";
import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { reservarVagaMatriculaTx } from "./reserva-vaga-tx";
let turmaId: string, autorId: string, matriculas: string[];
beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60 } });
  const c = await seedCatalogoMinimo();
  const autor = await criarUsuario(["SECRETARIA_ACADEMICA"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]), professor = await criarUsuario(["PROFESSOR"]);
  autorId = autor.id; authMock.mockResolvedValue({ user: { id: autorId } });
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: c.produto.id } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: produto.idiomaId, codigo: "RESERVA", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: produto.modalidadeId, nivelId: nivel.id, professorId: professor.id, capacidade: 1 } }); turmaId = turma.id;
  const janela = await prisma.janelaAdmissaoTurma.create({ data: { turmaId, preparadorId: autorId, versao: 1, limiteEntrada: new Date("2099-12-31"), fusoAdmissao: "UTC", motivo: "Fixture janela", chaveIdempotencia: "janela-reserva", entradaHash: "fixture" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: gestor.id, aprovada: true, motivo: "Fixture decisão" } });
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: autorId, fusoInstitucional: "UTC", periodos: [], motivo: "Fixture", chaveIdempotencia: "calendario-fixture", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: gestor.id, aprovada: true, motivo: "Fixture" } });
  const grade = await prisma.propostaGradeTurma.create({ data: { turmaId, calendarioId: calendario.id, preparadorId: autorId, versao: 1, fusoOrigem: "UTC", motivo: "Fixture", chaveIdempotencia: "grade-fixture", entradaHash: "fixture", snapshot: {} } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: gestor.id, aprovada: true, motivo: "Fixture" } });
  await prisma.encontroAgenda.create({ data: { turmaId, propostaGradeId: grade.id, professorId: professor.id, preparadorId: autorId, inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Fixture", chaveIdempotencia: "encontro-fixture", entradaHash: "fixture" } });
  matriculas = [];
  for (let i = 0; i < 2; i++) {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: `Reserva ${i}`, paisId: c.pais.id } });
    matriculas.push((await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: c.pais.id, moeda: "CRC" } })).id);
  }
});
const dados = (i: number) => ({ matriculaId: matriculas[i], turmaId, autorId, motivo: "Reserva na preparação do contrato", chaveIdempotencia: `reserva-teste-${i}` });
it("serializa disputa pela última vaga sem ativar, cobrar ou alocar", async () => {
  const resultados = await Promise.allSettled(matriculas.map((_, i) => prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(i)))));
  expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(await prisma.reservaVagaMatricula.count()).toBe(1);
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.alocacaoTurma.count()).toBe(0);
  expect(await prisma.matricula.count({ where: { status: "RASCUNHO" } })).toBe(2);
});
it("reenvia sem duplicação e preserva a origem no banco", async () => {
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  expect(await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)))).toEqual(r);
  await expect(prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, { ...dados(0), motivo: "Outro motivo" }))).rejects.toThrow("Chave");
  await expect(prisma.reservaVagaMatricula.updateMany({ data: { matriculaId: matriculas[1] } })).rejects.toThrow();
  await expect(prisma.reservaVagaMatricula.deleteMany()).rejects.toThrow();
});
it("prazo vencido não libera vaga sem conferência do avanço formal", async () => {
  await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  await prisma.$executeRaw`UPDATE "ReservaVagaMatricula" SET "expiraEm" = "criadaEm" + interval '1 millisecond'`;
  await expect(prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(1)))).rejects.toThrow("SEM_VAGA");
});

it("alocação legada e redução de capacidade respeitam reservas também no banco", async () => {
  await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[1] } });
  const alocar = () => prisma.alocacaoTurma.create({ data: { alunoId: m.alunoId, matriculaId: m.id, turmaId, ativa: true } });
  await expect(alocar()).rejects.toThrow("Capacidade insuficiente");
  await prisma.turma.update({ where: { id: turmaId }, data: { capacidade: 2 } });
  const a = await alocar();
  await expect(prisma.turma.update({ where: { id: turmaId }, data: { capacidade: 1 } })).rejects.toThrow("Capacidade insuficiente");
  await prisma.alocacaoTurma.update({ where: { id: a.id }, data: { ativa: false } });
  await prisma.turma.update({ where: { id: turmaId }, data: { capacidade: 1 } });
  await expect(prisma.alocacaoTurma.update({ where: { id: a.id }, data: { ativa: true } })).rejects.toThrow("Capacidade insuficiente");
});
it("inserção direta de outra reserva também não ultrapassa a capacidade", async () => {
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const atual = await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: r.id } });
  await expect(prisma.reservaVagaMatricula.create({ data: { matriculaId: matriculas[1], turmaId, janelaId: atual.janelaId, preparadorId: autorId,
    expiraEm: atual.expiraEm, motivo: "Tentativa direta", chaveIdempotencia: "insercao-direta", entradaHash: "fixture" } })).rejects.toThrow("Capacidade insuficiente");
});

it("consultas comercial e de configuração contam reservas ocupantes e excluem liberadas", async () => {
  await prisma.turma.update({ where: { id: turmaId }, data: { status: "ABERTA", dataInicio: new Date("2099-10-01") } });
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  expect((await listarTurmasAbertas()).find((t) => t.id === turmaId)?._count).toMatchObject({ alocacoes: 0, reservasMatricula: 1 });
  expect((await listarTurmas()).find((t) => t.id === turmaId)?._count).toMatchObject({ reservasMatricula: 1 });
  await prisma.reservaVagaMatricula.update({ where: { id: r.id }, data: { status: "LIBERADA" } });
  expect((await listarTurmasAbertas()).find((t) => t.id === turmaId)?._count.reservasMatricula).toBe(0);
});

it("protege reserva vencida com comprovante em conferência e não desfaz a pendência depois", async () => {
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  expect(await prisma.$transaction((tx) => conferirVencimentoReservaTx(tx, r.id))).toMatchObject({ resultado: "PRAZO_VIGENTE" });
  const cobranca = await prisma.cobranca.create({ data: { matriculaId: matriculas[0], tipo: "MATRICULA", valorOriginal: 100, valorNegociado: 100, moeda: "CRC", vencimento: new Date() } });
  const informe = await prisma.pagamentoInformado.create({ data: { cobrancaId: cobranca.id, autorId, valor: 100, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date(), chaveIdempotencia: "informe-reserva" } });
  await prisma.$executeRaw`UPDATE "ReservaVagaMatricula" SET "expiraEm" = "criadaEm" + interval '1 millisecond'`;
  expect(await conferirReservaSecretaria({ reservaId: r.id })).toMatchObject({ ok: true, dado: { status: "MANTIDA_PENDENCIA", resultado: "PENDENCIA_REGISTRADA" } });
  expect(await prisma.evento.findFirst({ where: { tipo: "ReservaMantidaPorPendencia" } })).toMatchObject({ autorId });
  await prisma.pagamentoInformado.update({ where: { id: informe.id }, data: { status: "REJEITADO" } });
  expect(await prisma.$transaction((tx) => conferirVencimentoReservaTx(tx, r.id))).toMatchObject({ status: "MANTIDA_PENDENCIA", resultado: "SEM_TRANSICAO" });
  expect(await prisma.evento.count({ where: { tipo: "ReservaMantidaPorPendencia" } })).toBe(1);
});
it("mantém a vaga vencida em pendência quando há antecipação real sem cobrança", async () => {
  const reserva = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const caixa = await criarUsuario(["FINANCEIRO"]);
  const recebimento = await prisma.$transaction(tx => receberComDestinacoesTx(tx, {
    titularMatriculaId: matriculas[0], autorId: caixa.id, pagadorId: null, chaveIdempotencia: "reserva-credito-puro-q87",
    valorRecebido: 100, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date("2099-09-10T12:00:00Z"),
    comentario: "Antecipação registrada antes da assinatura.",
    destinos: [{ tipo: TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO, valor: 100, evidencia: "Antecipação sem cobrança para a matrícula reservada.", chaveIdempotencia: "credito-sem-destino" }],
  }));
  await prisma.$executeRaw`UPDATE "ReservaVagaMatricula" SET "expiraEm" = "criadaEm" + interval '1 millisecond' WHERE id = ${reserva.id}`;
  expect(await prisma.$transaction(tx => conferirVencimentoReservaTx(tx, reserva.id, caixa.id))).toMatchObject({ status: "MANTIDA_PENDENCIA", resultado: "PENDENCIA_REGISTRADA" });
  expect(await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ status: "MANTIDA_PENDENCIA" });
  expect(await prisma.destinacaoRecebimento.findFirstOrThrow({ where: { recebimentoId: recebimento.id } })).toMatchObject({ cobrancaId: null, tipo: "CREDITO_SEM_DESTINO", autorId: caixa.id });
  expect(await prisma.evento.findFirstOrThrow({ where: { tipo: "ReservaMantidaPorPendencia", agregadoId: matriculas[0] } })).toMatchObject({ payload: expect.objectContaining({ recebimentosIds: [recebimento.id] }) });
  await expect(prisma.$transaction(tx => reservarVagaMatriculaTx(tx, dados(1)))).rejects.toThrow("SEM_VAGA");
});
it("não usa pagamento de outro contrato nem presume ausência de assinatura externa", async () => {
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const outraCobranca = await prisma.cobranca.create({ data: { matriculaId: matriculas[1], tipo: "MATRICULA", valorOriginal: 100, valorNegociado: 100, saldo: 100, status: "PENDENTE", moeda: "CRC", vencimento: new Date() } });
  const caixa = await criarUsuario(["FINANCEIRO"]);
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: outraCobranca.id, autorId: caixa.id, valorRecebido: 100, forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Recebimento exclusivo do outro contrato", chaveIdempotencia: "reserva-outro-contrato" }));
  await prisma.$executeRaw`UPDATE "ReservaVagaMatricula" SET "expiraEm" = "criadaEm" + interval '1 millisecond'`;
  expect(await prisma.$transaction((tx) => conferirVencimentoReservaTx(tx, r.id))).toMatchObject({ status: "ATIVA", resultado: "CONFERIR_ASSINATURA_EXTERNA" });
  expect(await prisma.evento.count({ where: { tipo: "ReservaMantidaPorPendencia" } })).toBe(0);
});


it("painel filtra por matrícula e não expõe financeiro ou ações a professor", async () => {
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const painel = await listarReservasSecretaria({ matriculaId: matriculas[0] });
  expect(painel).toMatchObject({ ok: true, dado: { registros: [{ id: r.id, podeConferir: false }] } });
  if (!painel.ok || !painel.dado) throw new Error("Painel ausente");
  expect(painel.dado.registros[0]).not.toHaveProperty("entradaHash");
  expect(painel.dado.registros[0].matricula).not.toHaveProperty("cobrancas");
  expect(await listarReservasSecretaria({ matriculaId: matriculas[1] })).toMatchObject({ ok: true, dado: { registros: [] } });
  expect(await listarReservasSecretaria({ pagina: 2 })).toMatchObject({ ok: true, dado: { registros: [], possuiMais: false } });
  const prof = await criarUsuario(["PROFESSOR"]); authMock.mockResolvedValue({ user: { id: prof.id } });
  expect((await listarReservasSecretaria({})).ok).toBe(false);
  expect((await conferirReservaSecretaria({ reservaId: r.id })).ok).toBe(false);
});

it.each(["PRORROGAR", "LIBERAR"] as const)("resolve %s com aprovação administrativa independente preservando a contratação", async (tipo) => {
  const reserva = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  await prisma.reservaVagaMatricula.update({ where: { id: reserva.id }, data: { status: "MANTIDA_PENDENCIA" } });
  const antes = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const entrada = { reservaId: reserva.id, versaoAnterior: 0, tipo, ...(tipo === "PRORROGAR" ? { novoPrazo: "2099-10-02T12:00:00Z" } : {}), motivo: "Resolver pendência documentada", tratamentoContratacao: "Contratação será conferida em seu fluxo próprio; preservar documentos e valores.", chaveIdempotencia: "resolucao-reserva" };
  const p = await prepararResolucaoReserva(entrada); if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  expect(await prepararResolucaoReserva(entrada)).toEqual(p);
  const d = { propostaId: p.dado.id, aprovar: true, motivo: "Conferido pela Administração" };
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["ADMINISTRADOR"] } });
  expect((await decidirResolucaoReserva(d)).ok).toBe(false);
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  const r = await decidirResolucaoReserva(d); expect(r.ok).toBe(true); expect(await decidirResolucaoReserva(d)).toEqual(r);
  const atual = await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } });
  expect(atual.status).toBe(tipo === "PRORROGAR" ? "ATIVA" : "LIBERADA");
  if (tipo === "PRORROGAR") expect(atual.expiraEm.toISOString()).toBe("2099-10-02T12:00:00.000Z");
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } })).toEqual(antes);
  expect(await prisma.recebimento.count()).toBe(0);
  await expect(prisma.decisaoResolucaoReserva.updateMany({ data: { motivo: "Reescrita indevida" } })).rejects.toThrow();
});
it("recusa aprovação de resolução depois de mudança da contratação", async () => {
  const reserva = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  await prisma.reservaVagaMatricula.update({ where: { id: reserva.id }, data: { status: "MANTIDA_PENDENCIA" } });
  const p = await prepararResolucaoReserva({ reservaId: reserva.id, versaoAnterior: 0, tipo: "LIBERAR", motivo: "Solicitar liberação", tratamentoContratacao: "Conferir tratamento dos documentos e valores em fluxo próprio", chaveIdempotencia: "resolucao-desatualizada" });
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  await prisma.matricula.update({ where: { id: matriculas[0] }, data: { contratoOk: true } });
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  expect((await decidirResolucaoReserva({ propostaId: p.dado.id, aprovar: true, motivo: "Tentativa após alteração" })).ok).toBe(false);
  expect((await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: reserva.id } })).status).toBe("MANTIDA_PENDENCIA");
  expect(await prisma.decisaoResolucaoReserva.count()).toBe(0);
});

it("consulta de resolução preserva escopo, histórico e decisão independente", async () => {
  const reserva = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  await prisma.reservaVagaMatricula.update({ where: { id: reserva.id }, data: { status: "MANTIDA_PENDENCIA" } });
  const p = await prepararResolucaoReserva({ reservaId: reserva.id, versaoAnterior: 0, tipo: "LIBERAR", motivo: "Solicitar liberação", tratamentoContratacao: "Conferir documentos e valores pelos fluxos próprios", chaveIdempotencia: "consulta-resolucao" });
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const consulta = await consultarResolucoesReserva({ reservaId: reserva.id });
  expect(consulta).toMatchObject({ ok: true, dado: { podePreparar: true, versaoAtual: 1, registros: [{ podeDecidir: false, podeAprovar: true }] } });
  if (!consulta.ok || !consulta.dado) throw new Error("Consulta ausente");
  expect(consulta.dado.registros[0]).not.toHaveProperty("snapshot");
  expect(consulta.dado.registros[0]).not.toHaveProperty("estadoHash");
  expect(consulta.dado.registros[0]).not.toHaveProperty("preparadorId");
  expect(await consultarResolucoesReserva({ reservaId: reserva.id, pagina: 2 })).toMatchObject({ ok: true, dado: { registros: [] } });
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  expect(await consultarResolucoesReserva({ reservaId: reserva.id })).toMatchObject({ ok: true, dado: { registros: [{ podeDecidir: true, podeAprovar: true }] } });
  await prisma.matricula.update({ where: { id: matriculas[0] }, data: { contratoOk: true } });
  expect(await consultarResolucoesReserva({ reservaId: reserva.id })).toMatchObject({ ok: true, dado: { registros: [{ podeAprovar: false }] } });
  expect((await decidirResolucaoReserva({ propostaId: p.dado.id, aprovar: false, motivo: "Rejeitar para nova conferência" })).ok).toBe(true);
  expect(await consultarResolucoesReserva({ reservaId: reserva.id })).toMatchObject({ ok: true, dado: { registros: [{ podeDecidir: false, decisao: { aprovada: false } }] } });
  const prof = await criarUsuario(["PROFESSOR"]); authMock.mockResolvedValue({ user: { id: prof.id } });
  expect((await consultarResolucoesReserva({ reservaId: reserva.id })).ok).toBe(false);
});

it("exige prazo configurado e conserva o prazo original em reenvio após alteração", async () => {
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoReservaMinutos: null } });
  await expect(prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)))).rejects.toThrow("Configure o prazo");
  expect(await prisma.reservaVagaMatricula.count()).toBe(0);
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoReservaMinutos: 90 } });
  const r = await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const reserva = await prisma.reservaVagaMatricula.findUniqueOrThrow({ where: { id: r.id } });
  expect(reserva.expiraEm.getTime() - reserva.criadaEm.getTime()).toBe(90 * 60000);
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoReservaMinutos: null } });
  expect(await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)))).toEqual(r);
  expect(await prisma.evento.findFirst({ where: { tipo: "VagaMatriculaReservada" } })).toMatchObject({ payload: { prazoMinutos: 90 } });
});

it("reserva pública usa carteira atual e recusa papel, contrato ou parâmetros indevidos", async () => {
  const titular = await criarUsuario(["VENDEDOR"]), outro = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Negociação fictícia", vendedorDonoId: titular.id } });
  await prisma.matricula.update({ where: { id: matriculas[0] }, data: { leadId: lead.id } });
  const entrada = { matriculaId: matriculas[0], turmaId, motivo: "Reservar contratação conferida", chaveIdempotencia: "reserva-publica" };
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await reservarVagaContratacao(entrada)).ok).toBe(false);
  expect(await prisma.reservaVagaMatricula.count()).toBe(0);
  authMock.mockResolvedValue({ user: { id: titular.id } });
  expect((await reservarVagaContratacao({ ...entrada, matriculaId: matriculas[1] })).ok).toBe(false);
  expect((await reservarVagaContratacao({ ...entrada, prazoMinutos: 999 } as typeof entrada)).ok).toBe(false);
  const r = await reservarVagaContratacao(entrada); expect(r.ok).toBe(true);
  expect(await reservarVagaContratacao(entrada)).toEqual(r);
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.alocacaoTurma.count()).toBe(0);
  expect(await prisma.matricula.count({ where: { status: "RASCUNHO" } })).toBe(2);
  await prisma.lead.update({ where: { id: lead.id }, data: { vendedorDonoId: outro.id } });
  expect((await reservarVagaContratacao(entrada)).ok).toBe(false);
  await prisma.usuario.update({ where: { id: titular.id }, data: { papeis: ["PROFESSOR"] } });
  expect((await reservarVagaContratacao(entrada)).ok).toBe(false);
});
it("Secretaria pode reservar preparação sem lead, usando o prazo institucional", async () => {
  const { autorId: ignorado, ...entrada } = dados(0);
  void ignorado;
  const r = await reservarVagaContratacao(entrada);
  expect(r.ok).toBe(true);
  expect(await prisma.reservaVagaMatricula.findFirst()).toMatchObject({ preparadorId: autorId });
});

it.each(["cobertura", "gerencia"] as const)("autoriza reserva pelo vínculo vigente de %s e recusa após revogação", async (tipo) => {
  const titular = await criarUsuario(["VENDEDOR"]);
  const atendente = await criarUsuario([tipo === "gerencia" ? "GERENTE_COMERCIAL" : "VENDEDOR"]);
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  let coberturaId: string | undefined;
  if (tipo === "gerencia") await prisma.usuario.update({ where: { id: titular.id }, data: { gerenteComercialId: atendente.id } });
  else coberturaId = (await prisma.coberturaCarteira.create({ data: { titularId: titular.id, substitutoId: atendente.id, concedenteId: admin.id, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 600000), motivo: "Cobertura de teste" } })).id;
  const lead = await prisma.lead.create({ data: { nome: "Negociação da equipe", vendedorDonoId: titular.id } });
  await prisma.matricula.update({ where: { id: matriculas[0] }, data: { leadId: lead.id } });
  authMock.mockResolvedValue({ user: { id: atendente.id } });
  const entrada = { matriculaId: matriculas[0], turmaId, motivo: "Reserva pela equipe autorizada", chaveIdempotencia: "reserva-vinculo" };
  expect((await reservarVagaContratacao(entrada)).ok).toBe(true);
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).vendedorDonoId).toBe(titular.id);
  if (coberturaId) await prisma.coberturaCarteira.update({ where: { id: coberturaId }, data: { revogadaEm: new Date() } });
  else await prisma.usuario.update({ where: { id: titular.id }, data: { gerenteComercialId: null } });
  expect((await reservarVagaContratacao(entrada)).ok).toBe(false);
});

it("consulta comercial mostra disponibilidade atual sem expor outros contratos ou dados financeiros", async () => {
  const titular = await criarUsuario(["VENDEDOR"]), outro = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Negociação para consulta", vendedorDonoId: titular.id } });
  await prisma.matricula.update({ where: { id: matriculas[0] }, data: { leadId: lead.id } });
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await consultarTurmasParaReserva({ matriculaId: matriculas[0] })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: titular.id } });
  const r = await consultarTurmasParaReserva({ matriculaId: matriculas[0] });
  expect(r).toMatchObject({ ok: true, dado: { podeReservar: true, prazoMinutos: 60, registros: [{ id: turmaId, elegivel: true, vagas: 1, limiteEntrada: "2099-12-31" }] } });
  if (!r.ok || !r.dado) throw new Error("Consulta ausente");
  expect(r.dado.matricula).not.toHaveProperty("produto"); expect(r.dado.matricula).not.toHaveProperty("cobrancas");
  expect(await consultarTurmasParaReserva({ matriculaId: matriculas[0], pagina: 2 })).toMatchObject({ ok: true, dado: { registros: [], possuiMais: false } });
  const entrada = { matriculaId: matriculas[0], turmaId, motivo: "Reserva após consulta", chaveIdempotencia: "reserva-consulta" };
  expect((await reservarVagaContratacao(entrada)).ok).toBe(true);
  expect(await consultarTurmasParaReserva({ matriculaId: matriculas[0] })).toMatchObject({ ok: true, dado: { podeReservar: false, registros: [], reservas: [{ status: "ATIVA" }] } });
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await consultarTurmasParaReserva({ matriculaId: matriculas[1] })).toMatchObject({ ok: true, dado: { registros: [{ elegivel: false, vagas: 0, impedimentos: ["SEM_VAGA"] }] } });
});

it.each(["MENSALIDADE", "HORA_PARTICULAR"] as const)("prepara %s e reserva atomicamente reutilizando aluno sem cobrança", async (regime) => {
  const anterior = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Nova contratação", vendedorDonoId: vendedor.id } });
  const entrada = { autorId, leadId: lead.id, alunoId: anterior.alunoId, produtoId: anterior.produtoId, paisId: anterior.paisId, turmaId, regime, taxaProposta: "100.00", valorServicoProposto: "200.00", motivo: "Proposta comercial para conferência", chaveIdempotencia: "preparacao-atomica" };
  const alunos = await prisma.aluno.count();
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, entrada));
  expect(await prisma.$transaction((tx) => prepararContratacaoTx(tx, entrada))).toEqual(r);
  expect(await prisma.aluno.count()).toBe(alunos);
  expect(await prisma.matricula.findUnique({ where: { id: anterior.id } })).toEqual(anterior);
  expect(await prisma.matricula.findUnique({ where: { id: r.matriculaId } })).toMatchObject({ alunoId: anterior.alunoId, status: "RASCUNHO", leadId: lead.id });
  expect(await prisma.preparacaoComercialMatricula.findUnique({ where: { id: r.id } })).toMatchObject({ regime, referencias: { condicoesAprovadas: false, vendedorResponsavelId: vendedor.id } });
  expect(await prisma.reservaVagaMatricula.findUnique({ where: { id: r.reservaId } })).toMatchObject({ matriculaId: r.matriculaId, status: "ATIVA" });
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.alocacaoTurma.count()).toBe(0); expect(await prisma.comissao.count()).toBe(0);
  await expect(prisma.preparacaoComercialMatricula.updateMany({ data: { motivo: "Alterar histórico" } })).rejects.toThrow();
  await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, { ...entrada, taxaProposta: "99" }))).rejects.toThrow("Chave");
});
it("falha da reserva desfaz também a nova matrícula e a preparação", async () => {
  await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const anterior = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[1] } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Contratação sem vaga", vendedorDonoId: vendedor.id } });
  const entrada = { autorId, leadId: lead.id, alunoId: anterior.alunoId, produtoId: anterior.produtoId, paisId: anterior.paisId, turmaId, regime: "MENSALIDADE" as const, taxaProposta: "100", valorServicoProposto: "200", motivo: "Proposta sem vaga disponível", chaveIdempotencia: "preparacao-sem-vaga" };
  await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, entrada))).rejects.toThrow("SEM_VAGA");
  expect(await prisma.matricula.count()).toBe(2); expect(await prisma.preparacaoComercialMatricula.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "ContratacaoPreparada" } })).toBe(0);
});

it("preparação pública exige seleção explícita entre candidatos do contato autorizado", async () => {
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const outroContrato = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[1] } });
  const vendedor = await criarUsuario(["VENDEDOR"]), outro = await criarUsuario(["VENDEDOR"]);
  const telefoneE164 = "+50688887777";
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { telefoneE164 } });
  const familiar = await prisma.aluno.create({ data: { primeiroNome: "Familiar", paisId: m.paisId, telefoneE164 } });
  const lead = await prisma.lead.create({ data: { nome: "Nova negociação", telefoneE164, vendedorDonoId: vendedor.id } });
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await consultarCadastrosPreparacao({ leadId: lead.id })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  const consulta = await consultarCadastrosPreparacao({ leadId: lead.id });
  if (!consulta.ok || !consulta.dado) throw new Error("Consulta ausente");
  expect(consulta.dado.candidatos.map((a) => a.id).sort()).toEqual([m.alunoId, familiar.id].sort());
  expect(Object.keys(consulta.dado.candidatos[0]).sort()).toEqual(["id", "primeiroNome", "sobrenome"]);
  expect(await consultarCadastrosPreparacao({ leadId: lead.id, pagina: 2 })).toMatchObject({ ok: true, dado: { candidatos: [], possuiMais: false, podeCadastrarNovo: false } });
  const entrada = { leadId: lead.id, alunoId: m.alunoId, produtoId: m.produtoId, paisId: m.paisId, turmaId, regime: "MENSALIDADE" as const, taxaProposta: "100", valorServicoProposto: "200", motivo: "Identidade conferida com cliente", chaveIdempotencia: "preparacao-publica", identidadeConferida: true as const };
  expect((await prepararContratacao({ ...entrada, identidadeConferida: false } as unknown as typeof entrada)).ok).toBe(false);
  expect((await prepararContratacao({ ...entrada, alunoId: outroContrato.alunoId })).ok).toBe(false);
  expect(await prisma.preparacaoComercialMatricula.count()).toBe(0);
  const resultado = await prepararContratacao(entrada); expect(resultado.ok).toBe(true);
  expect(await prepararContratacao(entrada)).toEqual(resultado);
  await prisma.lead.update({ where: { id: lead.id }, data: { telefoneE164: null } });
  expect(await prepararContratacao(entrada)).toEqual(resultado);
  expect(await prisma.evento.count({ where: { tipo: "IdentidadeContratacaoSelecionada" } })).toBe(1);
  expect(await prisma.matricula.count({ where: { alunoId: m.alunoId } })).toBe(2);
  expect(await prisma.matricula.findUnique({ where: { id: outroContrato.id } })).toEqual(outroContrato);
  expect(await prisma.cobranca.count()).toBe(0);
});
it("contato ausente não produz candidatos nem associação implícita", async () => {
  const lead = await prisma.lead.create({ data: { nome: "Sem contato" } });
  expect(await consultarCadastrosPreparacao({ leadId: lead.id })).toMatchObject({ ok: true, dado: { contatoConferivel: false, candidatos: [], matriculaId: null } });
  expect(await prisma.preparacaoComercialMatricula.count()).toBe(0);
});

it("ofertas da preparação respeitam acesso, paginação e disponibilidade", async () => {
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]), outro = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Consultar oferta", vendedorDonoId: vendedor.id } });
  const oferta = await prisma.produtoPais.findUniqueOrThrow({ where: { produtoId_paisId: { produtoId: m.produtoId, paisId: m.paisId } } });
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await consultarOfertasPreparacao({ leadId: lead.id })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarOfertasPreparacao({ leadId: lead.id, ofertaId: oferta.id })).toMatchObject({ ok: true, dado: { selecionada: { id: oferta.id, moedaCoerente: true }, prazoMinutos: 60, turmas: [{ id: turmaId, elegivel: true, vagas: 1 }] } });
  expect(await consultarOfertasPreparacao({ leadId: lead.id, pagina: 2, paginaTurmas: 2, ofertaId: oferta.id })).toMatchObject({ ok: true, dado: { ofertas: [], turmas: [] } });
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { oferecido: false } });
  expect((await consultarOfertasPreparacao({ leadId: lead.id, ofertaId: oferta.id })).ok).toBe(false);
});

it("pessoa nova é criada junto da preparação, sem duplicar no reenvio", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Pessoa nova", telefoneE164: "+50688886666", vendedorDonoId: vendedor.id } });
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarCadastrosPreparacao({ leadId: lead.id })).toMatchObject({ ok: true, dado: { podeCadastrarNovo: true, candidatos: [] } });
  const entrada = { leadId: lead.id, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE" as const, taxaProposta: "100", valorServicoProposto: "200", motivo: "Cadastro básico conferido", chaveIdempotencia: "nova-pessoa", cadastroNovoConferido: true as const, novoCadastro: { primeiroNome: "Nova", sobrenome: "Pessoa", paisId: base.paisId, email: "nova@example.test" } };
  expect((await prepararContratacaoNovaPessoa({ ...entrada, cadastroNovoConferido: false } as unknown as typeof entrada)).ok).toBe(false);
  const r = await prepararContratacaoNovaPessoa(entrada); expect(r.ok).toBe(true);
  expect(await prepararContratacaoNovaPessoa(entrada)).toEqual(r);
  expect(await prisma.aluno.count()).toBe(3);
  expect(await prisma.aluno.findFirst({ where: { email: "nova@example.test" } })).toMatchObject({ telefoneE164: lead.telefoneE164, primeiroNome: "Nova" });
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "CadastroInicialContratacaoCriado" } })).toBe(1);
  const outro = await prisma.lead.create({ data: { nome: "Repetida", telefoneE164: lead.telefoneE164, vendedorDonoId: vendedor.id } });
  expect((await prepararContratacaoNovaPessoa({ ...entrada, leadId: outro.id, chaveIdempotencia: "outra-pessoa" })).ok).toBe(false);
  const email = await prisma.lead.create({ data: { nome: "Outro contato", telefoneE164: "+50688885555", vendedorDonoId: vendedor.id } });
  expect((await prepararContratacaoNovaPessoa({ ...entrada, leadId: email.id, chaveIdempotencia: "email-existente", novoCadastro: { ...entrada.novoCadastro, email: "NOVA@example.test" } })).ok).toBe(false);
  expect(await prisma.aluno.count()).toBe(3);
});
it("falha na vaga não deixa cadastro inicial órfão", async () => {
  await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Sem vaga", telefoneE164: "+50688883333", vendedorDonoId: vendedor.id } });
  const r = await prepararContratacaoNovaPessoa({ leadId: lead.id, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "100", valorServicoProposto: "200", motivo: "Cadastro sem vaga", chaveIdempotencia: "nova-sem-vaga", cadastroNovoConferido: true, novoCadastro: { primeiroNome: "Sem vaga", paisId: base.paisId } });
  expect(r.ok).toBe(false);
  expect(await prisma.aluno.count()).toBe(2); expect(await prisma.matricula.count()).toBe(2); expect(await prisma.preparacaoComercialMatricula.count()).toBe(0);
});

it("revisão projeta proposta e referências históricas sem abrir outros contratos", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]), outro = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Revisar proposta", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "123.45", valorServicoProposto: "300", motivo: "Proposta para revisão", chaveIdempotencia: "revisao-preparacao" }));
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  const antes = await consultarPreparacaoContratacao({ matriculaId: r.matriculaId });
  expect(antes).toMatchObject({ ok: true, dado: { preparacao: { taxaProposta: "123.45", valorServicoProposto: "300", condicoesAprovadas: false, referenciasConferiveis: true } } });
  if (!antes.ok || !antes.dado?.preparacao) throw new Error("Proposta ausente");
  expect(antes.dado.preparacao.alcada?.componentes).toHaveLength(2);
  await prisma.usuario.update({ where: { id: autorId }, data: { limiteDescontoTaxaPct: 99, limiteDescontoMensalidadePct: 99 } });
  expect(antes.dado.preparacao).not.toHaveProperty("referencias"); expect(antes.dado.preparacao).not.toHaveProperty("entradaHash");
  expect(antes.dado.matricula).not.toHaveProperty("cobrancas");
  await prisma.precoReferencia.updateMany({ where: { produtoId: base.produtoId }, data: { valor: 999 } });
  const depois = await consultarPreparacaoContratacao({ matriculaId: r.matriculaId });
  expect(depois).toEqual(antes);
  expect((await consultarPreparacaoContratacao({ matriculaId: base.id })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await consultarPreparacaoContratacao({ matriculaId: base.id })).toMatchObject({ ok: true, dado: { preparacao: null } });
  const professor = await criarUsuario(["PROFESSOR"]); authMock.mockResolvedValue({ user: { id: professor.id } });
  expect((await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).ok).toBe(false);
});

it.each(["ADMINISTRADOR", "GERENTE_COMERCIAL"] as const)("%s decide exceção de preço sem alterar cobranças ou autoaprovar", async (papel) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const decisor = await criarUsuario([papel]), titular = await criarUsuario(["VENDEDOR"]);
  await prisma.usuario.update({ where: { id: titular.id }, data: { gerenteComercialId: decisor.id } });
  const lead = await prisma.lead.create({ data: { nome: "Exceção comercial", vendedorDonoId: titular.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "1", valorServicoProposto: "1", motivo: "Exceção de desconto solicitada", chaveIdempotencia: "preco-excecao" }));
  const d = { preparacaoId: r.id, aprovar: true, motivo: "Conferência independente do preço" };
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { decisaoDisponivel: { podeAprovar: false, podeRejeitar: false } } } });
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["ADMINISTRADOR"] } });
  expect((await decidirPrecoPreparacao(d)).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: decisor.id } });
  if (papel === "GERENTE_COMERCIAL") {
    expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { decisaoDisponivel: { podeAprovar: false, podeRejeitar: true } } } });
    const fora = await criarUsuario(["SECRETARIA_ACADEMICA", "GERENTE_COMERCIAL"]);
    authMock.mockResolvedValue({ user: { id: fora.id } });
    expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { decisaoDisponivel: { podeAprovar: false, podeRejeitar: false } } } });
    authMock.mockResolvedValue({ user: { id: decisor.id } });
    expect((await decidirPrecoPreparacao(d)).ok).toBe(false);
    await prisma.usuario.update({ where: { id: decisor.id }, data: { limiteDescontoTaxaPct: 100, limiteDescontoMensalidadePct: 100 } });
  }
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { decisaoDisponivel: { podeAprovar: true, podeRejeitar: true } } } });
  const resultado = await decidirPrecoPreparacao(d); expect(resultado.ok).toBe(true);
  expect(await decidirPrecoPreparacao(d)).toEqual(resultado);
  expect(await prisma.decisaoPrecoPreparacao.count()).toBe(1);
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { decisaoDisponivel: { podeAprovar: false, podeRejeitar: false }, decisaoPreco: { aprovada: true } } } });
  expect(await prisma.cobranca.count()).toBe(0);
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).status).toBe("RASCUNHO");
  await expect(prisma.decisaoPrecoPreparacao.updateMany({ data: { aprovada: false } })).rejects.toThrow();
});

it.each([true, false])("confirmação e ativação respeitam decisão de preço aprovada=%s", async (aprovar) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const admin = await criarUsuario(["ADMINISTRADOR"]), vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Conferir preço", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "1", valorServicoProposto: "1", motivo: "Preço exige decisão independente", chaveIdempotencia: "preco-conferencia" }));
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date(), secretariaResponsavelId: autorId } });
  const conferir = () => prisma.$transaction((tx) => exigirPrecoPreparacaoAutorizado(tx, r.matriculaId));
  await expect(conferir()).rejects.toThrow("aprovação independente");
  expect(await confirmarContratoMatricula(r.matriculaId, "inexistente", [])).toMatchObject({ ok: false });
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } });
  await expect(prisma.$transaction((tx) => exigirContratoAceito(tx, m))).rejects.toThrow("aprovação independente");
  authMock.mockResolvedValue({ user: { id: admin.id } });
  expect((await decidirPrecoPreparacao({ preparacaoId: r.id, aprovar, motivo: "Decisão administrativa independente" })).ok).toBe(true);
  if (aprovar) {
    await expect(conferir()).resolves.toBeUndefined();
    // Preço autorizado não substitui evidência de aceite.
    await expect(prisma.$transaction((tx) => exigirContratoAceito(tx, m))).rejects.toThrow("contrato precisa estar aceito");
  } else {
    await expect(conferir()).rejects.toThrow("rejeitada");
    await expect(prisma.$transaction((tx) => exigirContratoAceito(tx, m))).rejects.toThrow("rejeitada");
  }
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).contratoOk).toBe(false);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("preço dentro da alçada dispensa exceção sem alterar fluxo legado", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Preço integral", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "999999", valorServicoProposto: "999999", motivo: "Condições sem desconto proposto", chaveIdempotencia: "preco-sem-excecao" }));
  await expect(prisma.$transaction((tx) => exigirPrecoPreparacaoAutorizado(tx, r.matriculaId))).resolves.toBeUndefined();
  await expect(prisma.$transaction((tx) => exigirPrecoPreparacaoAutorizado(tx, base.id))).resolves.toBeUndefined();
  expect(await prisma.decisaoPrecoPreparacao.count()).toBe(0);
});

it("regras da oferta exigem Administração, evitam edição perdida e preservam preparação", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const oferta = await prisma.produtoPais.findUniqueOrThrow({ where: { produtoId_paisId: { produtoId: base.produtoId, paisId: base.paisId } } });
  const admin = await criarUsuario(["ADMINISTRADOR"]), vendedor = await criarUsuario(["VENDEDOR"]);
  const entrada = { ofertaId: oferta.id, versaoEsperada: 0, formaAgenda: "TURMA" as const, taxaPreviaAssinatura: true, adiantamentoHoraExigido: false, motivo: "Condições da oferta conferidas" };
  expect(oferta.formaAgenda).toBeNull(); expect(oferta.taxaPreviaAssinatura).toBeNull(); expect(oferta.adiantamentoHoraExigido).toBeNull();
  expect((await configurarEntradaOferta(entrada)).ok).toBe(false);
  await expect(consultarEntradasOfertas()).rejects.toThrow();
  authMock.mockResolvedValue({ user: { id: admin.id } });
  expect((await configurarEntradaOferta(entrada)).ok).toBe(true);
  expect((await configurarEntradaOferta({ ...entrada, taxaPreviaAssinatura: false })).ok).toBe(false);
  const lead = await prisma.lead.create({ data: { nome: "Política histórica", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "100", valorServicoProposto: "200", motivo: "Preparar com regra vigente", chaveIdempotencia: "politica-entrada" }));
  expect((await configurarEntradaOferta({ ...entrada, versaoEsperada: 1, formaAgenda: "PARTICULAR_FLEXIVEL", taxaPreviaAssinatura: false, adiantamentoHoraExigido: true })).ok).toBe(true);
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { politicaEntrada: { formaAgenda: "TURMA", versao: 1, taxaPreviaAssinatura: true, adiantamentoHoraExigido: false } } } });
  expect((await consultarEntradasOfertas())[0]).toMatchObject({ formaAgenda: "PARTICULAR_FLEXIVEL", versaoEntrada: 2, taxaPreviaAssinatura: false, adiantamentoHoraExigido: true });
  expect(await prisma.evento.count({ where: { tipo: "EntradaOfertaConfigurada" } })).toBe(2);
  expect(await prisma.cobranca.count()).toBe(0);
  await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } });
  expect((await configurarEntradaOferta({ ...entrada, versaoEsperada: 2 })).ok).toBe(false);
});

it.each([true, false])("ativação conserva exigência inicial mensal=%s após mudar configuração", async (exigir) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { exigirPrimeiraMensalidade: exigir } });
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Entrada mensal", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "100", valorServicoProposto: "200", motivo: "Regra inicial registrada", chaveIdempotencia: "entrada-mensal" }));
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { exigirPrimeiraMensalidade: !exigir } });
  await expect(prisma.$transaction((tx) => exigirEntradaMensalRegistrada(tx, r.matriculaId))).resolves.toBe(exigir);
  await expect(prisma.$transaction((tx) => exigirEntradaMensalRegistrada(tx, base.id))).resolves.toBe(!exigir);
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { politicaEntrada: { exigirPrimeiraMensalidade: exigir } } } });
});

it.each(["MENSALIDADE", "HORA_PARTICULAR"] as const)("ativação não inventa condições de entrada para %s", async (regime) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Entrada incompleta", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime, taxaProposta: "100", valorServicoProposto: "200", motivo: "Preparação ainda pendente", chaveIdempotencia: "entrada-pendente" }));
  // Editar a oferta depois não completa o snapshot da negociação.
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
  const resultado = await concluirMatricula(r.matriculaId);
  expect(resultado.ok).toBe(false);
  if (!resultado.ok) expect(resultado.erro).toContain(regime === "MENSALIDADE" ? "assumida pela Secretaria" : "horários reservados");
  await expect(prisma.$transaction(tx => exigirEntradaMensalRegistrada(tx, r.matriculaId))).rejects.toThrow(regime === "MENSALIDADE" ? "regras de entrada" : "ativação própria");
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).status).toBe("RASCUNHO");
  expect(await prisma.cobranca.count()).toBe(0);
});

it("preparação por hora registra adiantamento explícito e não cobra no reenvio", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.produtoPais.updateMany({ data: { adiantamentoHoraExigido: true } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Adiantamento", vendedorDonoId: vendedor.id } });
  const entrada = { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "HORA_PARTICULAR" as const, taxaProposta: "100", valorServicoProposto: "120", motivo: "Antecipação de tempo identificado", chaveIdempotencia: "adiantamento-horas" };
  await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, entrada))).rejects.toThrow("Informe os minutos");
  expect(await prisma.preparacaoComercialMatricula.count()).toBe(0);
  const d = { ...entrada, minutosAdiantamento: 75 };
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, d));
  expect(await prisma.$transaction((tx) => prepararContratacaoTx(tx, d))).toEqual(r);
  await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, { ...d, minutosAdiantamento: 90 }))).rejects.toThrow("Chave");
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { adiantamentoProposto: { minutos: 75, valorHora: "120", valor: "150.00" } } } });
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.compraHorasAntecipadas.count()).toBe(0);
});

it("pagador pertence à preparação da matrícula, com versões e acesso administrativo", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const alunoAntes = await prisma.aluno.findUniqueOrThrow({ where: { id: base.alunoId } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Empresa pagadora", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "100", valorServicoProposto: "200", motivo: "Preparação individual corporativa", chaveIdempotencia: "preparacao-pagador" }));
  const d = { matriculaId: r.matriculaId, versaoEsperada: 0, pagador: { tipo: "EMPRESA" as const, dados: { nome: "Empresa de teste", paisId: base.paisId, documento: "DOC-EMPRESA", email: "financeiro@example.test" } }, motivo: "Empresa pagará este contrato", chaveIdempotencia: "pagador-empresa" };
  expect((await registrarPagadorPreparacao(d)).ok).toBe(false);
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await registrarPagadorPreparacao(d)).ok).toBe(false);
  expect((await consultarPagadorPreparacao(r.matriculaId)).ok).toBe(false);
  expect((await consultarTelaPagador(r.matriculaId)).ok).toBe(false);
  expect((await consultarHistoricoPagador({ matriculaId: r.matriculaId })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await consultarTelaPagador(r.matriculaId)).toMatchObject({ ok: true, dado: { podeEditar: true, registro: null } });
  const salvo = await registrarPagadorPreparacao(d); expect(salvo.ok).toBe(true);
  expect(await registrarPagadorPreparacao(d)).toEqual(salvo);
  expect(await consultarPagadorPreparacao(r.matriculaId)).toMatchObject({ ok: true, dado: { versao: 1, tipo: "EMPRESA", dados: { documento: "DOC-EMPRESA" } } });
  expect(await consultarPagadorPreparacao(base.id)).toMatchObject({ ok: true, dado: null });
  expect((await registrarPagadorPreparacao({ ...d, chaveIdempotencia: "pagador-desatualizado" })).ok).toBe(false);
  expect((await registrarPagadorPreparacao({ ...d, versaoEsperada: 1, pagador: { tipo: "ALUNO" }, chaveIdempotencia: "pagador-aluno" })).ok).toBe(true);
  expect(await consultarPagadorPreparacao(r.matriculaId)).toMatchObject({ ok: true, dado: { versao: 2, tipo: "ALUNO", dados: { alunoId: base.alunoId } } });
  const financeiro = await criarUsuario(["FINANCEIRO"]);
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
  expect(await consultarTelaPagador(r.matriculaId)).toMatchObject({ ok: true, dado: { podeEditar: false, paises: [], registro: { versao: 2, tipo: "ALUNO" } } });
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await consultarHistoricoPagador({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { temProxima: false, registros: [{ versao: 2, tipo: "ALUNO" }, { versao: 1, tipo: "EMPRESA" }] } });
  expect(await consultarHistoricoPagador({ matriculaId: base.id })).toMatchObject({ ok: true, dado: { registros: [] } });
  expect(await consultarHistoricoPagador({ matriculaId: r.matriculaId, pagina: 2 })).toMatchObject({ ok: true, dado: { registros: [] } });
  expect((await consultarHistoricoPagador({ matriculaId: r.matriculaId, pagina: 0 })).ok).toBe(false);
  expect(await prisma.pagadorPreparacaoMatricula.count()).toBe(2);
  await expect(prisma.pagadorPreparacaoMatricula.updateMany({ data: { tipo: "EMPRESA" } })).rejects.toThrow("imutável");
  await expect(prisma.pagadorPreparacaoMatricula.deleteMany()).rejects.toThrow("imutável");
  expect(await prisma.aluno.findUniqueOrThrow({ where: { id: base.alunoId } })).toEqual(alunoAntes);
  expect(await prisma.alunoResponsavel.count()).toBe(0);
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { contratoOk: true } });
  expect((await registrarPagadorPreparacao({ ...d, versaoEsperada: 2, chaveIdempotencia: "pagador-apos-aceite" })).ok).toBe(false);
  expect(await consultarTelaPagador(r.matriculaId)).toMatchObject({ ok: true, dado: { podeEditar: false, paises: [] } });
  expect(await prisma.cobranca.count()).toBe(0);
});

it("histórico do pagador pagina sem perder ou repetir versões", async () => {
  await prisma.pagadorPreparacaoMatricula.createMany({ data: Array.from({ length: 21 }, (_, i) => ({ matriculaId: matriculas[0], preparadorId: autorId, versao: i + 1, tipo: "EMPRESA", dados: { nome: `Empresa ${i + 1}`, paisId: "fixture" }, motivo: "Fixture histórico paginado", chaveIdempotencia: `historico-pagador-${i}`, entradaHash: "fixture" })) });
  const a = await consultarHistoricoPagador({ matriculaId: matriculas[0] }), b = await consultarHistoricoPagador({ matriculaId: matriculas[0], pagina: 2 });
  if (!a.ok || !b.ok || !a.dado || !b.dado) throw new Error("Histórico indisponível");
  expect(a.dado.temProxima).toBe(true); expect(a.dado.registros).toHaveLength(20);
  expect(b.dado.temProxima).toBe(false); expect(b.dado.registros.map((r) => r.versao)).toEqual([1]);
  expect([...a.dado.registros, ...b.dado.registros].map((r) => r.versao)).toEqual(Array.from({ length: 21 }, (_, i) => 21 - i));
  expect(a.dado.registros[0]).not.toHaveProperty("entradaHash"); expect(a.dado.registros[0]).not.toHaveProperty("chaveIdempotencia");
});

it("diagnóstico confere a própria reserva sem tratá-la como vaga de outro aluno", async () => {
  await prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(0)));
  const r = await consultarPendenciasPreparacao(matriculas[0]);
  if (!r.ok || !r.dado) throw new Error("Diagnóstico indisponível");
  const codigos = r.dado.pendencias.map((p) => p.codigo);
  expect(codigos).toContain("PROPOSTA"); expect(codigos).toContain("PAGADOR");
  expect(codigos).not.toContain("AGENDA_SEM_VAGA"); expect(r.dado.emissaoAutorizada).toBe(false);
  await prisma.turma.update({ where: { id: turmaId }, data: { status: "CONCLUIDA" } });
  const encerrada = await consultarPendenciasPreparacao(matriculas[0]);
  expect(encerrada).toMatchObject({ ok: true, dado: { pendencias: expect.arrayContaining([expect.objectContaining({ codigo: "AGENDA_TURMA_CONCLUIDA" })]) } });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await consultarPendenciasPreparacao(matriculas[0])).ok).toBe(false);
  expect(await prisma.cobranca.count()).toBe(0);
});

it.each(["MENSALIDADE", "HORA_PARTICULAR"] as const)("condições de entrada de %s preservam referências sem gerar cobrança", async (regime) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]), admin = await criarUsuario(["ADMINISTRADOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Condições explícitas", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime, taxaProposta: "999999", valorServicoProposto: "999999", motivo: "Condições propostas para conferência", chaveIdempotencia: "condicoes-preparacao" }));
  if (regime === "HORA_PARTICULAR") {
    authMock.mockResolvedValue({ user: { id: admin.id } });
    expect((await decidirPrecoPreparacao({ preparacaoId: r.id, aprovar: true, motivo: "Referência por hora conferida" })).ok).toBe(true);
    authMock.mockResolvedValue({ user: { id: autorId } });
  }
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  const pagador = await registrarPagadorPreparacao({ matriculaId: r.matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Próprio aluno pagador", chaveIdempotencia: "pagador-condicoes" });
  if (!pagador.ok || !pagador.dado) throw new Error("Pagador não registrado");
  const aulas = regime === "MENSALIDADE" ? { regime, cobertura: { referencia: "CICLO_MATRICULA" as const, inicio: "2099-01-31" }, primeiroVencimento: "2099-02-05", diaVencimentoContratado: 31 } : { regime };
  const d = { matriculaId: r.matriculaId, pagadorRegistroId: pagador.dado.id, versaoEsperada: 0, taxaVencimento: "2099-01-05", aulas, motivo: "Datas conferidas pela secretaria", chaveIdempotencia: "condicoes-entrada" };
  expect((await registrarCondicoesEntrada({ ...d, pagadorRegistroId: "outro" })).ok).toBe(false);
  const salvo = await registrarCondicoesEntrada(d); expect(salvo.ok).toBe(true);
  expect(await registrarCondicoesEntrada(d)).toEqual(salvo);
  expect((await registrarCondicoesEntrada({ ...d, taxaVencimento: "2099-01-06" })).ok).toBe(false);
  const registro = await prisma.condicoesEntradaPreparacao.findFirstOrThrow();
  expect(registro.dados).toMatchObject({ preparacaoId: r.id, pagadorRegistroId: pagador.dado.id, aulas: { regime }, taxaProposta: "999999" });
  expect(await consultarCondicoesEntrada(r.matriculaId)).toMatchObject({ ok: true, dado: { podeEditar: true, pagadorAlterado: false, registro: { versao: 1, dados: { aulas: { regime } } } } });
  const financeiro = await criarUsuario(["FINANCEIRO"]); authMock.mockResolvedValue({ user: { id: financeiro.id } });
  expect(await consultarCondicoesEntrada(r.matriculaId)).toMatchObject({ ok: true, dado: { podeEditar: false } });
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect((await registrarPagadorPreparacao({ matriculaId: r.matriculaId, versaoEsperada: 1, pagador: { tipo: "ALUNO" }, motivo: "Atualizar dados conferidos", chaveIdempotencia: "pagador-nova-versao" })).ok).toBe(true);
  expect(await consultarCondicoesEntrada(r.matriculaId)).toMatchObject({ ok: true, dado: { pagadorAlterado: true } });
  if (regime === "MENSALIDADE") expect(registro.dados).toMatchObject({ coberturaCalculada: { inicio: "2099-01-31", fim: "2099-02-27" } });
  await expect(prisma.condicoesEntradaPreparacao.updateMany({ data: { motivo: "alterar" } })).rejects.toThrow("imutáveis");
  expect(await prisma.cobranca.count()).toBe(0);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await registrarCondicoesEntrada(d)).ok).toBe(false);
  expect((await consultarCondicoesEntrada(r.matriculaId)).ok).toBe(false);
});

it.each([true, false])("emissão inicial mensal exigida=%s é atômica e não duplica", async (exigir) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { exigirPrimeiraMensalidade: exigir, fusoInstitucional: "America/Costa_Rica" } });
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Emitir entrada", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "999999", valorServicoProposto: "999999", motivo: "Proposta de emissão inicial", chaveIdempotencia: "emitir-preparacao" }));
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  const p = await registrarPagadorPreparacao({ matriculaId: r.matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Pagador deste contrato", chaveIdempotencia: "emitir-pagador" });
  if (!p.ok || !p.dado) throw new Error("Pagador ausente");
  const c = await registrarCondicoesEntrada({ matriculaId: r.matriculaId, pagadorRegistroId: p.dado.id, versaoEsperada: 0, taxaVencimento: "2099-09-01", aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 }, motivo: "Condições de teste conferidas", chaveIdempotencia: "emitir-condicoes" });
  if (!c.ok || !c.dado) throw new Error("Condições ausentes");
  const entrada = { matriculaId: r.matriculaId, condicoesId: c.dado.id, executorId: autorId, etapa: "CONFERENCIA_SECRETARIA" as const };
  await expect(prisma.$transaction(async (tx) => { await emitirEntradaTx(tx, entrada); throw new Error("Falha após emissão"); })).rejects.toThrow("Falha após emissão");
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.emissaoCobrancasEntrada.count()).toBe(0);
  const emitida = await prisma.$transaction((tx) => emitirEntradaTx(tx, entrada));
  expect(await prisma.$transaction((tx) => emitirEntradaTx(tx, entrada))).toEqual(emitida);
  expect(await prisma.cobranca.count()).toBe(exigir ? 2 : 1);
  expect(await prisma.itemEmissaoEntrada.count()).toBe(exigir ? 2 : 1);
  const vinculo = await prisma.itemEmissaoEntrada.findFirstOrThrow();
  await expect(prisma.cobranca.delete({ where: { id: vinculo.cobrancaId } })).rejects.toThrow();
  await expect(prisma.cobranca.update({ where: { id: vinculo.cobrancaId }, data: { matriculaId: base.id } })).rejects.toThrow();
  await expect(prisma.itemEmissaoEntrada.deleteMany()).rejects.toThrow("imutável");
  await expect(prisma.itemEmissaoEntrada.updateMany({ data: { matriculaId: base.id } })).rejects.toThrow("imutável");
  expect(await prisma.cobranca.count({ where: { status: "PAGO" } })).toBe(0);
  expect(await prisma.recebimento.count()).toBe(0);
  expect((await prisma.cobranca.findFirstOrThrow({ where: { tipo: "MATRICULA" } })).vencimento.toISOString()).toBe("2099-09-01T18:00:00.000Z");
  await expect(prisma.$transaction((tx) => emitirEntradaTx(tx, { ...entrada, executorId: vendedor.id }))).rejects.toThrow("permissão");
  await expect(prisma.emissaoCobrancasEntrada.deleteMany()).rejects.toThrow("imutável");
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).status).toBe("RASCUNHO");
});

it("conferência pública revalida dados revisados e registra emissão sem duplicar", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { email: "aluno@example.test" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Conferência pública", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "999999", valorServicoProposto: "999999", motivo: "Contratação para conferência", chaveIdempotencia: "conferencia-preparacao" }));
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  const p = await registrarPagadorPreparacao({ matriculaId: r.matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Conferir próprio aluno pagador", chaveIdempotencia: "conferencia-pagador" });
  if (!p.ok || !p.dado) throw new Error("Pagador ausente");
  expect((await registrarCondicoesEntrada({ matriculaId: r.matriculaId, pagadorRegistroId: p.dado.id, versaoEsperada: 0, taxaVencimento: "2099-09-01", aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 }, motivo: "Datas de entrada conferidas", chaveIdempotencia: "conferencia-condicoes" })).ok).toBe(true);
  expect(await consultarTelaEmissao(r.matriculaId)).toMatchObject({ ok: true, dado: { estado: "REVISAO", revisao: { dados: { pagador: { tipo: "ALUNO" } } } } });
  const revisao = await consultarRevisaoEmissao(r.matriculaId);
  if (!revisao.ok || !revisao.dado) throw new Error("Revisão ausente");
  const d = { matriculaId: r.matriculaId, revisaoHash: revisao.dado.hash, cadastroDocumentosConferidos: true as const, condicoesConferidas: true as const, motivo: "Documentos e condições conferidos", chaveIdempotencia: "conferencia-emitir" };
  expect((await conferirEEmitirEntrada({ ...d, condicoesConferidas: false } as unknown as typeof d)).ok).toBe(false);
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { sobrenome: "Alterado após revisão" } });
  expect(await conferirEEmitirEntrada(d)).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
  expect(await prisma.cobranca.count()).toBe(0);
  const atual = await consultarRevisaoEmissao(r.matriculaId);
  if (!atual.ok || !atual.dado) throw new Error("Revisão atual ausente");
  const entrada = { ...d, revisaoHash: atual.dado.hash };
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await consultarRevisaoEmissao(r.matriculaId)).ok).toBe(false); expect((await conferirEEmitirEntrada(entrada)).ok).toBe(false);
  expect((await consultarTelaEmissao(r.matriculaId)).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect((await consultarTelaEmissao(r.matriculaId)).ok).toBe(true);
  const feita = await conferirEEmitirEntrada(entrada); expect(feita.ok).toBe(true);
  expect(await consultarTelaEmissao(r.matriculaId)).toMatchObject({ ok: true, dado: { estado: "EMITIDA", registro: { cobrancas: [{ tipo: "MATRICULA" }] } } });
  expect(await conferirEEmitirEntrada(entrada)).toEqual(feita);
  expect(await prisma.cobranca.count()).toBe(1); expect(await prisma.conferenciaEmissaoInicial.count()).toBe(1);
  expect(await prisma.recebimento.count()).toBe(0);
  await expect(prisma.conferenciaEmissaoInicial.deleteMany()).rejects.toThrow("imutável");
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).status).toBe("RASCUNHO");
});

it.each([
  { taxaPreviaAssinatura: false, ambiente: "SANDBOX" as const }, { taxaPreviaAssinatura: true, ambiente: "SANDBOX" as const },
  { taxaPreviaAssinatura: false, ambiente: "PRODUCAO" as const }, { taxaPreviaAssinatura: true, ambiente: "PRODUCAO" as const },
])("prévia e assinatura conferem fontes, reserva e taxa prévia=$taxaPreviaAssinatura, ambiente=$ambiente", async ({ taxaPreviaAssinatura, ambiente }) => {
  if (ambiente === "PRODUCAO") await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { exigirPrimeiraMensalidade: taxaPreviaAssinatura } });
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { email: "aluno@example.test", documento: "ALUNO-TESTE" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura, adiantamentoHoraExigido: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Conferência pública", vendedorDonoId: vendedor.id } });
  const r = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "999999", valorServicoProposto: "999999", motivo: "Contratação para conferência", chaveIdempotencia: "conferencia-preparacao" }));
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  const p = await registrarPagadorPreparacao({ matriculaId: r.matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Conferir próprio aluno pagador", chaveIdempotencia: "conferencia-pagador" });
  if (!p.ok || !p.dado) throw new Error("Pagador ausente");
  expect((await registrarCondicoesEntrada({ matriculaId: r.matriculaId, pagadorRegistroId: p.dado.id, versaoEsperada: 0, taxaVencimento: "2099-09-01", aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 }, motivo: "Datas de entrada conferidas", chaveIdempotencia: "conferencia-condicoes" })).ok).toBe(true);

  const proposta = await prepararModeloContratual({ codigo: "CONTRATO_TESTE", versaoEsperada: 0, motivo: "Conteúdo exclusivamente de teste", chaveIdempotencia: "previa-modelo", conteudo: {
    titulo: "Contrato {{nome}}", finalidade: "CONTRATO", regimes: ["MENSALIDADE"], aplicacao: "Teste da prévia mensal", campos: [{ chave: "nome", descricao: "Nome do aluno", origem: "ALUNO_NOME" }, { chave: "valor", descricao: "Preço mensal", origem: "MENSALIDADE_VALOR" }],
    secoes: [{ titulo: "Condições", texto: "{{nome}}; mensalidade {{valor}}." }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }, { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }],
  } });
  if (!proposta.ok || !proposta.dado) throw new Error("Modelo ausente");
  const modelo = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const consulta = { matriculaId: r.matriculaId, modeloId: modelo.id };
  expect(await consultarPreenchimentoContratual(consulta)).toMatchObject({ ok: false, erro: expect.stringContaining("publicada") });
  expect(await consultarPainelPrevias({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { podePreparar: true, modelos: [], historico: [] } });
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  expect((await decidirModeloContratual({ modeloId: modelo.id, conteudoHash: modelo.conteudoHash, aprovada: true, motivo: "Modelo conferido para teste" })).ok).toBe(true);
  authMock.mockResolvedValue({ user: { id: autorId } });
  const revisao = await consultarPreenchimentoContratual(consulta);
  if (!revisao.ok || !revisao.dado) throw new Error("Revisão ausente");
  const d = { ...consulta, revisaoHash: revisao.dado.revisaoHash, aplicacaoConferida: true as const, motivo: "Aplicação à matrícula conferida", chaveIdempotencia: "previa-registrar" };
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { sobrenome: "Atualizado" } });
  expect(await registrarPreviaContratual(d)).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
  expect(await prisma.previaDocumentoContratual.count()).toBe(0);
  const atual = await consultarPreenchimentoContratual(consulta);
  if (!atual.ok || !atual.dado) throw new Error("Revisão atual ausente");
  const dados = { ...d, revisaoHash: atual.dado.revisaoHash };
  const gerada = await registrarPreviaContratual(dados);
  if (!gerada.ok || !gerada.dado) throw new Error("Prévia não gerada");
  expect(await registrarPreviaContratual(dados)).toEqual(gerada);
  const original = await consultarPreviaContratual(gerada.dado.id);
  const requisicaoPdf = new Request("http://localhost/api/pdf-teste");
  const parametrosPdf = { params: Promise.resolve({ id: r.matriculaId, previaId: gerada.dado.id }) };
  const arquivoPdf = await baixarPdfPrevia(requisicaoPdf, parametrosPdf);
  expect(arquivoPdf.status).toBe(200); expect(arquivoPdf.headers.get("Content-Type")).toBe("application/pdf");
  expect(arquivoPdf.headers.get("Cache-Control")).toBe("private, no-store");
  const bytesPdf = Buffer.from(await arquivoPdf.arrayBuffer()); expect(bytesPdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect((await baixarPdfPrevia(requisicaoPdf, { params: Promise.resolve({ id: base.id, previaId: gerada.dado.id }) })).status).toBe(404);

  expect(original).toMatchObject({ ok: true, dado: { snapshot: { assinaturasPlanejadas: { contexto: { maioridade: null, pagador: "ALUNO" }, participantesExigidos: [{ papel: "ALUNO", etapa: "CLIENTE" }, { papel: "REPRESENTANTE_ESCOLA", etapa: "ESCOLA" }], pendencias: [] } } } });
  const painel = await consultarPainelPrevias({ matriculaId: r.matriculaId });
  expect(painel).toMatchObject({ ok: true, dado: { modelos: [{ id: modelo.id, codigo: "CONTRATO_TESTE", versao: 1 }], historico: [{ id: gerada.dado.id }] } });
  if (!painel.ok || !painel.dado) throw new Error("Painel ausente");
  expect(painel.dado.modelos[0]).not.toHaveProperty("conteudo");
  expect(painel.dado.historico[0]).not.toHaveProperty("snapshot");
  expect(await consultarPainelPrevias({ matriculaId: base.id })).toMatchObject({ ok: true, dado: { podePreparar: false, modelos: [], historico: [] } });

  expect(original).toMatchObject({ ok: true, dado: { snapshot: { documento: { titulo: "Contrato Reserva 0 Atualizado", secoes: [{ texto: "Reserva 0 Atualizado; mensalidade 999999.00 CRC." }] } } } });

  const evidencia = await prisma.documento.create({ data: { matriculaId: r.matriculaId, categoria: "OUTRO", nome: "Representação conferida", url: "/api/files/teste-representacao.pdf" } });
  const alheia = await prisma.documento.create({ data: { matriculaId: base.id, categoria: "OUTRO", nome: "Documento de outro contrato", url: "/api/files/teste-alheio.pdf" } });
  const formulario = await consultarFormularioParticipantes({ previaId: gerada.dado.id, maioridade: null });
  expect(formulario).toMatchObject({ ok: true, dado: { versaoEsperada: 0, participantes: [{ papel: "ALUNO", automatico: true, identidade: { nome: "Reserva 0 Atualizado" } }, { papel: "REPRESENTANTE_ESCOLA", automatico: false, identidade: null }], documentos: [{ id: evidencia.id }] } });
  if (!formulario.ok || !formulario.dado) throw new Error("Formulário ausente");
  expect(formulario.dado.documentos).toHaveLength(1);
  expect(formulario.dado.documentos[0]).not.toHaveProperty("url");
  const participanteAluno = { papel: "ALUNO" as const, identidade: { nome: "Reserva 0 Atualizado", email: "aluno@example.test", documento: "ALUNO-TESTE" } };
  const participanteEscola = { papel: "REPRESENTANTE_ESCOLA" as const, identidade: { nome: "Representante de teste", email: "escola@example.test", documento: "ESCOLA-TESTE" }, representacao: { descricao: "Representação institucional conferida", evidenciaDocumentoId: evidencia.id } };
  const confer = { previaId: gerada.dado.id, versaoEsperada: 0, maioridade: null, participantes: [participanteAluno, participanteEscola], identificacoesConferidas: true as const, motivo: "Pessoas e representação conferidas", chaveIdempotencia: "conferencia-participantes" };
  expect((await conferirParticipantesContratuais({ ...confer, participantes: [participanteAluno] })).ok).toBe(false);
  expect((await conferirParticipantesContratuais({ ...confer, participantes: [participanteAluno, { ...participanteEscola, representacao: undefined }] })).ok).toBe(false);
  expect((await conferirParticipantesContratuais({ ...confer, participantes: [participanteAluno, { ...participanteEscola, representacao: { ...participanteEscola.representacao, evidenciaDocumentoId: alheia.id } }] })).ok).toBe(false);
  expect((await conferirParticipantesContratuais({ ...confer, participantes: [{ ...participanteAluno, identidade: { ...participanteAluno.identidade, email: "outro@example.test" } }, participanteEscola] })).ok).toBe(false);
  expect(await prisma.conferenciaParticipantesContratuais.count()).toBe(0);
  const confirmada = await conferirParticipantesContratuais(confer);
  expect(await consultarFormularioParticipantes({ previaId: gerada.dado.id, maioridade: null })).toMatchObject({ ok: true, dado: { versaoEsperada: 1 } });
  expect(confirmada).toMatchObject({ ok: true, dado: { versao: 1 } });
  expect(await conferirParticipantesContratuais(confer)).toEqual(confirmada);
  expect((await conferirParticipantesContratuais({ ...confer, chaveIdempotencia: "outra-chave-participantes" })).ok).toBe(false);
  expect(await consultarConferenciasParticipantes({ previaId: gerada.dado.id })).toMatchObject({ ok: true, dado: { registros: [{ snapshot: { participantes: [{ papel: "ALUNO", origem: "ALUNO", etapa: "CLIENTE" }, { papel: "REPRESENTANTE_ESCOLA", origem: "REPRESENTANTE_CONFERIDO", etapa: "ESCOLA" }] } }] } });
  await expect(prisma.conferenciaParticipantesContratuais.updateMany({ data: { snapshot: {} } })).rejects.toThrow("imutável");
  await expect(prisma.conferenciaParticipantesContratuais.deleteMany()).rejects.toThrow("imutável");
  if (!confirmada.ok || !confirmada.dado) throw new Error("Conferência ausente");
  const gerarOriginal = { previaId: gerada.dado.id, conferenciaId: confirmada.dado.id, conteudoConferido: true as const, motivo: "Preservação do original conferido" };
  const segundaConferencia = await conferirParticipantesContratuais({ ...confer, versaoEsperada: 1, chaveIdempotencia: "conferencia-segunda-versao" });
  if (!segundaConferencia.ok || !segundaConferencia.dado) throw new Error("Segunda conferência ausente");
  expect(await preservarOriginalContratual(gerarOriginal)).toMatchObject({ ok: false, erro: expect.stringContaining("outra conferência") });
  gerarOriginal.conferenciaId = segundaConferencia.dado.id;
  expect((await preservarOriginalContratual({ ...gerarOriginal, previaId: "outra-previa" })).ok).toBe(false);
  expect((await preservarOriginalContratual({ ...gerarOriginal, conferenciaId: "outra-conferencia" })).ok).toBe(false);
  expect((await preservarOriginalContratual({ ...gerarOriginal, conteudoConferido: false } as unknown as typeof gerarOriginal)).ok).toBe(false);
  // O e-mail não é campo do modelo: mesmo com texto inalterado, identidade nova exige conferência.
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { email: "mudou@example.test" } });
  expect(await preservarOriginalContratual(gerarOriginal)).toMatchObject({ ok: false, erro: expect.stringContaining("signatários mudou") });
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { email: "aluno@example.test" } });
  await prisma.documento.update({ where: { id: evidencia.id }, data: { arquivado: true } });
  expect(await preservarOriginalContratual(gerarOriginal)).toMatchObject({ ok: false, erro: expect.stringContaining("evidências") });
  await prisma.documento.update({ where: { id: evidencia.id }, data: { arquivado: false } });
  const falhaPdf = vi.spyOn(geradorPdf, "gerarPdfOriginal").mockRejectedValueOnce(new Error("Falha simulada do gerador"));
  expect(await preservarOriginalContratual(gerarOriginal)).toMatchObject({ ok: false, erro: expect.stringContaining("falha foi registrada") });
  falhaPdf.mockRestore();
  expect(await prisma.artefatoContratual.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "GeracaoOriginalContratualFalhou", agregadoId: r.matriculaId } })).toBe(1);
  const originalPreservado = await preservarOriginalContratual(gerarOriginal);
  if (!originalPreservado.ok || !originalPreservado.dado) throw new Error(JSON.stringify(originalPreservado));
  expect(await preservarOriginalContratual(gerarOriginal)).toEqual(originalPreservado);
  const a = originalPreservado.dado;
  expect(a).not.toHaveProperty("pdf");
  expect(a.gerador).toMatchObject({ versao: "contrato-original-1", fontes: [{ sha256: expect.any(String) }, { sha256: expect.any(String) }] });
  expect(await prisma.artefatoContratual.count()).toBe(1);
  const terceiraConferencia = await conferirParticipantesContratuais({ ...confer, versaoEsperada: 2, chaveIdempotencia: "conferencia-terceira-versao" });
  if (!terceiraConferencia.ok || !terceiraConferencia.dado) throw new Error("Terceira conferência ausente");
  expect(await preservarOriginalContratual({ ...gerarOriginal, conferenciaId: terceiraConferencia.dado.id })).toEqual(originalPreservado);
  expect(await prisma.artefatoContratual.count()).toBe(1);
  expect(await consultarOriginaisContratuais({ previaId: gerada.dado.id })).toMatchObject({ ok: true, dado: { conferenciaJaPreservada: true } });
  const parametrosOriginal = { params: Promise.resolve({ id: r.matriculaId, artefatoId: a.id }) };
  const respostaOriginal = await baixarPdfOriginal(requisicaoPdf, parametrosOriginal);
  expect(respostaOriginal.status).toBe(200); expect(respostaOriginal.headers.get("Cache-Control")).toBe("private, no-store");
  const originalBytes = Buffer.from(await respostaOriginal.arrayBuffer());
  expect(originalBytes.subarray(0, 5).toString()).toBe("%PDF-");
  const salvoOriginal = await prisma.artefatoContratual.findUniqueOrThrow({ where: { id: a.id } });
  const leituraCorrompida = vi.spyOn(prisma.artefatoContratual, "findFirst").mockResolvedValueOnce({ ...salvoOriginal, pdf: Buffer.from("arquivo corrompido") });
  expect((await baixarPdfOriginal(requisicaoPdf, parametrosOriginal)).status).toBe(422);
  leituraCorrompida.mockRestore();
  const outraPrevia = await registrarPreviaContratual({ ...dados, chaveIdempotencia: "previa-outra-para-vinculo" });
  if (!outraPrevia.ok || !outraPrevia.dado) throw new Error("Outra prévia ausente");
  await expect(prisma.artefatoContratual.create({ data: { ...salvoOriginal, gerador: { versao: "teste-vinculo" }, id: "artefato-vinculo-invalido", previaId: outraPrevia.dado.id } })).rejects.toThrow("Conferência não pertence");
  expect((await baixarPdfOriginal(requisicaoPdf, { params: Promise.resolve({ id: base.id, artefatoId: a.id }) })).status).toBe(404);
  expect(await consultarOriginaisContratuais({ previaId: gerada.dado.id })).toMatchObject({ ok: true, dado: { registros: [{ id: a.id }] } });
  await expect(prisma.artefatoContratual.updateMany({ data: { motivo: "Tentativa de alteração" } })).rejects.toThrow("imutável");
  await expect(prisma.artefatoContratual.deleteMany()).rejects.toThrow("imutável");
  const alvoAssinatura = { matriculaId: r.matriculaId, artefatoId: a.id };
  expect(await consultarConferenciaAssinatura(alvoAssinatura)).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("emissão inicial") } });
  const reservaExcecao = await prisma.reservaVagaMatricula.findFirstOrThrow({ where: { matriculaId: r.matriculaId } });
  const janelaExcecao = await prisma.janelaAdmissaoTurma.create({ data: { turmaId, preparadorId: autorId, versao: 2, limiteEntrada: new Date("2020-01-01"), fusoAdmissao: "UTC", motivo: "Janela reduzida após a reserva", chaveIdempotencia: "janela-excecao", entradaHash: "fixture-excecao" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janelaExcecao.id, decisorId: admin.id, aprovada: true, motivo: "Janela de teste aprovada" } });
  const revisaoExcecao = await consultarExcecoesAdmissao({ reservaId: reservaExcecao.id });
  if (!revisaoExcecao.ok || !revisaoExcecao.dado?.revisao) throw new Error(JSON.stringify(revisaoExcecao));
  const solicitarExcecao = { reservaId: reservaExcecao.id, estadoHash: revisaoExcecao.dado.revisao.estadoHash, motivo: "Ingresso de reserva feita dentro da janela", parecerViabilidade: "Conteúdo inicial será acompanhado pela equipe pedagógica", chaveIdempotencia: "excecao-para-contrato" };
  const propostaExcecao = await prepararExcecaoAdmissao(solicitarExcecao);
  if (!propostaExcecao.ok || !propostaExcecao.dado) throw new Error(JSON.stringify(propostaExcecao));
  expect(await prepararExcecaoAdmissao(solicitarExcecao)).toEqual(propostaExcecao);
  expect((await prisma.$transaction((tx) => conferirContinuidadeReserva(tx, reservaExcecao.id))).conferencia.elegivel).toBe(false);
  const aprovarExcecao = { propostaId: propostaExcecao.dado.id, estadoHash: solicitarExcecao.estadoHash, aprovada: true, motivo: "Viabilidade pedagógica conferida independentemente" };
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  expect(await decidirExcecaoAdmissao(aprovarExcecao)).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  await expect(prisma.decisaoExcecaoAdmissao.create({ data: { propostaId: propostaExcecao.dado.id, decisorId: autorId, aprovada: true, motivo: "Tentativa direta de autoaprovação" } })).rejects.toThrow("Outra pessoa");
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["SECRETARIA_ACADEMICA"] } });
  authMock.mockResolvedValue({ user: { id: admin.id } });
  expect((await decidirExcecaoAdmissao(aprovarExcecao)).ok).toBe(true);
  authMock.mockResolvedValue({ user: { id: autorId } });
  const continuidade = await prisma.$transaction((tx) => conferirContinuidadeReserva(tx, reservaExcecao.id));
  expect(continuidade).toMatchObject({ excecaoId: propostaExcecao.dado.id, conferencia: { elegivel: true } });
  const docenteExcecao = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId } });
  await prisma.usuario.update({ where: { id: docenteExcecao.professorId! }, data: { ativo: false } });
  expect((await prisma.$transaction((tx) => conferirContinuidadeReserva(tx, reservaExcecao.id))).conferencia.elegivel).toBe(false);
  await prisma.usuario.update({ where: { id: docenteExcecao.professorId! }, data: { ativo: true } });
  const turmaExcecao = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  await prisma.turma.update({ where: { id: turmaId }, data: { status: "CONCLUIDA" } });
  expect((await prisma.$transaction((tx) => conferirContinuidadeReserva(tx, reservaExcecao.id))).conferencia.impedimentos).toContain("TURMA_CONCLUIDA");
  await prisma.turma.update({ where: { id: turmaId }, data: { status: turmaExcecao.status } });
  await expect(prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, { matriculaId: base.id, turmaId, autorId, motivo: "Outra contratação sem exceção", chaveIdempotencia: "nao-herda-excecao" }))).rejects.toThrow();
  await expect(prisma.propostaExcecaoAdmissao.deleteMany()).rejects.toThrow("imutável");
  await expect(prisma.decisaoExcecaoAdmissao.updateMany({ data: { aprovada: false } })).rejects.toThrow("imutável");
  const revisaoEmissao = await consultarRevisaoEmissao(r.matriculaId);
  if (!revisaoEmissao.ok || !revisaoEmissao.dado) throw new Error("Revisão de emissão ausente");
  expect((await conferirEEmitirEntrada({ matriculaId: r.matriculaId, revisaoHash: revisaoEmissao.dado.hash, cadastroDocumentosConferidos: true, condicoesConferidas: true, motivo: "Conferência anterior à assinatura", chaveIdempotencia: "emitir-para-assinatura" })).ok).toBe(true);
  const taxaAssinatura = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.matriculaId, tipo: "MATRICULA" } });
  // Alterar a oferta atual não modifica a regra de assinatura capturada na matrícula.
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: !taxaPreviaAssinatura } });
  if (taxaPreviaAssinatura) {
    await prisma.pagamentoInformado.create({ data: { cobrancaId: taxaAssinatura.id, autorId, chaveIdempotencia: "informe-taxa-assinatura", valor: taxaAssinatura.valorNegociado, moeda: taxaAssinatura.moeda, forma: "TRANSFERENCIA", dataPagamento: new Date() } });
    expect(await consultarConferenciaAssinatura(alvoAssinatura)).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("Financeiro") } });
    const financeiro = await criarUsuario(["FINANCEIRO"]);
    await prisma.$transaction((tx) => receberTx(tx, { cobrancaId: taxaAssinatura.id, chaveIdempotencia: "receber-taxa-assinatura", autorId: financeiro.id, valorRecebido: taxaAssinatura.valorNegociado.toNumber(), forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Comprovante conferido para reserva e contratação" }));
  }
  const assinatura = await consultarConferenciaAssinatura(alvoAssinatura);
  if (!assinatura.ok || !assinatura.dado?.revisao) throw new Error(JSON.stringify(assinatura));
  expect(assinatura.dado.revisao.dados.taxa.confirmada).toBe(taxaPreviaAssinatura);
  expect(assinatura.dado.revisao.dados.regraTaxa).toBe(taxaPreviaAssinatura ? "CONFIRMACAO_PREVIA_EXIGIDA" : "SEM_PAGAMENTO_PREVIO");
  const solicitarConferencia = { ...alvoAssinatura, revisaoHash: assinatura.dado.revisao.hash, dadosConferidos: true as const, motivo: "Original e requisitos conferidos", chaveIdempotencia: "conferir-para-assinatura" };
  const reservaAssinatura = await prisma.reservaVagaMatricula.findFirstOrThrow({ where: { matriculaId: r.matriculaId } });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(reservaAssinatura.expiraEm.getTime() + 1000));
    expect(await consultarConferenciaAssinatura(alvoAssinatura)).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("venceu") } });
  } finally { vi.useRealTimers(); }
  await prisma.reservaVagaMatricula.update({ where: { id: reservaAssinatura.id }, data: { expiraEm: new Date(reservaAssinatura.expiraEm.getTime() + 60000) } });
  expect(await registrarConferenciaAssinatura(solicitarConferencia)).toMatchObject({ ok: false, erro: expect.stringContaining("JANELA_ENCERRADA") });
  const novaBaseExcecao = await consultarExcecoesAdmissao({ reservaId: reservaExcecao.id });
  if (!novaBaseExcecao.ok || !novaBaseExcecao.dado?.revisao) throw new Error("Revisão da exceção ausente");
  const novaExcecao = await prepararExcecaoAdmissao({ ...solicitarExcecao, estadoHash: novaBaseExcecao.dado.revisao.estadoHash, chaveIdempotencia: "excecao-prazo-revisado" });
  if (!novaExcecao.ok || !novaExcecao.dado) throw new Error("Nova proposta ausente");
  authMock.mockResolvedValue({ user: { id: admin.id } });
  expect((await decidirExcecaoAdmissao({ ...aprovarExcecao, propostaId: novaExcecao.dado.id, estadoHash: novaBaseExcecao.dado.revisao.estadoHash })).ok).toBe(true);
  authMock.mockResolvedValue({ user: { id: autorId } });
  const revisada = await consultarConferenciaAssinatura(alvoAssinatura);
  if (!revisada.ok || !revisada.dado?.revisao) throw new Error("Revisão de assinatura ausente");
  solicitarConferencia.revisaoHash = revisada.dado.revisao.hash;
  const conferidaAssinatura = await registrarConferenciaAssinatura(solicitarConferencia);
  expect(conferidaAssinatura).toMatchObject({ ok: true, dado: { envioRealizado: false } });
  expect(await registrarConferenciaAssinatura(solicitarConferencia)).toEqual(conferidaAssinatura);
  expect((await registrarConferenciaAssinatura({ ...solicitarConferencia, motivo: "Outro motivo para a mesma chave" })).ok).toBe(false);
  expect(await prisma.conferenciaAssinaturaContratual.count()).toBe(1);
  if (!conferidaAssinatura.ok || !conferidaAssinatura.dado) throw new Error("Conferência não registrada");
  // Fornecedor e ambiente abaixo são fixtures: nenhuma configuração operacional ou chamada externa.
  const entradaProcesso = { matriculaId: r.matriculaId, artefatoId: a.id, conferenciaId: conferidaAssinatura.dado.id, executorId: autorId, fornecedor: "ZAPSIGN" as const, ambiente };
  const processoEnvio = await prisma.$transaction((tx) => prepararProcessoEnvioTx(tx, entradaProcesso));
  expect(await prisma.$transaction((tx) => prepararProcessoEnvioTx(tx, entradaProcesso))).toEqual(processoEnvio);
  await expect(prisma.$transaction((tx) => prepararProcessoEnvioTx(tx, { ...entradaProcesso, fornecedor: "DOCUSIGN" }))).rejects.toThrow("processo anterior");
  const tentativasEnvio = await Promise.allSettled([0, 1].map(() => prisma.$transaction((tx) => iniciarTentativaAssinaturaTx(tx, { processoId: processoEnvio.id, executorId: autorId }), { timeout: 20000 })));
  expect(tentativasEnvio.filter((v) => v.status === "fulfilled")).toHaveLength(1);
  const iniciada = tentativasEnvio.find((v) => v.status === "fulfilled");
  if (!iniciada || iniciada.status !== "fulfilled") throw new Error("Tentativa não iniciada");
  const resultadoIncerto = { processoId: processoEnvio.id, tentativaId: iniciada.value.tentativaId, chave: "resultado-incerto", resultado: "INCERTO" as const, referenciaExterna: null, evidenciaHash: "a".repeat(64) };
  const incerto = await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, resultadoIncerto));
  expect(incerto.estado).toBe("ENVIO_INCERTO");
  expect(await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, resultadoIncerto))).toEqual(incerto);
  await expect(prisma.$transaction((tx) => iniciarTentativaAssinaturaTx(tx, { processoId: processoEnvio.id, executorId: autorId }))).rejects.toThrow("conciliação");
  expect((await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, { ...resultadoIncerto, chave: "ausencia-confirmada", resultado: "NAO_CRIADO", evidenciaHash: "b".repeat(64) }))).estado).toBe("PREPARADO");
  const tentativaNova = await prisma.$transaction((tx) => iniciarTentativaAssinaturaTx(tx, { processoId: processoEnvio.id, executorId: autorId }));
  expect(tentativaNova.numero).toBe(2);
  await expect(prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, { ...resultadoIncerto, resultado: "REGISTRADO", chave: "retorno-antigo", referenciaExterna: "externo-antigo" }))).rejects.toThrow("tentativa anterior");
  const registroExterno = { ...resultadoIncerto, tentativaId: tentativaNova.tentativaId, resultado: "REGISTRADO" as const, chave: "envio-confirmado", referenciaExterna: "externo-teste", evidenciaHash: "c".repeat(64) };
  const confirmadoEnvio = await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, registroExterno));
  expect(confirmadoEnvio.estado).toBe("ENVIADO");
  expect(await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, registroExterno))).toEqual(confirmadoEnvio);
  // Mesmo uma inconsistência de estado não pode reenviar processo já vinculado ao fornecedor.
  await prisma.processoAssinaturaContratual.update({ where: { id: processoEnvio.id }, data: { estado: "PREPARADO" } });
  await expect(prisma.$transaction((tx) => iniciarTentativaAssinaturaTx(tx, { processoId: processoEnvio.id, executorId: autorId }))).rejects.toThrow("Não repetir");
  await prisma.processoAssinaturaContratual.update({ where: { id: processoEnvio.id }, data: { estado: "ENVIADO" } });
  await expect(prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, { ...registroExterno, chave: "outro-processo", referenciaExterna: "referencia-diferente" }))).rejects.toThrow("divergente");
  await expect(prisma.processoAssinaturaContratual.update({ where: { id: processoEnvio.id }, data: { referenciaExterna: "referencia-alterada" } })).rejects.toThrow("substituída");
  await expect(prisma.processoAssinaturaContratual.update({ where: { id: processoEnvio.id }, data: { matriculaId: base.id } })).rejects.toThrow("imutável");
  await expect(prisma.tentativaEnvioAssinatura.deleteMany()).rejects.toThrow("imutável");
  await expect(prisma.observacaoEnvioAssinatura.deleteMany()).rejects.toThrow("imutável");
  const processoConcluido = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processoEnvio.id }, include: { artefato: { include: { conferencia: true } } } });
  const pessoasConclusao = ConferirParticipantesSchema.innerType().shape.participantes.element.strip().array().parse((processoConcluido.artefato.conferencia.snapshot as { participantes: unknown }).participantes);
  const momentoConclusao = new Date().toISOString();
  const conclusaoInput = { processoId: processoEnvio.id, referenciaExterna: "externo-teste", originalHash: processoConcluido.artefato.pdfHash, concluidaEm: momentoConclusao,
    pdfAssinado: Buffer.from("%PDF-1.7 documento assinado de teste"), evidencias: Buffer.from("Auditoria autenticada fictícia"), assinaturas: pessoasConclusao.map(p => ({ papel: p.papel, identidadeHash: hashPrevia(p.identidade), referenciaAssinatura: `assinatura-${p.papel}`, assinadaEm: momentoConclusao })) };
  await expect(prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { ...conclusaoInput, referenciaExterna: "outro-envio" }))).rejects.toThrow();
  await expect(prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { ...conclusaoInput, assinaturas: [] }))).rejects.toThrow();
  expect(await prisma.conclusaoAssinaturaContratual.count()).toBe(0);
  expect(await consultarConclusaoContratual({ matriculaId: processoConcluido.matriculaId, artefatoId: processoConcluido.artefatoId })).toMatchObject({ ok: true, dado: { ambiente, conclusao: null } });
  const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, conclusaoInput));
  expect(await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, conclusaoInput))).toEqual(conclusao);
  await expect(prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { ...conclusaoInput, evidencias: Buffer.from("Auditoria diferente") }))).rejects.toThrow("outro conteúdo");
  const preservada = await prisma.conclusaoAssinaturaContratual.findUniqueOrThrow({ where: { id: conclusao.id } });
  expect(preservada.pdfAssinado).toEqual(conclusaoInput.pdfAssinado);
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: processoConcluido.matriculaId } })).contratoOk).toBe(false);
  await expect(prisma.conclusaoAssinaturaContratual.update({ where: { id: conclusao.id }, data: { originalHash: "0".repeat(64) } })).rejects.toThrow("imutável");
  expect(await prisma.evento.count({ where: { tipo: "ConclusaoAssinaturaPreservada", agregadoId: processoConcluido.matriculaId } })).toBe(1);
  const metadadosConclusao = await consultarConclusaoContratual({ matriculaId: processoConcluido.matriculaId, artefatoId: processoConcluido.artefatoId });
  expect(metadadosConclusao).toMatchObject({ ok: true, dado: { conclusao: { id: conclusao.id, assinaturas: expect.arrayContaining([expect.objectContaining({ papel: "ALUNO", nome: expect.any(String) })]) } } });
  expect(JSON.stringify(metadadosConclusao)).not.toMatch(/pdfAssinado|evidenciasHash|identidadeHash|email|documento|referenciaAssinatura/);
  const abrirConclusao = (tipo: string, matricula = processoConcluido.matriculaId) => baixarArquivoAssinatura(new Request("http://localhost/api/assinaturas"), { params: Promise.resolve({ id: matricula, conclusaoId: conclusao.id, tipo }) });
  const pdfConclusao = await abrirConclusao("pdf");
  expect(pdfConclusao.status).toBe(200); expect(pdfConclusao.headers.get("Cache-Control")).toBe("private, no-store");
  expect(pdfConclusao.headers.get("Content-Type")).toBe("application/pdf");
  expect(Buffer.from(await pdfConclusao.arrayBuffer())).toEqual(conclusaoInput.pdfAssinado);
  const auditoriaConclusao = await abrirConclusao("auditoria");
  expect(auditoriaConclusao.status).toBe(200); expect(auditoriaConclusao.headers.get("Content-Disposition")).toContain("attachment");
  expect(Buffer.from(await auditoriaConclusao.arrayBuffer())).toEqual(conclusaoInput.evidencias);
  expect((await abrirConclusao("inexistente")).status).toBe(400);
  expect((await abrirConclusao("pdf",base.id)).status).toBe(404);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await abrirConclusao("pdf")).status).toBe(403);
  expect((await consultarConclusaoContratual({ matriculaId: processoConcluido.matriculaId, artefatoId: processoConcluido.artefatoId })).ok).toBe(false);
  authMock.mockResolvedValue(null);
  expect((await abrirConclusao("pdf")).status).toBe(401);
  authMock.mockResolvedValue({ user: { id: autorId } });
  await prisma.usuario.update({ where: { id: autorId }, data: { ativo: false } });
  expect((await abrirConclusao("pdf")).status).toBe(401);
  await prisma.usuario.update({ where: { id: autorId }, data: { ativo: true } });
  // Nem PDF de teste preservado nem flags do caminho antigo autorizam o novo aceite.
  const contratoAnexado = await prisma.documento.create({ data: { matriculaId: processoConcluido.matriculaId, categoria: "CONTRATO", nome: "Anexo sem aceite integrado", url: "/api/assinaturas/anexo" } });
  expect(await confirmarContratoMatricula(processoConcluido.matriculaId, contratoAnexado.id, [])).toMatchObject({ ok: false, erro: expect.stringContaining("fluxo integrado") });
  const antesAceite = await prisma.matricula.findUniqueOrThrow({ where: { id: processoConcluido.matriculaId } });
  const flagsLegadas = { ...antesAceite, contratoOk: true, contratoDocumentoId: contratoAnexado.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: autorId };
  await expect(prisma.$transaction(tx => exigirContratoAceito(tx, flagsLegadas))).rejects.toThrow("fluxo integrado");
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: processoConcluido.matriculaId } })).contratoOk).toBe(false);
  const alvoAceite = { matriculaId: processoConcluido.matriculaId, conclusaoId: conclusao.id };
  const consultaAceite = await consultarAceiteOriginal(alvoAceite);
  const confirmarBase = { ...alvoAceite, revisaoHash: "0".repeat(64), evidenciasConferidas: true as const, motivo: "Conferência final exclusivamente de teste", chaveIdempotencia: "aceite-integrado-teste" };
  if (ambiente === "SANDBOX") {
    expect(consultaAceite).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("teste") } });
    expect(await confirmarAceiteOriginal(confirmarBase)).toMatchObject({ ok: false, erro: expect.stringContaining("teste") });
    expect(await prisma.aceiteOriginalContratual.count()).toBe(0);
  } else {
    // PRODUCAO é somente uma fixture neste banco descartável, sem fornecedor ou envio real.
    if (!consultaAceite.ok || !consultaAceite.dado?.revisao) throw new Error(`Revisão final ausente: ${JSON.stringify(consultaAceite)}`);
    expect(await confirmarAceiteOriginal(confirmarBase)).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
    const pedidoAceite = { ...confirmarBase, revisaoHash: consultaAceite.dado.revisao.hash };
    expect((await consultarAceiteOriginal({ ...alvoAceite, matriculaId: base.id })).ok).toBe(false);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    expect((await confirmarAceiteOriginal(pedidoAceite)).ok).toBe(false);
    authMock.mockResolvedValue({ user: { id: autorId } });
    const taxaAceite = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: alvoAceite.matriculaId, tipo: "MATRICULA" } });
    await prisma.cobranca.update({ where: { id: taxaAceite.id }, data: { versao: { increment: 1 } } });
    expect(await confirmarAceiteOriginal(pedidoAceite)).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
    const atualAceite = await consultarAceiteOriginal(alvoAceite);
    if (!atualAceite.ok || !atualAceite.dado?.revisao) throw new Error("Revisão atual ausente");
    pedidoAceite.revisaoHash = atualAceite.dado.revisao.hash;
    const [gravado, repetido] = await Promise.all([
      prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, autorId, pedidoAceite)),
      prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, autorId, pedidoAceite)),
    ]);
    expect(gravado).toMatchObject({ matriculaAtivada: false }); expect(repetido).toEqual(gravado);
    const aceito = await confirmarAceiteOriginal(pedidoAceite);
    expect(aceito).toMatchObject({ ok: true, dado: gravado });
    if (!aceito.ok || !aceito.dado) throw new Error("Aceite não registrado");
    expect(await prisma.aceiteOriginalContratual.count()).toBe(1);
    expect(await prisma.evento.count({ where: { agregadoId: alvoAceite.matriculaId, tipo: "ContratoConfirmado" } })).toBe(1);
    expect((await confirmarAceiteOriginal({ ...pedidoAceite, motivo: "Outro conteúdo com a mesma chave" })).ok).toBe(false);
    expect((await confirmarAceiteOriginal({ ...pedidoAceite, chaveIdempotencia: "segunda-chave-aceite" })).ok).toBe(false);
    const aposAceite = await prisma.matricula.findUniqueOrThrow({ where: { id: alvoAceite.matriculaId } });
    expect(aposAceite.contratoOk).toBe(true); expect(aposAceite.status).toBe("RASCUNHO");
    await expect(prisma.$transaction(tx => exigirContratoAceito(tx, aposAceite))).resolves.toBe(aceito.dado.documentoId);
    await expect(prisma.$transaction(tx => exigirContratoAceito(tx, { ...aposAceite, contratoDocumentoId: contratoAnexado.id }))).rejects.toThrow("diverge");
    expect(await consultarAceiteOriginal(alvoAceite)).toMatchObject({ ok: true, dado: { revisao: null, aceite: { id: aceito.dado.id } } });
    await expect(prisma.aceiteOriginalContratual.updateMany({ data: { motivo: "Alterado" } })).rejects.toThrow("imutável");
    await expect(prisma.aceiteOriginalContratual.deleteMany()).rejects.toThrow("imutável");
    await expect(prisma.documento.update({ where: { id: aceito.dado.documentoId }, data: { url: "/outro-pdf" } })).rejects.toThrow("preservado");
    expect(await prisma.documento.count({ where: { categoria: "CONTRATO" } })).toBe(2);
    expect(await confirmarAceiteOriginal(pedidoAceite)).toEqual(aceito);
    // A mesma matrícula preparada é concluída pelo caminho público, sem criar recebimentos.
    const financeiroAtivacao = await criarUsuario(["FINANCEIRO"]);
    expect(await concluirMatricula(alvoAceite.matriculaId)).toMatchObject({ ok: false, erro: expect.stringContaining("pagamentos exigidos") });
    for (const cobranca of await prisma.cobranca.findMany({ where: { matriculaId: alvoAceite.matriculaId } })) {
      const restante = cobranca.valorNegociado.minus(cobranca.valorRecebido ?? 0);
      if (restante.gt(0)) await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroAtivacao.id, valorRecebido: restante.toNumber(), forma: "TRANSFERENCIA", chaveIdempotencia: `pagar-ativacao-${cobranca.id}`, dataPagamento: new Date(), evidencia: "Comprovante conferido para reserva e contratação" }));
    }
    expect(await concluirMatricula(alvoAceite.matriculaId)).toMatchObject({ ok: false, erro: expect.stringContaining("política de comissão") });
    await prisma.politicaComissao.create({ data: { paisId: base.paisId, produtoId: base.produtoId, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: base.moeda, vigenteEm: new Date("2020-01-01"), criadaPorId: admin.id } });
    const recebimentosAntes = await prisma.recebimento.count();
    const turmaAtual = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
    const outraTurmaAtiva = await prisma.turma.create({ data: { nivelId: turmaAtual.nivelId, modalidadeId: turmaAtual.modalidadeId } });
    const outroContratoAtivo = await prisma.matricula.create({ data: { alunoId: aposAceite.alunoId, paisId: base.paisId, produtoId: base.produtoId, moeda: base.moeda, status: "ATIVA" } });
    const outraAlocacaoAtiva = await prisma.alocacaoTurma.create({ data: { alunoId: aposAceite.alunoId, matriculaId: outroContratoAtivo.id, turmaId: outraTurmaAtiva.id } });
    await expect(prisma.$transaction(async tx => { await ativarPreparacaoTx(tx, alvoAceite.matriculaId, autorId); throw new Error("Falha após todos os efeitos da ativação"); })).rejects.toThrow("Falha após todos os efeitos");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: alvoAceite.matriculaId } })).status).toBe("RASCUNHO");
    expect(await prisma.alocacaoTurma.count({ where: { matriculaId: alvoAceite.matriculaId } })).toBe(0);
    expect(await prisma.emissaoCobrancasEntrada.count({ where: { matriculaId: alvoAceite.matriculaId, etapa: "ATIVACAO" } })).toBe(0);
    const resultadosAtivacao = await Promise.all([
      prisma.$transaction(tx => ativarPreparacaoTx(tx, alvoAceite.matriculaId, autorId)),
      prisma.$transaction(tx => ativarPreparacaoTx(tx, alvoAceite.matriculaId, autorId)),
    ]);
    expect(resultadosAtivacao[1]).toEqual(resultadosAtivacao[0]);
    expect((await concluirMatricula(alvoAceite.matriculaId)).ok).toBe(true);
    const ativada = await prisma.matricula.findUniqueOrThrow({ where: { id: alvoAceite.matriculaId } });
    expect(ativada).toMatchObject({ status: "ATIVA", primeiraMensalidadeOk: taxaPreviaAssinatura, referenciaCobertura: "MES_CIVIL" });
    expect(await prisma.reservaVagaMatricula.count({ where: { matriculaId: alvoAceite.matriculaId, status: "UTILIZADA" } })).toBe(1);
    expect(await prisma.alocacaoTurma.count({ where: { matriculaId: alvoAceite.matriculaId, turmaId, ativa: true } })).toBe(1);
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: outraAlocacaoAtiva.id } })).toEqual(outraAlocacaoAtiva);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outroContratoAtivo.id } })).toEqual(outroContratoAtivo);
    expect(await prisma.cobranca.count({ where: { matriculaId: alvoAceite.matriculaId, tipo: "MENSALIDADE" } })).toBe(1);
    expect(await prisma.recebimento.count()).toBe(recebimentosAntes);
    expect(await prisma.comissao.findMany({ where: { matriculaId: alvoAceite.matriculaId } })).toMatchObject([{ vendedorId: vendedor.id, status: "APROVADA" }]);
    expect(await prisma.evento.count({ where: { agregadoId: alvoAceite.matriculaId, tipo: "MatriculaAtivada" } })).toBe(1);
    return;
  }
  await expect(prisma.$transaction((tx) => prepararProcessoEnvioTx(tx, { ...entradaProcesso, executorId: vendedor.id }))).rejects.toThrow();

  await expect(prisma.conferenciaAssinaturaContratual.deleteMany()).rejects.toThrow("imutável");
  await expect(prisma.conferenciaAssinaturaContratual.updateMany({ data: { snapshot: {} } })).rejects.toThrow("imutável");
  expect((await consultarConferenciaAssinatura({ ...alvoAssinatura, matriculaId: base.id })).ok).toBe(false);
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { sobrenome: "Mudou depois da geração" } });
  expect(await consultarConferenciaAssinatura(alvoAssinatura)).toMatchObject({ ok: true, dado: { revisao: null, historico: [{ revisaoHash: solicitarConferencia.revisaoHash }] } });
  expect(Buffer.from(await (await baixarPdfOriginal(requisicaoPdf, parametrosOriginal)).arrayBuffer()).equals(originalBytes)).toBe(true);
  expect(await preservarOriginalContratual(gerarOriginal)).toEqual(originalPreservado);
  expect(await preservarOriginalContratual({ ...gerarOriginal, conferenciaId: terceiraConferencia.dado.id })).toMatchObject({ ok: false, erro: expect.stringContaining("desatualizada") });
  expect(await consultarPreviaContratual(gerada.dado.id)).toEqual(original);
  expect(Buffer.from(await (await baixarPdfPrevia(requisicaoPdf, parametrosPdf)).arrayBuffer()).equals(bytesPdf)).toBe(true);
  await expect(prisma.previaDocumentoContratual.updateMany({ data: { snapshot: {} } })).rejects.toThrow("imutável");
  await expect(prisma.previaDocumentoContratual.deleteMany()).rejects.toThrow("imutável");
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await consultarConferenciaAssinatura(alvoAssinatura)).ok).toBe(false);
  expect((await consultarExcecoesAdmissao({ reservaId: reservaExcecao.id })).ok).toBe(false);
  expect((await prepararExcecaoAdmissao(solicitarExcecao)).ok).toBe(false);
  expect((await decidirExcecaoAdmissao(aprovarExcecao)).ok).toBe(false);
  expect((await registrarConferenciaAssinatura(solicitarConferencia)).ok).toBe(false);
  expect((await preservarOriginalContratual(gerarOriginal)).ok).toBe(false);
  expect((await consultarOriginaisContratuais({ previaId: gerada.dado.id })).ok).toBe(false);
  expect((await baixarPdfOriginal(requisicaoPdf, parametrosOriginal)).status).toBe(403);
  expect((await consultarPreenchimentoContratual(consulta)).ok).toBe(false);
  expect((await consultarPreviaContratual(gerada.dado.id)).ok).toBe(false);
  expect((await baixarPdfPrevia(requisicaoPdf, parametrosPdf)).status).toBe(403);
  expect((await consultarPainelPrevias({ matriculaId: r.matriculaId })).ok).toBe(false);
  expect((await registrarPreviaContratual(dados)).ok).toBe(false);
  expect((await conferirParticipantesContratuais(confer)).ok).toBe(false);
  expect((await consultarConferenciasParticipantes({ previaId: gerada.dado.id })).ok).toBe(false);
  expect((await consultarFormularioParticipantes({ previaId: gerada.dado.id, maioridade: null })).ok).toBe(false);
  expect(await prisma.documento.findMany({ where: { categoria: "CONTRATO" }, select: { id: true } })).toEqual([{ id: contratoAnexado.id }]); expect(await prisma.cobranca.count()).toBe(1);
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).contratoOk).toBe(false);
});


it.each(["PARTICULAR_GRADE_FIXA", "PARTICULAR_FLEXIVEL"] as const)("agenda %s não usa reserva comum como reserva individual", async (formaAgenda) => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.produtoPais.updateMany({ data: { formaAgenda, adiantamentoHoraExigido: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  for (const regime of ["MENSALIDADE", "HORA_PARTICULAR"] as const) {
    const lead = await prisma.lead.create({ data: { nome: "Agenda individual", vendedorDonoId: vendedor.id } });
    await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime, taxaProposta: "100", valorServicoProposto: "200", motivo: "Conferir reserva de horários", chaveIdempotencia: `agenda-${regime}` }))).rejects.toThrow("reserva de horários particulares");
    expect(await prisma.matricula.count({ where: { leadId: lead.id } })).toBe(0);
  }
  expect(await prisma.reservaVagaMatricula.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("oferta de turma não contrata hora particular por reserva comum", async () => {
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  await prisma.produtoPais.updateMany({ data: { formaAgenda: "TURMA", adiantamentoHoraExigido: false } });
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Oferta incompatível", vendedorDonoId: vendedor.id } });
  await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, turmaId, regime: "HORA_PARTICULAR", taxaProposta: "100", valorServicoProposto: "200", motivo: "Conferir oferta de horários", chaveIdempotencia: "agenda-incompativel" }))).rejects.toThrow("configurada para turma");
  expect(await prisma.matricula.count({ where: { leadId: lead.id } })).toBe(0);
  expect(await prisma.reservaVagaMatricula.count()).toBe(0);
});


it("conferência particular usa instantes reais, adjacência e detecta alterações da agenda", async () => {
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const oferta = await prisma.produtoPais.findFirstOrThrow();
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "PARTICULAR_FLEXIVEL" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  const d = { ofertaId: oferta.id, versaoOferta: 0, professorId: t.professorId!, fusoOrigem: "America/Sao_Paulo", encontros: [{ data: "2099-10-01", horario: "10:00", duracaoMinutos: 60 }] };
  const revisar = (dados = d) => prisma.$transaction((tx) => conferirAgendaParticularTx(tx, dados));
  const livre = await revisar();
  expect(livre.snapshot.encontros[0].inicio).toBe("2099-10-01T13:00:00.000Z");
  expect(livre.snapshot.impedimentos).toEqual([]); expect(livre.reservaEfetuada).toBe(false);
  expect((await revisar({ ...d, encontros: [{ ...d.encontros[0], horario: "09:30" }] })).snapshot.impedimentos).toContain("CONFLITO_AGENDA");
  expect((await revisar({ ...d, encontros: [d.encontros[0], d.encontros[0]] })).snapshot.impedimentos).toContain("CONFLITO_ENTRE_HORARIOS_PROPOSTOS");
  await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: false } });
  const inapto = await revisar(); expect(inapto.snapshot.impedimentos).toContain("PROFESSOR_INAPTO"); expect(inapto.estadoHash).not.toBe(livre.estadoHash);
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { versaoEntrada: 1 } });
  await expect(revisar()).rejects.toThrow("oferta mudou");
  expect(await prisma.reservaVagaMatricula.count()).toBe(0); expect(await prisma.cobranca.count()).toBe(0);
});

it("conferência particular verifica feriado em todo intervalo e ausência aprovada", async () => {
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const oferta = await prisma.produtoPais.findFirstOrThrow();
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "PARTICULAR_GRADE_FIXA" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 2, preparadorId: autorId, fusoInstitucional: "UTC", periodos: [{ id: "feriado", nome: "Feriado escola", tipo: "FERIADO", inicio: "2099-10-03", fim: "2099-10-03" }], motivo: "Calendário teste", chaveIdempotencia: "particular-calendario", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: gestor.id, aprovada: true, motivo: "Conferido" } });
  const d = { ofertaId: oferta.id, versaoOferta: 0, professorId: t.professorId!, fusoOrigem: "UTC", encontros: [{ data: "2099-10-02", horario: "23:00", duracaoMinutos: 60 }] };
  const revisar = (dados = d) => prisma.$transaction((tx) => conferirAgendaParticularTx(tx, dados));
  expect((await revisar()).snapshot.impedimentos).toEqual([]);
  expect((await revisar({ ...d, encontros: [{ ...d.encontros[0], duracaoMinutos: 61 }] })).snapshot.impedimentos).toContain("EXCECAO_NAO_LETIVA_NECESSARIA");
  const ausencia = await prisma.indisponibilidadeDocente.create({ data: { professorId: t.professorId!, preparadorId: autorId, inicio: new Date("2099-10-02T23:00:00Z"), fim: new Date("2099-10-03T00:00:00Z"), fusoOrigem: "UTC", motivo: "Licença docente", chaveIdempotencia: "ausencia-particular", entradaHash: "fixture" } });
  expect((await revisar()).snapshot.indisponibilidades).toEqual([]);
  await prisma.decisaoIndisponibilidadeDocente.create({ data: { indisponibilidadeId: ausencia.id, decisorId: gestor.id, aprovada: true, motivo: "Conferido", encontrosAfetados: [] } });
  expect((await revisar()).snapshot.impedimentos).toContain("INDISPONIBILIDADE_DOCENTE");
  await expect(revisar({ ...d, fusoOrigem: "America/New_York", encontros: [{ data: "2099-03-08", horario: "02:30", duracaoMinutos: 60 }] })).rejects.toThrow("inexistente ou ambíguo");
});


it("cursor persistente avança sobre reserva não resolvida e volta após terminar a passagem", async () => {
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const oferta = await prisma.produtoPais.findFirstOrThrow();
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "PARTICULAR_FLEXIVEL" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  const ids: string[] = [];
  for (const i of [0, 1]) {
    const agenda = { ofertaId: oferta.id, versaoOferta: 0, professorId: t.professorId!, fusoOrigem: "UTC", encontros: [{ data: "2099-10-01", horario: `${13 + i}:00`, duracaoMinutos: 60 }] };
    const previa = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
    const reserva = await prisma.$transaction((tx) => reservarAgendaParticularTx(tx, { ...agenda, matriculaId: matriculas[i], autorId, motivo: "Horário para validar cursor", chaveIdempotencia: `reserva-cursor-${i}`, estadoHash: previa.estadoHash, horariosAcordadosConferidos: true }));
    ids.push(reserva.id);
  }
  await prisma.$executeRaw`UPDATE "ReservaAgendaParticular" SET "expiraEm" = "criadaEm" + interval '1 millisecond'`;
  const primeira = await proximaReservaParticularVencida();
  const segunda = await proximaReservaParticularVencida();
  expect(new Set([primeira?.id, segunda?.id])).toEqual(new Set(ids));
  expect(await prisma.reservaAgendaParticular.count({ where: { status: "ATIVA" } })).toBe(2);
  expect(await proximaReservaParticularVencida()).toBeNull();
  expect((await proximaReservaParticularVencida())?.id).toBe(primeira?.id);
});

it("reserva particular serializa disputa, preserva horários e bloqueia publicação concorrente", async () => {
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const oferta = await prisma.produtoPais.findFirstOrThrow();
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "PARTICULAR_FLEXIVEL" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  const agenda = { ofertaId: oferta.id, versaoOferta: 0, professorId: t.professorId!, fusoOrigem: "UTC", encontros: [{ data: "2099-10-01", horario: "13:00", duracaoMinutos: 60 }] };
  const previa = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
  const entrada = (i: number) => ({ ...agenda, matriculaId: matriculas[i], autorId, motivo: "Horário acordado conferido", chaveIdempotencia: `particular-disputa-${i}`, estadoHash: previa.estadoHash, horariosAcordadosConferidos: true as const });
  const resultados = await Promise.allSettled([0, 1].map((i) => prisma.$transaction((tx) => reservarAgendaParticularTx(tx, entrada(i)))));
  expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const vencedor = resultados.findIndex((r) => r.status === "fulfilled");
  const r = await prisma.$transaction((tx) => reservarAgendaParticularTx(tx, entrada(vencedor)));
  expect(await prisma.reservaAgendaParticular.count()).toBe(1); expect(await prisma.horarioReservaParticular.count()).toBe(1);
  await expect(prisma.$transaction((tx) => reservarAgendaParticularTx(tx, { ...entrada(vencedor), motivo: "Mudança não autorizada" }))).rejects.toThrow("Chave");
  const funcionario = await criarUsuario(["VENDEDOR"]);
  await expect(prisma.$transaction((tx) => reservarAgendaParticularTx(tx, { ...entrada(vencedor), autorId: funcionario.id }))).rejects.toThrow();
  await expect(prisma.$transaction((tx) => reservarVagaMatriculaTx(tx, dados(vencedor)))).rejects.toThrow("horários particulares");
  const h = await prisma.horarioReservaParticular.findFirstOrThrow();
  await expect(prisma.horarioReservaParticular.update({ where: { id: h.id }, data: { fim: new Date("2099-10-01T15:00Z") } })).rejects.toThrow("imutáveis");
  await expect(prisma.reservaAgendaParticular.delete({ where: { id: r.id } })).rejects.toThrow();
  const disponibilidade = await prisma.$transaction((tx) => conferirDisponibilidadeGrade(tx, { turmaId, origem: { professorId: t.professorId }, grade: { encontros: [{ inicio: h.inicio.toISOString(), fim: h.fim.toISOString() }] } }));
  expect(disponibilidade.reservas).toHaveLength(1);
  const existente = await prisma.encontroAgenda.findFirstOrThrow();
  await expect(prisma.encontroAgenda.update({ where: { id: existente.id }, data: { inicio: h.inicio, fim: h.fim } })).rejects.toThrow("horário particular reservado");
  const outroProfessor = await criarUsuario(["PROFESSOR"]);
  await prisma.encontroAgenda.update({ where: { id: existente.id }, data: { professorId: outroProfessor.id, inicio: h.inicio, fim: h.fim } });
  await expect(prisma.encontroAgenda.update({ where: { id: existente.id }, data: { professorId: t.professorId } })).rejects.toThrow("horário particular reservado");
  await prisma.reservaAgendaParticular.update({ where: { id: r.id }, data: { expiraEm: new Date(Date.now() + 1000) } });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(Date.now() + 2000));
    const expirada = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
    expect(expirada.snapshot.impedimentos).toContain("HORARIO_RESERVADO");
  } finally { vi.useRealTimers(); }
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.alocacaoTurma.count()).toBe(0);
});


it("ausência docente preserva reservas afetadas e acompanha pendências sem liberar horários", async () => {
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const oferta = await prisma.produtoPais.findFirstOrThrow();
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "PARTICULAR_FLEXIVEL" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  const agenda = { ofertaId: oferta.id, versaoOferta: 0, professorId: t.professorId!, fusoOrigem: "UTC", encontros: [{ data: "2099-10-01", horario: "13:00", duracaoMinutos: 60 }] };
  const previa = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
  const reserva = await prisma.$transaction((tx) => reservarAgendaParticularTx(tx, { ...agenda, matriculaId: matriculas[0], autorId, motivo: "Horário acordado", chaveIdempotencia: "reserva-ausencia", estadoHash: previa.estadoHash, horariosAcordadosConferidos: true }));
  const pedido = await solicitarIndisponibilidadeDocente({ professorId: t.professorId!, inicio: "2099-10-01T13:00:00Z", fim: "2099-10-01T15:00:00Z", fusoOrigem: "UTC", motivo: "Ausência com compromisso reservado", chaveIdempotencia: "ausencia-com-reserva" });
  expect(pedido.ok).toBe(true); if (!pedido.ok || !pedido.dado) throw new Error("Pedido indisponível");
  const antes = await consultarIndisponibilidadesDocentes();
  expect(antes).toMatchObject({ ok: true, dado: { itens: [{ reservasParaConferencia: [{ reservaId: reserva.id }], reservasPendentes: [] }] } });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  if (!antes.ok || !antes.dado) throw new Error("Revisão indisponível");
  const hashAntigo = antes.dado.itens[0].impactoHash!;
  expect((await decidirIndisponibilidadeDocente({ indisponibilidadeId: pedido.dado.id, aprovar: true, motivo: "Sem conferência informada" })).ok).toBe(false);
  const encontroAlterado = await prisma.encontroAgenda.findFirstOrThrow();
  await prisma.encontroAgenda.update({ where: { id: encontroAlterado.id }, data: { inicio: new Date("2099-10-01T14:00:00Z"), fim: new Date("2099-10-01T15:00:00Z") } });
  const desatualizada = await decidirIndisponibilidadeDocente({ indisponibilidadeId: pedido.dado.id, impactoHash: hashAntigo, aprovar: true, motivo: "Impacto anterior à alteração" });
  expect(desatualizada).toMatchObject({ ok: false });
  expect(await prisma.decisaoIndisponibilidadeDocente.count({ where: { indisponibilidadeId: pedido.dado.id } })).toBe(0);
  const aprovarArgs = { indisponibilidadeId: pedido.dado.id, impactoHash: await impactoAusenciaTeste(pedido.dado.id), aprovar: true, motivo: "Ausência aprovada com pendência" };
  expect(aprovarArgs.impactoHash).not.toBe(hashAntigo);
  expect((await decidirIndisponibilidadeDocente(aprovarArgs)).ok).toBe(true);
  const depois = await consultarIndisponibilidadesDocentes();
  expect(depois).toMatchObject({ ok: true, dado: { itens: [{ reservasParaConferencia: [], reservasPendentes: [{ reservaId: reserva.id }], decisao: { reservasNaDecisao: [{ reservaId: reserva.id }] } }] } });
  expect((await prisma.reservaAgendaParticular.findUniqueOrThrow({ where: { id: reserva.id } })).status).toBe("ATIVA");
  const revisao = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
  expect(revisao.snapshot.impedimentos).toContain("HORARIO_RESERVADO"); expect(revisao.snapshot.impedimentos).toContain("INDISPONIBILIDADE_DOCENTE");
  const outro = await criarUsuario(["PROFESSOR"]); authMock.mockResolvedValue({ user: { id: outro.id } });
  expect(await consultarIndisponibilidadesDocentes()).toMatchObject({ ok: true, dado: { itens: [] } });
  expect((await consultarIndisponibilidadesDocentes({ professorId: t.professorId! })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: t.professorId! } });
  expect(await consultarIndisponibilidadesDocentes()).toMatchObject({ ok: true, dado: { itens: [{ reservasPendentes: [{ reservaId: reserva.id }] }] } });
  // Simula solução concluída em fixture; o executor de liberação ainda não existe.
  await prisma.reservaAgendaParticular.update({ where: { id: reserva.id }, data: { status: "EXPIRADA" } });
  expect(await consultarIndisponibilidadesDocentes()).toMatchObject({ ok: true, dado: { itens: [{ reservasPendentes: [], decisao: { reservasNaDecisao: [{ reservaId: reserva.id }] } }] } });
  const decisao = await prisma.decisaoIndisponibilidadeDocente.findUniqueOrThrow({ where: { indisponibilidadeId: pedido.dado.id } });
  await expect(prisma.decisaoIndisponibilidadeDocente.update({ where: { id: decisao.id }, data: { reservasAfetadas: [] } })).rejects.toThrow();
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect((await decidirIndisponibilidadeDocente(aprovarArgs)).ok).toBe(true);
  expect((await decidirIndisponibilidadeDocente({ ...aprovarArgs, impactoHash: hashAntigo })).ok).toBe(false);
});

async function impactoAusenciaTeste(id: string) {
  const r = await consultarIndisponibilidadesDocentes({ limite: 100 });
  if (!r.ok) throw new Error(r.erro);
  const hash = r.dado?.itens.find((a) => a.id === id)?.impactoHash;
  if (!hash) throw new Error("Impacto não disponível");
  return hash;
}


it.each([
  ["PARTICULAR_GRADE_FIXA", "MENSALIDADE", false], ["PARTICULAR_GRADE_FIXA", "HORA_PARTICULAR", false],
  ["PARTICULAR_FLEXIVEL", "MENSALIDADE", false], ["PARTICULAR_FLEXIVEL", "HORA_PARTICULAR", false],
  ["PARTICULAR_GRADE_FIXA", "MENSALIDADE", true], ["PARTICULAR_GRADE_FIXA", "HORA_PARTICULAR", true],
  ["PARTICULAR_FLEXIVEL", "MENSALIDADE", true], ["PARTICULAR_FLEXIVEL", "HORA_PARTICULAR", true],
] as const)("preparação comercial vincula %s / %s sem vaga fictícia; ativação=%s", async (formaAgenda, regime, ativar) => {
  const exigirPagamentoAulas = ativar && formaAgenda === "PARTICULAR_GRADE_FIXA";
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[0] } });
  const t = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const oferta = await prisma.produtoPais.findFirstOrThrow();
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda, taxaPreviaAssinatura: false, adiantamentoHoraExigido: exigirPagamentoAulas && regime === "HORA_PARTICULAR" } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC", exigirPrimeiraMensalidade: exigirPagamentoAulas } });
  if (regime === "HORA_PARTICULAR" && !await prisma.precoReferencia.count({ where: { produtoId: base.produtoId, paisId: base.paisId, tipoCobranca: "HORA_PARTICULAR", ativo: true } })) await prisma.precoReferencia.create({ data: { produtoId: base.produtoId, paisId: base.paisId, modalidadeId: t.modalidadeId, tipoCobranca: "HORA_PARTICULAR", valor: "200", moeda: base.moeda, ativo: true } });
  const vendedor = await criarUsuario(["VENDEDOR"]), outro = await criarUsuario(["VENDEDOR"]);
  const lead = await prisma.lead.create({ data: { nome: "Particular comercial", telefoneE164: "+50688881234", vendedorDonoId: vendedor.id } });
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { telefoneE164: "+50688881234" } });
  const agenda = { ofertaId: oferta.id, versaoOferta: 0, professorId: t.professorId!, fusoOrigem: "UTC", encontros: [{ data: "2099-10-01", horario: "13:00", duracaoMinutos: 60 }, ...(formaAgenda === "PARTICULAR_GRADE_FIXA" ? [{ data: "2099-10-08", horario: "13:00", duracaoMinutos: 60 }] : [])] };
  const revisao = await prisma.$transaction((tx) => conferirAgendaParticularTx(tx, agenda));
  const d = { autorId: vendedor.id, leadId: lead.id, alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, regime, taxaProposta: "999999", valorServicoProposto: "999999", ...(exigirPagamentoAulas && regime === "HORA_PARTICULAR" ? { minutosAdiantamento: 75 } : {}), motivo: "Horários particulares acordados", chaveIdempotencia: "particular-comercial", agendaParticular: { ...agenda, estadoHash: revisao.estadoHash, horariosAcordadosConferidos: true as const } };
  await expect(prisma.$transaction((tx) => prepararContratacaoTx(tx, { ...d, autorId: outro.id }))).rejects.toThrow();
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await consultarProfessoresParticular({ leadId: lead.id })).ok).toBe(false);
  expect((await revisarAgendaParticularComercial({ leadId: lead.id, ...agenda })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  const professores = await consultarProfessoresParticular({ leadId: lead.id });
  expect(professores.ok).toBe(true);
  if (!professores.ok || !professores.dado) throw new Error("Professores indisponíveis");
  expect(Object.keys(professores.dado.professores[0]).sort()).toEqual(["id", "nome"]);
  const publica = await revisarAgendaParticularComercial({ leadId: lead.id, ...agenda });
  expect(publica).toMatchObject({ ok: true, dado: { estadoHash: revisao.estadoHash, impedimentos: [], reservaEfetuada: false } });
  const conflito = await revisarAgendaParticularComercial({ leadId: lead.id, ...agenda, encontros: [{ data: "2099-10-01", horario: "12:30", duracaoMinutos: 60 }] });
  expect(conflito).toMatchObject({ ok: true, dado: { encontros: [{ conflito: true }] } });
  const existente = await prisma.encontroAgenda.findFirstOrThrow();
  expect(JSON.stringify(conflito)).not.toContain(existente.id);
  expect(JSON.stringify(conflito)).not.toContain(matriculas[0]);
  const { autorId: autorDaEntrada, ...publico } = d; void autorDaEntrada;
  const criada = await prepararContratacao({ ...publico, identidadeConferida: true });
  expect(criada.ok).toBe(true); if (!criada.ok || !criada.dado) throw new Error("Preparação pública não criada");
  const r = criada.dado;
  expect(await prisma.$transaction((tx) => prepararContratacaoTx(tx, d))).toEqual(r);
  expect(r.tipoReserva).toBe("PARTICULAR");
  expect(await prisma.preparacaoComercialMatricula.findUnique({ where: { id: r.id } })).toMatchObject({ reservaId: null, reservaParticularId: r.reservaId, matriculaId: r.matriculaId });
  expect(await prisma.reservaVagaMatricula.count()).toBe(0);
  expect(await prisma.horarioReservaParticular.count()).toBe(agenda.encontros.length);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { reserva: null, reservaParticular: { id: r.reservaId }, politicaEntrada: { formaAgenda } } } });
  authMock.mockResolvedValue({ user: { id: outro.id } });
  expect((await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).ok).toBe(false);
  await expect(prisma.$transaction((tx) => exigirEntradaMensalRegistrada(tx, r.matriculaId))).rejects.toThrow("horários reservados");
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.alocacaoTurma.count()).toBe(0);
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: base.id } })).status).toBe(base.status);
  authMock.mockResolvedValue({ user: { id: autorId } });
  await prisma.aluno.update({ where: { id: base.alunoId }, data: { email: "particular@example.test", documento: "DOC-TESTE" } });
  await prisma.matricula.update({ where: { id: r.matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  const pagador = await registrarPagadorPreparacao({ matriculaId: r.matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Pagador particular conferido", chaveIdempotencia: "particular-pagador" });
  if (!pagador.ok || !pagador.dado) throw new Error("Pagador ausente");
  const condicoes = await registrarCondicoesEntrada({ matriculaId: r.matriculaId, pagadorRegistroId: pagador.dado.id, versaoEsperada: 0, taxaVencimento: "2099-09-01", aulas: regime === "MENSALIDADE" ? { regime, cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 } : { regime, ...(exigirPagamentoAulas ? { vencimentoAdiantamento: "2099-10-01" } : {}) }, motivo: "Condições particulares conferidas", chaveIdempotencia: "particular-condicoes" });
  expect(condicoes).toMatchObject({ ok: true });
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  let modeloId = "";
  for (const incluir of [false, true]) {
    authMock.mockResolvedValue({ user: { id: autorId } });
    const modelo = await prepararModeloContratual({ codigo: "PARTICULAR", versaoEsperada: incluir ? 1 : 0, motivo: "Modelo de teste particular", chaveIdempotencia: `modelo-particular-${incluir}`, conteudo: { titulo: "Contrato particular", finalidade: "CONTRATO", regimes: [regime], aplicacao: "Oferta particular de teste", campos: [{ chave: "agenda", descricao: "Agenda acordada", origem: "AGENDA_PARTICULAR" }], secoes: [{ titulo: "Encontros", texto: incluir ? "Agenda acordada: {{agenda}}" : "Conteúdo sem campo da agenda." }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }] } });
    if (!modelo.ok || !modelo.dado) throw new Error("Modelo ausente");
    modeloId = modelo.dado.id;
    const registro = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modeloId } });
    authMock.mockResolvedValue({ user: { id: admin.id } });
    expect((await decidirModeloContratual({ modeloId, conteudoHash: registro.conteudoHash, aprovada: true, motivo: "Modelo aprovado por outra pessoa" })).ok).toBe(true);
    authMock.mockResolvedValue({ user: { id: autorId } });
    if (!incluir) expect(await consultarPreenchimentoContratual({ matriculaId: r.matriculaId, modeloId })).toMatchObject({ ok: false, erro: expect.stringContaining("corpo do documento") });
  }
  const preenchida = await consultarPreenchimentoContratual({ matriculaId: r.matriculaId, modeloId });
  expect(preenchida.ok).toBe(true); if (!preenchida.ok || !preenchida.dado) throw new Error("Prévia indisponível");
  const texto = preenchida.dado.snapshot.documento.secoes[0].texto;
  expect(texto).toContain("Fuso: UTC"); expect(texto).toContain("01/10/2099"); expect(texto).toContain("60 minutos");
  expect(texto).toContain(formaAgenda === "PARTICULAR_GRADE_FIXA" ? "Grade fixa" : "Agenda flexível");
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: "TURMA", versaoEntrada: 1 } });
  expect((await consultarPreenchimentoContratual({ matriculaId: r.matriculaId, modeloId })).ok).toBe(true);
  const registrada = await registrarPreviaContratual({ matriculaId: r.matriculaId, modeloId, revisaoHash: preenchida.dado.revisaoHash, aplicacaoConferida: true, motivo: "Agenda conferida para contrato", chaveIdempotencia: "previa-particular" });
  expect(registrada.ok).toBe(true);
  const revisaoEntrada = await consultarRevisaoEmissao(r.matriculaId);
  if (!revisaoEntrada.ok || !revisaoEntrada.dado) throw new Error("Revisão particular indisponível");
  expect(revisaoEntrada.dado.dadosVisiveis.agendaParticular).toContain("Fuso: UTC");
  const emitir = { matriculaId: r.matriculaId, revisaoHash: revisaoEntrada.dado.hash, cadastroDocumentosConferidos: true as const, condicoesConferidas: true as const, motivo: "Agenda particular e condições conferidas", chaveIdempotencia: "emissao-particular" };
  await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: false } });
  expect(await consultarPreenchimentoContratual({ matriculaId: r.matriculaId, modeloId })).toMatchObject({ ok: false, erro: expect.stringContaining("professor") });
  expect(await conferirEEmitirEntrada(emitir)).toMatchObject({ ok: false, erro: expect.stringContaining("professor") });
  expect(await prisma.cobranca.count()).toBe(0);
  await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: true, nome: "Professor atualizado" } });
  expect(await conferirEEmitirEntrada(emitir)).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
  const atualizada = await consultarRevisaoEmissao(r.matriculaId);
  if (!atualizada.ok || !atualizada.dado) throw new Error("Revisão atualizada indisponível");
  const entradaAtual = { ...emitir, revisaoHash: atualizada.dado.hash };
  expect((await consultarPagamentosEntradaParticular(r.matriculaId)).ok).toBe(false);
  const emitida = await conferirEEmitirEntrada(entradaAtual);
  expect(emitida).toMatchObject({ ok: true });
  expect(await conferirEEmitirEntrada(entradaAtual)).toEqual(emitida);
  const pagamentosEntrada = await consultarPagamentosEntradaParticular(r.matriculaId);
  expect(pagamentosEntrada).toMatchObject({ ok: true, dado: { pagamentosExigidosConfirmados: false, regime, itens: expect.arrayContaining([{ id: expect.any(String), tipo: "MATRICULA", moeda: expect.any(String), valor: expect.any(String), versao: expect.any(Number), confirmada: false, exigido: true, minutos: null, pendencia: expect.any(String) }]) } });
  expect(JSON.stringify(pagamentosEntrada)).not.toMatch(/telefone|email|documento|snapshot|chaveIdempotencia/);
  expect(await consultarTelaEmissao(r.matriculaId)).toMatchObject({ ok: true, dado: { particular: true } });
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await consultarPagamentosEntradaParticular(r.matriculaId)).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await prisma.cobranca.count({ where: { matriculaId: r.matriculaId } })).toBe(exigirPagamentoAulas ? 2 : 1);
  expect(await prisma.emissaoCobrancasEntrada.findFirst({ where: { matriculaId: r.matriculaId } })).toMatchObject({ memoria: { agendaParticular: { reservaId: r.reservaId, formaAgenda } } });
  const previaAtual = await consultarPreenchimentoContratual({ matriculaId: r.matriculaId, modeloId });
  if (!previaAtual.ok || !previaAtual.dado) throw new Error("Prévia atual ausente");
  const novaPrevia = await registrarPreviaContratual({ matriculaId: r.matriculaId, modeloId, revisaoHash: previaAtual.dado.revisaoHash, aplicacaoConferida: true, motivo: "Docente atualizado no documento", chaveIdempotencia: "previa-particular-atual" });
  if (!novaPrevia.ok || !novaPrevia.dado) throw new Error("Prévia atual não registrada");
  const aluno = await prisma.aluno.findUniqueOrThrow({ where: { id: base.alunoId } });
  const participantes = await conferirParticipantesContratuais({ previaId: novaPrevia.dado.id, versaoEsperada: 0, maioridade: null,
    participantes: [{ papel: "ALUNO", identidade: { nome: [aluno.primeiroNome, aluno.sobrenome].filter(Boolean).join(" "), email: aluno.email!, documento: aluno.documento! } }],
    identificacoesConferidas: true, motivo: "Signatário particular conferido", chaveIdempotencia: "participante-particular" });
  expect(participantes, JSON.stringify(participantes)).toMatchObject({ ok: true });
  if (!participantes.ok || !participantes.dado) throw new Error("Participantes ausentes");
  const original = await preservarOriginalContratual({ previaId: novaPrevia.dado.id, conferenciaId: participantes.dado.id, conteudoConferido: true, motivo: "Original particular conferido" });
  expect(original).toMatchObject({ ok: true });
  if (!original.ok || !original.dado) throw new Error("Original ausente");
  const alvo = { matriculaId: r.matriculaId, artefatoId: original.dado.id };
  const assinatura = await consultarConferenciaAssinatura(alvo);
  expect(assinatura).toMatchObject({ ok: true, dado: { pendencia: null, revisao: { dados: { reserva: { id: r.reservaId, turmaId: null }, taxa: { confirmada: false }, regraTaxa: "SEM_PAGAMENTO_PREVIO" } } } });
  if (!assinatura.ok || !assinatura.dado?.revisao) throw new Error("Revisão de assinatura ausente");
  expect(assinatura.dado.revisao.dados.agenda).toHaveLength(agenda.encontros.length);
  const confirmar = { ...alvo, revisaoHash: assinatura.dado.revisao.hash, dadosConferidos: true as const, motivo: "Particular apta à assinatura", chaveIdempotencia: "assinatura-particular" };
  await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: false } });
  expect((await registrarConferenciaAssinatura(confirmar)).ok).toBe(false);
  expect(await prisma.conferenciaAssinaturaContratual.count()).toBe(0);
  await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: true } });
  const conferida = await registrarConferenciaAssinatura(confirmar);
  expect(conferida).toMatchObject({ ok: true, dado: { envioRealizado: false } });
  expect(await registrarConferenciaAssinatura(confirmar)).toEqual(conferida);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(0);
  expect(await conferirReservaParticularSecretaria({ reservaId: r.reservaId })).toMatchObject({ ok: true, dado: { resultado: "PRAZO_VIGENTE" } });
  if (ativar) {
    if (!conferida.ok || !conferida.dado) throw new Error("Conferência ausente");
    // Protocolo de produção simulado somente no banco descartável; nenhum envio real.
    const processo = await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, { ...alvo, conferenciaId: conferida.dado!.id, executorId: autorId, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }));
    const tentativa = await prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: processo.id, executorId: autorId }));
    await prisma.$transaction(tx => registrarResultadoEnvioTx(tx, { processoId: processo.id, tentativaId: tentativa.tentativaId, chave: "envio-particular", resultado: "REGISTRADO", referenciaExterna: "particular-fixture", evidenciaHash: "c".repeat(64) }));
    const fonte = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id }, include: { artefato: { include: { conferencia: true } } } });
    const pessoas = ConferirParticipantesSchema.innerType().shape.participantes.element.strip().array().parse((fonte.artefato.conferencia.snapshot as { participantes: unknown }).participantes);
    const envioRegistrado = await prisma.tentativaEnvioAssinatura.findUniqueOrThrow({ where: { id: tentativa.tentativaId }, select: { iniciadaEm: true } });
    // O envio usa o relógio do PostgreSQL; a assinatura simulada só pode ocorrer depois dele.
    // Não alterar timestamps persistidos nem flexibilizar a validação de produção.
    const esperaEnvio = envioRegistrado.iniciadaEm.getTime() - Date.now();
    if (esperaEnvio > 5000) throw new Error("Sincronize os relógios do banco descartável e do executor de testes.");
    if (esperaEnvio >= 0) await new Promise(resolve => setTimeout(resolve, esperaEnvio + 2));
    const momento = new Date().toISOString();
    const concluida = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: "particular-fixture", originalHash: fonte.artefato.pdfHash,
      concluidaEm: momento, pdfAssinado: Buffer.from("%PDF-1.7 particular assinada fixture"), evidencias: Buffer.from("Auditoria fictícia particular"),
      assinaturas: pessoas.map(pessoa => ({ papel: pessoa.papel, identidadeHash: hashPrevia(pessoa.identidade), referenciaAssinatura: `particular-${pessoa.papel}`, assinadaEm: momento })) }));
    const alvoAceite = { matriculaId: r.matriculaId, conclusaoId: concluida.id };
    const aceite = await consultarAceiteOriginal(alvoAceite);
    if (!aceite.ok || !aceite.dado?.revisao) throw new Error(`Aceite ausente: ${JSON.stringify(aceite)}`);
    expect(await confirmarAceiteOriginal({ ...alvoAceite, revisaoHash: aceite.dado.revisao.hash, evidenciasConferidas: true, motivo: "Aceite particular de teste conferido", chaveIdempotencia: "aceite-particular" })).toMatchObject({ ok: true });
    expect(await concluirMatricula(r.matriculaId)).toMatchObject({ ok: false, erro: expect.stringContaining("pagamentos exigidos") });
    const financeiro = await criarUsuario(["FINANCEIRO"]);
    const taxa = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.matriculaId, tipo: "MATRICULA" } });
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxa.id, autorId: financeiro.id, chaveIdempotencia: "taxa-particular", valorRecebido: taxa.valorNegociado.toNumber(), forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Comprovante conferido para reserva e contratação" }));
    if (exigirPagamentoAulas) {
      expect(await concluirMatricula(r.matriculaId)).toMatchObject({ ok: false, erro: expect.stringContaining("pagamentos exigidos") });
      const aulas = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.matriculaId, tipo: { not: "MATRICULA" } } });
      await prisma.$transaction(tx => receberTx(tx, { cobrancaId: aulas.id, autorId: financeiro.id, chaveIdempotencia: "aulas-particular", valorRecebido: aulas.valorNegociado.toNumber(), forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Comprovante conferido para reserva e contratação" }));
    }
    const adminComissao = await criarUsuario(["ADMINISTRADOR"]);
    await prisma.politicaComissao.create({ data: { paisId: base.paisId, produtoId: base.produtoId, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: base.moeda, vigenteEm: new Date("2020-01-01"), criadaPorId: adminComissao.id } });
    // Outro contrato do mesmo aluno permanece ativo e sua alocação não é substituída.
    await prisma.matricula.update({ where: { id: base.id }, data: { status: "ATIVA" } });
    const vinculoAnterior = await prisma.alocacaoTurma.create({ data: { alunoId: base.alunoId, matriculaId: base.id, turmaId } });
    await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: false } });
    await expect(prisma.$transaction(tx => ativarPreparacaoTx(tx, r.matriculaId, autorId))).rejects.toThrow("professor");
    await prisma.usuario.update({ where: { id: t.professorId! }, data: { ativo: true } });
    await expect(prisma.$transaction(async tx => { await ativarPreparacaoTx(tx, r.matriculaId, autorId); throw new Error("Falha após encontros"); })).rejects.toThrow("Falha após encontros");
    expect(await prisma.encontroAgenda.count({ where: { matriculaId: r.matriculaId } })).toBe(0);
    expect(await prisma.reservaAgendaParticular.findUnique({ where: { id: r.reservaId } })).toMatchObject({ status: "ATIVA" });
    const resultados = await Promise.all([0, 1].map(() => prisma.$transaction(tx => ativarPreparacaoTx(tx, r.matriculaId, autorId), { timeout: 20000 })));
    expect(resultados[0]).toEqual(resultados[1]);
    expect(await concluirMatricula(r.matriculaId)).toMatchObject({ ok: true });
    expect(await prisma.matricula.findUnique({ where: { id: r.matriculaId } })).toMatchObject({ status: "ATIVA" });
    expect(await prisma.matricula.findUnique({ where: { id: base.id } })).toMatchObject({ status: "ATIVA" });
    expect(await prisma.alocacaoTurma.findUnique({ where: { id: vinculoAnterior.id } })).toMatchObject({ ativa: true });
    expect(await prisma.alocacaoTurma.count({ where: { matriculaId: r.matriculaId } })).toBe(0);
    expect(await prisma.reservaAgendaParticular.findUnique({ where: { id: r.reservaId } })).toMatchObject({ status: "UTILIZADA" });
    const encontrosAtivados = await prisma.encontroAgenda.findMany({ where: { matriculaId: r.matriculaId }, orderBy: { inicio: "asc" } });
    expect(encontrosAtivados).toHaveLength(agenda.encontros.length);
    expect(encontrosAtivados.every(e => e.turmaId === null && e.status === "PREVISTO" && e.professorId === t.professorId && e.fusoOrigem === "UTC")).toBe(true);
    const reservados = await prisma.horarioReservaParticular.findMany({ where: { reservaId: r.reservaId }, orderBy: { inicio: "asc" } });
    expect(encontrosAtivados.map(e => [e.inicio, e.fim])).toEqual(reservados.map(h => [h.inicio, h.fim]));
    expect(await prisma.cobranca.count({ where: { matriculaId: r.matriculaId, tipo: "MENSALIDADE" } })).toBe(regime === "MENSALIDADE" ? 1 : 0);
    expect(await prisma.cobranca.count({ where: { matriculaId: r.matriculaId, tipo: "HORA_PARTICULAR" } })).toBe(exigirPagamentoAulas && regime === "HORA_PARTICULAR" ? 1 : 0);
    expect(await prisma.comissao.count({ where: { matriculaId: r.matriculaId, vendedorId: vendedor.id } })).toBe(1);
    expect(await prisma.evento.count({ where: { agregadoId: r.matriculaId, tipo: "MatriculaAtivada" } })).toBe(1);
    if (regime === "HORA_PARTICULAR" && exigirPagamentoAulas) {
      authMock.mockResolvedValue({ user: { id: financeiro.id } });
      const antecipacao = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.matriculaId, tipo: "HORA_PARTICULAR" } });
      const recebimentosAntes = await prisma.recebimento.findMany({ where: { destinacoes: { some: { cobrancaId: antecipacao.id } } }, orderBy: { id: "asc" } });
      const compra = { alunoId: base.alunoId, matriculaId: r.matriculaId, cobrancaId: antecipacao.id, versaoCobranca: antecipacao.versao, minutosComprados: 75, evidenciaCondicoes: "Adiantamento aceito e recebido conferido", chaveIdempotencia: "compra-preparada" };
      expect(await registrarCompraHorasAntecipadas({ ...compra, minutosComprados: 750 })).toMatchObject({ ok: false, erro: expect.stringContaining("adiantamento contratado") });
      expect(await prisma.compraHorasAntecipadas.count()).toBe(0);
      const registrada = await registrarCompraHorasAntecipadas(compra);
      expect(registrada).toMatchObject({ ok: true });
      expect(await registrarCompraHorasAntecipadas(compra)).toEqual(registrada);
      const preservada = await prisma.compraHorasAntecipadas.findFirstOrThrow({ where: { matriculaId: r.matriculaId } });
      expect(preservada.minutosComprados).toBe(75);
      expect(preservada.valorPagoAlocado.equals(antecipacao.valorNegociado)).toBe(true);
      expect(preservada.descontoOriginal.isZero()).toBe(true);
      expect(preservada.snapshot).toMatchObject({ preparacao: { preparacaoId: r.id, minutosContratados: 75 }, valorReferenciaCobranca: antecipacao.valorOriginal.toString() });
      expect(await prisma.recebimento.findMany({ where: { destinacoes: { some: { cobrancaId: antecipacao.id } } }, orderBy: { id: "asc" } })).toEqual(recebimentosAntes);
      authMock.mockResolvedValue({ user: { id: autorId } });
    }
    await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda } });
    expect((await prisma.$transaction(tx => conferirAgendaParticularTx(tx, { ...agenda, versaoOferta: 1 }))).snapshot.impedimentos).toContain("CONFLITO_AGENDA");
    return;
  }
  if (regime === "MENSALIDADE") {
    if (formaAgenda === "PARTICULAR_GRADE_FIXA") {
      const caixa = await criarUsuario(["FINANCEIRO"]);
      const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.matriculaId, saldo: { gte: 1 }, status: { in: ["PENDENTE", "ATRASADO"] } } });
      await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: caixa.id, valorRecebido: 1, forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Pagamento parcial preserva reserva particular", chaveIdempotencia: "reserva-particular-parcial" }));
    }
    else await prisma.documento.create({ data: { matriculaId: r.matriculaId, categoria: "CONTRATO", nome: "Contrato em conferência", url: "/api/files/contrato-teste.pdf" } });
  }
  if (regime === "HORA_PARTICULAR" && formaAgenda === "PARTICULAR_GRADE_FIXA") {
    if (!conferida.ok || !conferida.dado) throw new Error("Conferência ausente");
    // Provedor somente de fixture, sem chamada externa ou configuração operacional.
    await prisma.$transaction((tx) => prepararProcessoEnvioTx(tx, { ...alvo, conferenciaId: conferida.dado!.id, executorId: autorId, fornecedor: "ZAPSIGN", ambiente: "SANDBOX" }));
  }
  const reservaFinal = await prisma.reservaAgendaParticular.findUniqueOrThrow({ where: { id: r.reservaId } });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(reservaFinal.expiraEm.getTime() + 1000));
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    expect((await conferirReservaParticularSecretaria({ reservaId: r.reservaId })).ok).toBe(false);
    expect((await listarReservasParticularesSecretaria({})).ok).toBe(false);
    expect((await consultarResolucoesParticulares({ reservaId: r.reservaId })).ok).toBe(false);
    authMock.mockResolvedValue({ user: { id: autorId } });
    const painel = await listarReservasParticularesSecretaria({ matriculaId: r.matriculaId });
    expect(painel).toMatchObject({ ok: true, dado: { registros: [{ id: r.reservaId, particular: true, quantidadeHorarios: agenda.encontros.length, podeConferir: true }] } });
    if (!painel.ok || !painel.dado) throw new Error("Painel particular indisponível");
    expect(painel.dado.registros).toHaveLength(1);
    expect(painel.dado.registros[0]).not.toHaveProperty("snapshot");
    expect(painel.dado.registros[0].matricula.aluno).not.toHaveProperty("telefoneE164");
    expect(await listarReservasParticularesSecretaria({ matriculaId: base.id })).toMatchObject({ ok: true, dado: { registros: [] } });
    const manter = regime === "MENSALIDADE" || formaAgenda === "PARTICULAR_GRADE_FIXA";
    const lote = await rodarVencimentoParticulares();
    expect(lote).toMatchObject({ avaliadas: 1, expiradas: manter ? 0 : 1, mantidas: manter ? 1 : 0, falhas: 0 });
    expect(await prisma.reservaAgendaParticular.findUnique({ where: { id: r.reservaId } })).toMatchObject({ status: manter ? "MANTIDA_PENDENCIA" : "EXPIRADA" });
    expect(await rodarVencimentoParticulares()).toMatchObject({ avaliadas: 0, expiradas: 0, mantidas: 0, falhas: 0 });
    expect(await conferirReservaParticularSecretaria({ reservaId: r.reservaId })).toMatchObject({ ok: true, dado: { resultado: "SEM_TRANSICAO" } });
    expect(await prisma.horarioReservaParticular.count({ where: { reservaId: r.reservaId } })).toBe(agenda.encontros.length);
    expect(await prisma.cobranca.count({ where: { matriculaId: r.matriculaId } })).toBe(1);
    const ocupantes = await listarReservasParticularesSecretaria({ matriculaId: r.matriculaId });
    if (!ocupantes.ok || !ocupantes.dado) throw new Error("Ocupantes indisponíveis");
    expect(ocupantes.dado.registros).toHaveLength(manter ? 1 : 0);
    expect(await listarReservasParticularesSecretaria({ matriculaId: r.matriculaId, historico: true })).toMatchObject({ ok: true, dado: { registros: [{ id: r.reservaId, podeConferir: false }] } });
    if (!manter) {
      await prisma.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda, versaoEntrada: 2 } });
      const agendaNova = { ...agenda, versaoOferta: 2 };
      const alvoRetomada = { matriculaId: r.matriculaId, anteriorId: r.reservaId, agenda: agendaNova };
      authMock.mockResolvedValue({ user: { id: vendedor.id } });
      expect((await consultarFormularioNovaReserva({ matriculaId: r.matriculaId })).ok).toBe(false);
      authMock.mockResolvedValue({ user: { id: autorId } });
      const formularioNova = await consultarFormularioNovaReserva({ matriculaId: r.matriculaId });
      expect(formularioNova).toMatchObject({ ok: true, dado: { anteriorId: r.reservaId, ofertaId: oferta.id, versaoOferta: 2, formaAgenda } });
      if (!formularioNova.ok || !formularioNova.dado) throw new Error("Formulário indisponível");
      expect(formularioNova.dado.professores[0]).toEqual({ id: t.professorId, nome: "Professor atualizado" });
      expect(await consultarFormularioNovaReserva({ matriculaId: r.matriculaId, buscaProfessor: "Nome inexistente" })).toMatchObject({ ok: true, dado: { professores: [] } });
      expect((await consultarFormularioNovaReserva({ matriculaId: r.matriculaId, pagina: 0 })).ok).toBe(false);
      await expect(prisma.$transaction((tx) => revisarNovaReservaParticularTx(tx, alvoRetomada, vendedor.id))).rejects.toThrow();
      authMock.mockResolvedValue({ user: { id: vendedor.id } });
      expect((await revisarNovaReservaParticular(alvoRetomada)).ok).toBe(false);
      authMock.mockResolvedValue({ user: { id: autorId } });
      const publica = await revisarNovaReservaParticular(alvoRetomada);
      if (!publica.ok || !publica.dado) throw new Error("Revisão pública ausente");
      expect(publica.dado).not.toHaveProperty("snapshot");
      expect(publica.dado.cobrancas).toHaveLength(1);
      const revista = { revisaoHash: publica.dado.revisaoHash };
      const executarRetomada = { ...alvoRetomada, autorId, revisaoHash: revista.revisaoHash, motivo: "Preservar cadeia da preparação", chaveIdempotencia: "nova-reserva-teste", dadosConferidos: true as const };
      await expect(prisma.$transaction((tx) => criarNovaReservaParticularTx(tx, { ...executarRetomada, revisaoHash: "0".repeat(64) }))).rejects.toThrow("mudou");
      expect(await prisma.reservaAgendaParticular.count({ where: { matriculaId: r.matriculaId } })).toBe(1);
      const { autorId: autorInterno, ...confirmacaoPublica } = executarRetomada;
      void autorInterno;
      await prisma.aluno.update({ where: { id: base.alunoId }, data: { rua: "Endereço atualizado para conferência" } });
      expect(await confirmarNovaReservaParticular(confirmacaoPublica)).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
      const revisadaPublica = await revisarNovaReservaParticular(alvoRetomada);
      if (!revisadaPublica.ok || !revisadaPublica.dado) throw new Error("Revisão nova ausente");
      executarRetomada.revisaoHash = revisadaPublica.dado.revisaoHash;
      confirmacaoPublica.revisaoHash = revisadaPublica.dado.revisaoHash;
      const tentativas = [executarRetomada, { ...executarRetomada, chaveIdempotencia: "nova-reserva-concorrente" }];
      const concorrentes = await Promise.allSettled(tentativas.map((tentativa) => prisma.$transaction((tx) => criarNovaReservaParticularTx(tx, tentativa), { timeout: 20000 })));
      expect(concorrentes.filter((c) => c.status === "fulfilled")).toHaveLength(1);
      expect(concorrentes.filter((c) => c.status === "rejected")).toHaveLength(1);
      const vencedora = concorrentes.findIndex((c) => c.status === "fulfilled");
      executarRetomada.chaveIdempotencia = tentativas[vencedora].chaveIdempotencia;
      confirmacaoPublica.chaveIdempotencia = tentativas[vencedora].chaveIdempotencia;
      expect(await prisma.reservaAgendaParticular.count({ where: { matriculaId: r.matriculaId } })).toBe(2);
      expect(await prisma.retomadaReservaParticular.count()).toBe(1);
      expect(await prisma.evento.count({ where: { agregadoId: r.matriculaId, tipo: "RetomadaParticularConfirmada" } })).toBe(1);
      const confirmadaPublica = await confirmarNovaReservaParticular(confirmacaoPublica);
      expect(confirmadaPublica).toMatchObject({ ok: true });
      if (!confirmadaPublica.ok || !confirmadaPublica.dado) throw new Error("Retomada pública ausente");
      const retomada = confirmadaPublica.dado;
      expect(await prisma.$transaction((tx) => criarNovaReservaParticularTx(tx, executarRetomada))).toEqual(retomada);
      await expect(prisma.$transaction((tx) => criarNovaReservaParticularTx(tx, { ...executarRetomada, motivo: "Condições alteradas na repetição" }))).rejects.toThrow("Chave");
      const nova = await prisma.reservaAgendaParticular.findUniqueOrThrow({ where: { id: retomada.reservaId } });
      const vinculo = { anteriorId: r.reservaId, novaId: nova.id, autorId, motivo: "Preservar cadeia da preparação" };
      await expect(prisma.$transaction((tx) => vincularNovaReservaParticularTx(tx, { ...vinculo, autorId: vendedor.id }))).rejects.toThrow();
      const ligado = await prisma.$transaction((tx) => vincularNovaReservaParticularTx(tx, vinculo));
      expect(await prisma.$transaction((tx) => vincularNovaReservaParticularTx(tx, vinculo))).toEqual(ligado);
      expect(await prisma.$transaction((tx) => resolverReservaParticularAtual(tx, r.reservaId))).toBe(nova.id);
      expect(await prisma.preparacaoComercialMatricula.findUnique({ where: { id: r.id } })).toMatchObject({ reservaParticularId: r.reservaId });
      expect(await consultarPreparacaoContratacao({ matriculaId: r.matriculaId })).toMatchObject({ ok: true, dado: { preparacao: { reservaParticular: { id: nova.id, status: "ATIVA" }, reservaParticularOriginal: { id: r.reservaId, status: "EXPIRADA" } } } });
      const novoDocumento = await consultarPreenchimentoContratual({ matriculaId: r.matriculaId, modeloId });
      expect(novoDocumento).toMatchObject({ ok: true, dado: { snapshot: { agendaParticular: { reservaId: nova.id } } } });
      expect(await consultarConferenciaAssinatura(alvo)).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.any(String) } });
      expect(await prisma.artefatoContratual.count({ where: { id: original.dado.id } })).toBe(1);
      await expect(prisma.retomadaReservaParticular.update({ where: { id: ligado.id }, data: { motivo: "Alteração indevida" } })).rejects.toThrow();
      await expect(prisma.$transaction((tx) => vincularNovaReservaParticularTx(tx, { ...vinculo, motivo: "Outra decisão sobre mesma origem" }))).rejects.toThrow("outro vínculo");
      vi.setSystemTime(new Date(nova.expiraEm.getTime() + 1000));
      expect(await conferirReservaParticularSecretaria({ reservaId: nova.id })).toMatchObject({ ok: true, dado: { status: "EXPIRADA" } });
      expect(await confirmarNovaReservaParticular(confirmacaoPublica)).toEqual(confirmadaPublica);
      expect(await prisma.reservaAgendaParticular.findUnique({ where: { id: nova.id } })).toMatchObject({ status: "EXPIRADA" });
      await prisma.usuario.update({ where: { id: autorId }, data: { ativo: false } });
      expect((await confirmarNovaReservaParticular(confirmacaoPublica)).ok).toBe(false);
      await prisma.usuario.update({ where: { id: autorId }, data: { ativo: true } });
      expect(await prisma.cobranca.count({ where: { matriculaId: r.matriculaId } })).toBe(1);
    }
    if (manter) {
      const tipo = formaAgenda === "PARTICULAR_GRADE_FIXA" ? "PRORROGAR" as const : "LIBERAR" as const;
      const entradaResolucao = { reservaId: r.reservaId, versaoAnterior: 0, tipo, novoPrazo: tipo === "PRORROGAR" ? new Date(Date.now() + 60000).toISOString() : undefined,
        motivo: "Resolver pendência particular", tratamentoContratacao: "Documentos e valores seguem conferência própria, sem estorno automático.", chaveIdempotencia: "resolucao-particular" };
      authMock.mockResolvedValue({ user: { id: admin.id } });
      const proposta = await prepararResolucaoParticular(entradaResolucao);
      expect(proposta).toMatchObject({ ok: true });
      if (!proposta.ok || !proposta.dado) throw new Error("Proposta de resolução ausente");
      const decisao = { propostaId: proposta.dado.id, aprovar: true, motivo: "Resolução conferida independentemente" };
      expect(await consultarResolucoesParticulares({ reservaId: r.reservaId })).toMatchObject({ ok: true, dado: { registros: [{ id: proposta.dado.id, podeDecidir: false }] } });
      expect((await decidirResolucaoParticular(decisao)).ok).toBe(false);
      authMock.mockResolvedValue({ user: { id: autorId } });
      expect((await decidirResolucaoParticular(decisao)).ok).toBe(false);
      const outroAdmin = await criarUsuario(["ADMINISTRADOR"]);
      authMock.mockResolvedValue({ user: { id: outroAdmin.id } });
      const revisaoResolucao = await consultarResolucoesParticulares({ reservaId: r.reservaId });
      expect(revisaoResolucao).toMatchObject({ ok: true, dado: { registros: [{ podeDecidir: true, podeAprovar: true }] } });
      if (!revisaoResolucao.ok || !revisaoResolucao.dado) throw new Error("Consulta ausente");
      expect(revisaoResolucao.dado.registros[0]).not.toHaveProperty("snapshot");
      await prisma.documento.create({ data: { matriculaId: r.matriculaId, categoria: "CONTRATO", nome: "Nova evidência após revisão", url: "/api/files/revisao-alterada.pdf" } });
      expect(await consultarResolucoesParticulares({ reservaId: r.reservaId })).toMatchObject({ ok: true, dado: { registros: [{ podeAprovar: false }] } });
      expect(await decidirResolucaoParticular(decisao)).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
      expect(await prisma.decisaoResolucaoParticular.count()).toBe(0);
      authMock.mockResolvedValue({ user: { id: admin.id } });
      const revisada = await prepararResolucaoParticular({ ...entradaResolucao, versaoAnterior: 1, chaveIdempotencia: "resolucao-particular-revisada" });
      if (!revisada.ok || !revisada.dado) throw new Error("Proposta revisada ausente");
      decisao.propostaId = revisada.dado.id;
      authMock.mockResolvedValue({ user: { id: outroAdmin.id } });
      const decidida = await decidirResolucaoParticular(decisao);
      expect(decidida).toMatchObject({ ok: true });
      expect(await decidirResolucaoParticular(decisao)).toEqual(decidida);
      expect(await consultarResolucoesParticulares({ reservaId: r.reservaId })).toMatchObject({ ok: true, dado: { podePreparar: false, registros: [{ id: revisada.dado.id, decisao: { aprovada: true } }, { id: proposta.dado.id, decisao: null }] } });
      expect(await prisma.reservaAgendaParticular.findUnique({ where: { id: r.reservaId } })).toMatchObject({ status: tipo === "PRORROGAR" ? "ATIVA" : "LIBERADA" });
      await expect(prisma.propostaResolucaoParticular.update({ where: { id: proposta.dado.id }, data: { motivo: "Alteração indevida" } })).rejects.toThrow();
      expect(await prisma.cobranca.count({ where: { matriculaId: r.matriculaId } })).toBe(1);
    }
  } finally { vi.useRealTimers(); }
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).status).not.toBe("ATIVA");
  expect(await prisma.alocacaoTurma.count()).toBe(0);
  const financeiroEntrada = await criarUsuario(["FINANCEIRO"]);
  const taxaEntrada = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.matriculaId, tipo: "MATRICULA" } });
  const restanteEntrada = taxaEntrada.valorNegociado.minus(taxaEntrada.valorRecebido ?? 0);
  if (restanteEntrada.gt(0)) await prisma.$transaction(tx => receberTx(tx, { cobrancaId: taxaEntrada.id, chaveIdempotencia: "receber-particular-entrada", autorId: financeiroEntrada.id, valorRecebido: restanteEntrada.toNumber(), forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Comprovante conferido para reserva e contratação" }));
  authMock.mockResolvedValue({ user: { id: financeiroEntrada.id } });
  expect(await consultarPagamentosEntradaParticular(r.matriculaId)).toMatchObject({ ok: true, dado: { pagamentosExigidosConfirmados: true } });
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: r.matriculaId } })).status).not.toBe("ATIVA");
  await prisma.usuario.update({ where: { id: financeiroEntrada.id }, data: { ativo: false } });
  expect((await consultarPagamentosEntradaParticular(r.matriculaId)).ok).toBe(false);
});
