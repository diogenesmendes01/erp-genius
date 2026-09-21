import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { instanteDaGrade } from "@/server/agenda/grade";
import { prepararContratacao } from "./preparacao-comercial";
import { registrarPagadorPreparacao } from "@/server/secretaria/pagador-preparacao";
import { registrarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
import { conferirEEmitirEntrada, consultarRevisaoEmissao } from "@/server/secretaria/conferencia-emissao";
import { consultarEncontrosDocente } from "@/server/agenda/encontros-docente";
import { prepararCondicoesContinuidadeMensal, decidirCondicoesContinuidadeMensal } from "./condicoes-continuidade-mensal";
import { POST as emitirContinuidade } from "@/app/api/financeiro/continuidade/cron/route";
import { carregarContinuidadeMensalTx } from "./continuidade-estado-tx";
import { prepararModeloContratual, decidirModeloContratual } from "@/server/contratos/modelos";
import { consultarPreenchimentoContratual, registrarPreviaContratual } from "@/server/contratos/previas";
import { conferirParticipantesContratuais } from "@/server/contratos/participantes";
import { preservarOriginalContratual } from "@/server/contratos/originais";
import { consultarConferenciaAssinatura, registrarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";
import { prepararProcessoEnvioTx, iniciarTentativaAssinaturaTx, registrarResultadoEnvioTx } from "@/server/contratos/envio-tx";
import { preservarConclusaoAssinaturaTx } from "@/server/contratos/conclusao-assinatura-tx";
import { consultarAceiteOriginal, confirmarAceiteOriginal } from "@/server/contratos/aceite";
import { ConferirParticipantesSchema } from "@/server/contratos/participantes-schema";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { concluirMatricula } from "./acoes";

describe("CT-06: cobertura, vencimento e agenda preservam seus fusos próprios", () => {
  let secretariaId: string, administradorId: string, professorId: string, alunoId: string, produtoId: string, paisId: string, turmaId: string, encontroId: string, calendarioId: string, gradeId: string;

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await truncarBanco();
    await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60, exigirPrimeiraMensalidade: true, fusoInstitucional: "America/Costa_Rica" } });
    const catalogo = await seedCatalogoMinimo();
    await prisma.produtoPais.update({ where: { produtoId_paisId: { produtoId: catalogo.produto.id, paisId: catalogo.pais.id } }, data: { formaAgenda: "TURMA", taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
    const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria CT-06");
    const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão CT-06");
    const administrador = await criarUsuario([Papel.ADMINISTRADOR], "Administração CT-06");
    const professor = await criarUsuario([Papel.PROFESSOR], "Docente CT-06");
    secretariaId = secretaria.id; administradorId = administrador.id; professorId = professor.id;
    authMock.mockResolvedValue({ user: { id: secretariaId } });

    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "CT06", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professorId, capacidade: 2, status: "ABERTA" } });
    turmaId = turma.id;
    await prisma.janelaAdmissaoTurma.create({ data: { turmaId, preparadorId: secretariaId, versao: 1, limiteEntrada: new Date("2100-01-01T00:00:00Z"), fusoAdmissao: "America/Costa_Rica", motivo: "Janela futura para CT-06", chaveIdempotencia: "ct06-janela", entradaHash: "ct06" } }).then((janela) =>
      prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: gestor.id, aprovada: true, motivo: "Janela aprovada para CT-06" } }));
    const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretariaId, fusoInstitucional: "America/Costa_Rica", periodos: [], motivo: "Calendário CT-06", chaveIdempotencia: "ct06-calendario", entradaHash: "ct06" } });
    calendarioId = calendario.id;
    await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: gestor.id, aprovada: true, motivo: "Calendário aprovado para CT-06" } });
    const grade = await prisma.propostaGradeTurma.create({ data: { turmaId, calendarioId: calendario.id, preparadorId: secretariaId, versao: 1, fusoOrigem: "America/Sao_Paulo", motivo: "Grade CT-06", chaveIdempotencia: "ct06-grade", entradaHash: "ct06", snapshot: {} } });
    gradeId = grade.id;
    await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: gestor.id, aprovada: true, motivo: "Grade aprovada para CT-06" } });
    const inicio = instanteDaGrade("2099-01-31", "23:30", "America/Sao_Paulo");
    const encontro = await prisma.encontroAgenda.create({ data: { turmaId, propostaGradeId: grade.id, professorId, preparadorId: secretariaId, inicio, fim: new Date(inicio.getTime() + 60 * 60_000), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", motivo: "Aula CT-06 que cruza meia-noite", chaveIdempotencia: "ct06-encontro", entradaHash: "ct06" } });
    encontroId = encontro.id;
    await prisma.encontroAgenda.createMany({ data: [
      ["2099-02-28", "ct06-fevereiro-inicio"], ["2099-03-30", "ct06-fevereiro-fim"], ["2099-03-31", "ct06-marco-inicio"], ["2099-04-29", "ct06-marco-fim"],
    ].map(([data, chave]) => {
      const inicio = instanteDaGrade(data, "09:00", "America/Sao_Paulo");
      return { turmaId, propostaGradeId: grade.id, professorId, preparadorId: secretariaId, inicio, fim: new Date(inicio.getTime() + 60 * 60_000), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO" as const, motivo: "Oferta aprovada CT-06", chaveIdempotencia: chave, entradaHash: chave };
    }) });

    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", sobrenome: "CT-06", paisId: catalogo.pais.id, telefoneE164: "+50689990001", email: "ct06@genius.test", documento: "CT06-ALUNO" } });
    alunoId = aluno.id; produtoId = catalogo.produto.id; paisId = catalogo.pais.id;
  });

  it("emite uma vez a cobertura curta do ciclo, sem alterar a aula no fuso da grade", async () => {
    const lead = await prisma.lead.create({ data: { nome: "Negociação CT-06", telefoneE164: "+50689990001", vendedorDonoId: secretariaId } });
    const preparada = await prepararContratacao({ leadId: lead.id, alunoId, produtoId, paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "20000", valorServicoProposto: "85000", motivo: "Identidade e oferta conferidas para CT-06", chaveIdempotencia: "ct06-preparacao", identidadeConferida: true });
    if (!preparada.ok || !preparada.dado) throw new Error(preparada.ok ? "Preparação CT-06 sem retorno." : preparada.erro);
    const matriculaId = preparada.dado.matriculaId;
    await prisma.matricula.update({ where: { id: matriculaId }, data: { secretariaAssumiuEm: new Date() } });
    const pagador = await registrarPagadorPreparacao({ matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Pagador do próprio contrato CT-06", chaveIdempotencia: "ct06-pagador" });
    if (!pagador.ok || !pagador.dado) throw new Error(pagador.ok ? "Pagador CT-06 sem retorno." : pagador.erro);
    const condicoes = await registrarCondicoesEntrada({ matriculaId, pagadorRegistroId: pagador.dado.id, versaoEsperada: 0, taxaVencimento: "2099-01-31", aulas: { regime: "MENSALIDADE", cobertura: { referencia: "CICLO_MATRICULA", inicio: "2099-01-31" }, primeiroVencimento: "2099-02-28", diaVencimentoContratado: 31 }, motivo: "Cobertura e vencimento CT-06 conferidos", chaveIdempotencia: "ct06-condicoes" });
    if (!condicoes.ok || !condicoes.dado) throw new Error(condicoes.ok ? "Condições CT-06 sem retorno." : condicoes.erro);

    const revisao = await consultarRevisaoEmissao(matriculaId);
    if (!revisao.ok || !revisao.dado) throw new Error(revisao.ok ? "Revisão CT-06 sem retorno." : revisao.erro);
    const conferencia = { matriculaId, revisaoHash: revisao.dado.hash, cadastroDocumentosConferidos: true as const, condicoesConferidas: true as const, motivo: "Secretaria conferiu a emissão CT-06", chaveIdempotencia: "ct06-emissao" };
    const emitida = await conferirEEmitirEntrada(conferencia);
    expect(emitida.ok).toBe(true);
    expect(await conferirEEmitirEntrada(conferencia)).toEqual(emitida);

    const cobrancas = await prisma.cobranca.findMany({ where: { matriculaId }, orderBy: { tipo: "asc" } });
    expect(cobrancas).toHaveLength(2);
    const mensalidade = cobrancas.find((c) => c.tipo === "MENSALIDADE");
    if (!mensalidade?.coberturaInicio || !mensalidade.coberturaFim) throw new Error("Mensalidade CT-06 sem cobertura persistida.");
    expect(mensalidade).toMatchObject({ competencia: "2099-02" });
    expect(mensalidade.coberturaInicio.toISOString()).toBe("2099-01-31T00:00:00.000Z");
    expect(mensalidade.coberturaFim.toISOString()).toBe("2099-02-27T00:00:00.000Z");
    expect(mensalidade.vencimento.toISOString()).toBe("2099-02-28T18:00:00.000Z");
    expect(cobrancas.filter((c) => c.coberturaInicio && c.coberturaFim)).toHaveLength(1);
    expect(await prisma.emissaoCobrancasEntrada.count({ where: { matriculaId } })).toBe(1);
    expect(await prisma.itemEmissaoEntrada.count({ where: { matriculaId } })).toBe(2);
    expect(await prisma.versaoCalendarioEscolar.findUniqueOrThrow({ where: { id: calendarioId }, include: { decisao: true } })).toMatchObject({ fusoInstitucional: "America/Costa_Rica", decisao: { aprovada: true } });

    const modelo = await prepararModeloContratual({ codigo: "CT06", versaoEsperada: 0, motivo: "Modelo formal para a continuidade CT-06", chaveIdempotencia: "ct06-modelo", conteudo: { titulo: "Contrato CT-06 de {{nome}}", finalidade: "CONTRATO", regimes: ["MENSALIDADE"], aplicacao: "Condições de continuidade do teste", campos: [{ chave: "nome", descricao: "Nome do aluno", origem: "ALUNO_NOME" }], secoes: [{ titulo: "Contrato", texto: "Aluno {{nome}}." }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }] } });
    if (!modelo.ok || !modelo.dado) throw new Error(modelo.ok ? "Modelo CT-06 sem retorno." : modelo.erro);
    const modeloPersistido = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modelo.dado.id } });
    authMock.mockResolvedValue({ user: { id: administradorId } });
    expect(await decidirModeloContratual({ modeloId: modeloPersistido.id, conteudoHash: modeloPersistido.conteudoHash, aprovada: true, motivo: "Modelo CT-06 aprovado independentemente" })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: secretariaId } });
    const preenchimento = await consultarPreenchimentoContratual({ matriculaId, modeloId: modeloPersistido.id });
    if (!preenchimento.ok || !preenchimento.dado) throw new Error(preenchimento.ok ? "Preenchimento CT-06 sem retorno." : preenchimento.erro);
    const previa = await registrarPreviaContratual({ matriculaId, modeloId: modeloPersistido.id, revisaoHash: preenchimento.dado.revisaoHash, aplicacaoConferida: true, motivo: "Prévia CT-06 conferida", chaveIdempotencia: "ct06-previa" });
    if (!previa.ok || !previa.dado) throw new Error(previa.ok ? "Prévia CT-06 sem retorno." : previa.erro);
    const participantes = await conferirParticipantesContratuais({ previaId: previa.dado.id, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade: { nome: "Aluna CT-06", email: "ct06@genius.test", documento: "CT06-ALUNO" } }], identificacoesConferidas: true, motivo: "Identidade CT-06 conferida", chaveIdempotencia: "ct06-participantes" });
    if (!participantes.ok || !participantes.dado) throw new Error(participantes.ok ? "Participantes CT-06 sem retorno." : participantes.erro);
    const original = await preservarOriginalContratual({ previaId: previa.dado.id, conferenciaId: participantes.dado.id, conteudoConferido: true, motivo: "Original CT-06 preservado" });
    if (!original.ok || !original.dado) throw new Error(original.ok ? "Original CT-06 sem retorno." : original.erro);
    const artefatoId = original.dado.id;
    const revisaoAssinatura = await consultarConferenciaAssinatura({ matriculaId, artefatoId });
    if (!revisaoAssinatura.ok || !revisaoAssinatura.dado?.revisao) throw new Error(JSON.stringify(revisaoAssinatura));
    const conferenciaAssinatura = await registrarConferenciaAssinatura({ matriculaId, artefatoId: original.dado.id, revisaoHash: revisaoAssinatura.dado.revisao.hash, dadosConferidos: true, motivo: "Assinatura CT-06 apta", chaveIdempotencia: "ct06-assinatura" });
    if (!conferenciaAssinatura.ok || !conferenciaAssinatura.dado) throw new Error(JSON.stringify(conferenciaAssinatura));
    const conferenciaId = conferenciaAssinatura.dado.id;
    const processo = await prisma.$transaction((tx) => prepararProcessoEnvioTx(tx, { matriculaId, artefatoId, conferenciaId, executorId: secretariaId, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }));
    const tentativa = await prisma.$transaction((tx) => iniciarTentativaAssinaturaTx(tx, { processoId: processo.id, executorId: secretariaId }));
    await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, { processoId: processo.id, tentativaId: tentativa.tentativaId, chave: "ct06-envio-registrado", resultado: "REGISTRADO", referenciaExterna: "ct06-assinatura-externa", evidenciaHash: "a".repeat(64) }));
    const processoCompleto = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id }, include: { artefato: { include: { conferencia: true } } } });
    const assinaturas = ConferirParticipantesSchema.innerType().shape.participantes.element.strip().array().parse((processoCompleto.artefato.conferencia.snapshot as { participantes: unknown }).participantes);
    const concluidaEm = new Date().toISOString();
    const conclusao = await prisma.$transaction((tx) => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: "ct06-assinatura-externa", originalHash: processoCompleto.artefato.pdfHash, concluidaEm, pdfAssinado: Buffer.from("%PDF-CT06-assinado"), evidencias: Buffer.from("evidência simulada CT-06"), assinaturas: assinaturas.map((p) => ({ papel: p.papel, identidadeHash: hashPrevia(p.identidade), referenciaAssinatura: `ct06-${p.papel}`, assinadaEm: concluidaEm })) }));
    const aceiteRevisao = await consultarAceiteOriginal({ matriculaId, conclusaoId: conclusao.id });
    if (!aceiteRevisao.ok || !aceiteRevisao.dado?.revisao) throw new Error(JSON.stringify(aceiteRevisao));
    const aceite = await confirmarAceiteOriginal({ matriculaId, conclusaoId: conclusao.id, revisaoHash: aceiteRevisao.dado.revisao.hash, evidenciasConferidas: true, motivo: "Aceite CT-06 conferido", chaveIdempotencia: "ct06-aceite" });
    if (!aceite.ok || !aceite.dado) throw new Error(JSON.stringify(aceite));
    const financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro CT-06");
    authMock.mockResolvedValue({ user: { id: financeiro.id } });
    for (const cobranca of await prisma.cobranca.findMany({ where: { matriculaId } })) {
      expect(await registrarPagamento(cobranca.id, { chaveIdempotencia: `ct06-pagamento-${cobranca.id}`, valorRecebido: cobranca.valorNegociado.toNumber(), forma: "DINHEIRO", comentario: "Baixa inicial CT-06" })).toMatchObject({ ok: true });
    }
    await prisma.politicaComissao.create({ data: { paisId, produtoId, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: "CRC", vigenteEm: new Date("2020-01-01T00:00:00.000Z"), criadaPorId: administradorId } });
    authMock.mockResolvedValue({ user: { id: secretariaId } });
    const ativacao = await concluirMatricula(matriculaId);
    expect(ativacao.ok, JSON.stringify(ativacao)).toBe(true);
    const documento = aceite.dado.documentoId;
    const regrasContinuidade = { continuidadeContratada: { contratada: true as const, clausula: "Continuidade mensal CT-06", evidenciaId: documento }, regraCobertura: { referencia: "CICLO_MATRICULA" as const, dataReferencia: "2099-01-31" }, diaVencimento: 31, antecedenciaDias: 0, referenciaVencimento: "MES_COBERTURA" as const, valorOriginal: "85000.00", valorNegociado: "85000.00", moeda: "CRC", ajusteVencimento: { regra: "MANTER_DATA" as const }, vigenteDesde: "2099-01-31" };
    const condicao = await prepararCondicoesContinuidadeMensal({ matriculaId, documentoId: documento, regras: regrasContinuidade, motivo: "Condições contratuais do ciclo dia trinta e um" });
    if (!condicao.ok || !condicao.dado) throw new Error(condicao.ok ? "Condição de continuidade sem retorno." : condicao.erro);
    authMock.mockResolvedValue({ user: { id: administradorId } });
    expect(await decidirCondicoesContinuidadeMensal({ id: condicao.dado.id, aprovar: true, motivo: "Administração aprovou continuidade contratada" })).toMatchObject({ ok: true });

    const chamarCron = async () => {
      const resposta = await emitirContinuidade(new Request("http://localhost/api/financeiro/continuidade/cron", { method: "POST", headers: { "x-cron-secret": "ct06-segredo" } }));
      expect(resposta.status).toBe(200);
      return resposta.json() as Promise<{ emitidas: number; pendentes: number }>;
    };
    vi.stubEnv("CRON_SECRET", "ct06-segredo");
    vi.stubEnv("CONTINUIDADE_MENSAL_EMISSAO_ENABLED", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-02-28T18:00:00.000Z"));
    const estadoPrimeira = await prisma.$transaction((tx) => carregarContinuidadeMensalTx(tx, { matriculaId, agora: new Date() }));
    expect(estadoPrimeira.plano.status, JSON.stringify(estadoPrimeira)).toBe("PRONTA_PARA_EMISSAO");
    const primeiraContinuidade = await chamarCron();
    expect(primeiraContinuidade.emitidas, JSON.stringify({ primeiraContinuidade, estadoPrimeira })).toBe(1);
    expect(await chamarCron()).toMatchObject({ emitidas: 0 });
    vi.setSystemTime(new Date("2099-03-31T18:00:00.000Z"));
    expect(await chamarCron()).toMatchObject({ emitidas: 1 });
    const cadeia = await prisma.cobranca.findMany({ where: { matriculaId, tipo: "MENSALIDADE" }, orderBy: [{ coberturaInicio: "asc" }, { id: "asc" }] });
    expect(cadeia.map((c) => [c.coberturaInicio?.toISOString().slice(0, 10), c.coberturaFim?.toISOString().slice(0, 10), c.vencimento.toISOString()])).toEqual([
      ["2099-01-31", "2099-02-27", "2099-02-28T18:00:00.000Z"],
      ["2099-02-28", "2099-03-30", "2099-02-28T06:00:00.000Z"],
      ["2099-03-31", "2099-04-29", "2099-03-31T06:00:00.000Z"],
    ]);
    for (let indice = 1; indice < cadeia.length; indice++) expect(cadeia[indice - 1]!.coberturaFim! < cadeia[indice]!.coberturaInicio!).toBe(true);

    authMock.mockResolvedValue({ user: { id: professorId } });
    const agenda = await consultarEncontrosDocente({ encontroId });
    expect(agenda).toMatchObject({ ok: true, dado: { encontros: [{ id: encontroId, inicio: "2099-02-01T02:30:00.000Z", fim: "2099-02-01T03:30:00.000Z", fusoOrigem: "America/Sao_Paulo", status: "PREVISTO" }] } });
    if (!agenda.ok) throw new Error(agenda.erro);
    const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
    expect(encontro).toMatchObject({ inicio: new Date("2099-02-01T02:30:00.000Z"), fim: new Date("2099-02-01T03:30:00.000Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", turmaId });
    const exibicaoLocal = new Intl.DateTimeFormat("pt-BR", { timeZone: agenda.dado!.encontros[0]!.fusoOrigem, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(agenda.dado!.encontros[0]!.inicio));
    expect(Object.fromEntries(exibicaoLocal.filter((parte) => ["day", "month", "year", "hour", "minute"].includes(parte.type)).map((parte) => [parte.type, parte.value]))).toMatchObject({ day: "31", month: "01", year: "2099", hour: "23", minute: "30" });
    expect(await prisma.propostaGradeTurma.findUniqueOrThrow({ where: { id: gradeId } })).toMatchObject({ fusoOrigem: "America/Sao_Paulo", calendarioId });
  });
});
