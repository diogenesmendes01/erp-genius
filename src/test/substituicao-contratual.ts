import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { prepararContratacaoTx, PreparacaoComercialSchema } from "@/server/matricula/preparacao-comercial-tx";
import { z } from "zod";
import { conferirAgendaParticularTx } from "@/server/matricula/agenda-particular-estado";
import { registrarPagadorPreparacao } from "@/server/secretaria/pagador-preparacao";
import { registrarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
import { consultarRevisaoEmissao, conferirEEmitirEntrada } from "@/server/secretaria/conferencia-emissao";
import { prepararModeloContratual, decidirModeloContratual } from "@/server/contratos/modelos";
import { consultarPreenchimentoContratual, registrarPreviaContratual } from "@/server/contratos/previas";
import { conferirParticipantesContratuais } from "@/server/contratos/participantes";
import { preservarOriginalContratual } from "@/server/contratos/originais";
import { consultarConferenciaAssinatura, registrarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";
import { prepararProcessoEnvioTx, iniciarTentativaAssinaturaTx, registrarResultadoEnvioTx } from "@/server/contratos/envio-tx";

type AuthMock = { mockResolvedValue(valor: { user: { id: string } }): unknown };
function dado<T>(r: { ok: boolean; dado?: T; erro?: string }): T {
  if (!r.ok || r.dado === undefined) throw new Error(`Fixture contratual: ${JSON.stringify(r)}`);
  return r.dado;
}

/** Fluxo contratual real no banco descartável. Apenas sessão e resultado do
 * transporte são simulados; prévia, PDF, emissão e revisões usam os serviços. */
export async function prepararFixtureSubstituicaoContratual(authMock: AuthMock, opcoes: { primeiraMensalidadeExigida?: boolean; camposCadastrais?: boolean; camposFinanceiros?: boolean; ambiente?: "SANDBOX" | "PRODUCAO"; porHora?: boolean; semSubstituicao?: boolean; valorServicoMensal?: string; fusoInstitucional?: string } = {}) {
  const ambiente = opcoes.ambiente ?? "SANDBOX";
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  const professor = await criarUsuario(["PROFESSOR"]);
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
  entrar(secretaria.id);
  await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60, fusoInstitucional: opcoes.fusoInstitucional ?? "UTC", exigirPrimeiraMensalidade: opcoes.primeiraMensalidadeExigida ?? false } });
  const c = await seedCatalogoMinimo();
  await prisma.produtoPais.updateMany({ data: { taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: c.produto.idiomaId, codigo: "Q116", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: c.produto.modalidadeId, nivelId: nivel.id, professorId: professor.id, capacidade: 2 } });
  const janela = await prisma.janelaAdmissaoTurma.create({ data: { turmaId: turma.id, preparadorId: secretaria.id, versao: 1, limiteEntrada: new Date("2099-12-31"), fusoAdmissao: "UTC", motivo: "Janela de teste", chaveIdempotencia: "janela-q116", entradaHash: "fixture" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: admin.id, aprovada: true, motivo: "Janela conferida" } });
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretaria.id, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário de teste", chaveIdempotencia: "calendario-q116", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: admin.id, aprovada: true, motivo: "Calendário conferido" } });
  const grade = await prisma.propostaGradeTurma.create({ data: { turmaId: turma.id, calendarioId: calendario.id, preparadorId: secretaria.id, versao: 1, fusoOrigem: "UTC", motivo: "Grade de teste", chaveIdempotencia: "grade-q116", entradaHash: "fixture", snapshot: {} } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: admin.id, aprovada: true, motivo: "Grade conferida" } });
  await prisma.encontroAgenda.create({ data: { turmaId: turma.id, propostaGradeId: grade.id, professorId: professor.id, preparadorId: secretaria.id, inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro de teste", chaveIdempotencia: "encontro-q116", entradaHash: "fixture" } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Original", paisId: c.pais.id, email: "aluno@example.test", documento: "ALUNO-TESTE", ...(opcoes.camposCadastrais ? { rua: "Rua original", numero: "1", cidade: "Cidade" } : {}) } });
  const lead = await prisma.lead.create({ data: { nome: "Contratação Q116", vendedorDonoId: vendedor.id } });
  let agendaParticular: z.input<typeof PreparacaoComercialSchema>["agendaParticular"];
  if (opcoes.porHora) {
    const oferta = await prisma.produtoPais.update({ where: { produtoId_paisId: { produtoId: c.produto.id, paisId: c.pais.id } }, data: { formaAgenda: "PARTICULAR_FLEXIVEL" } });
    await prisma.precoReferencia.create({ data: { produtoId: c.produto.id, modalidadeId: c.produto.modalidadeId, paisId: c.pais.id, tipoCobranca: "HORA_PARTICULAR", moeda: "CRC", valor: "125", ativo: true } });
    const dados = { ofertaId: oferta.id, versaoOferta: oferta.versaoEntrada, professorId: professor.id, fusoOrigem: "UTC", encontros: [{ data: "2099-10-02", horario: "15:00", duracaoMinutos: 75 }] };
    const revisao = await prisma.$transaction(tx => conferirAgendaParticularTx(tx, dados));
    agendaParticular = { ...dados, estadoHash: revisao.estadoHash, horariosAcordadosConferidos: true as const };
  }
  const preparacao = await prisma.$transaction(tx => prepararContratacaoTx(tx, { autorId: secretaria.id, leadId: lead.id, alunoId: aluno.id, produtoId: c.produto.id, paisId: c.pais.id, ...(agendaParticular ? { agendaParticular } : { turmaId: turma.id }), regime: opcoes.porHora ? "HORA_PARTICULAR" : "MENSALIDADE", taxaProposta: "999999", valorServicoProposto: opcoes.porHora ? "125" : (opcoes.valorServicoMensal ?? "999999"), motivo: "Contratação para substituição", chaveIdempotencia: "preparacao-q116" }));
  const matriculaId = preparacao.matriculaId;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { secretariaAssumiuEm: new Date() } });
  const pagador = dado(await registrarPagadorPreparacao({ matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Aluno pagador conferido", chaveIdempotencia: "pagador-q116" }));
  dado(await registrarCondicoesEntrada({ matriculaId, pagadorRegistroId: pagador.id, versaoEsperada: 0, taxaVencimento: "2099-09-01", aulas: opcoes.porHora ? { regime: "HORA_PARTICULAR" } : { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2099-10-01" }, primeiroVencimento: "2099-10-05", diaVencimentoContratado: 5 }, motivo: "Condições da contratação conferidas", chaveIdempotencia: "condicoes-q116" }));
  const revisaoEmissao = dado(await consultarRevisaoEmissao(matriculaId));
  dado(await conferirEEmitirEntrada({ matriculaId, revisaoHash: revisaoEmissao.hash, cadastroDocumentosConferidos: true, condicoesConferidas: true, motivo: "Emissão inicial conferida", chaveIdempotencia: "emissao-q116" }));
  const modeloCriado = dado(await prepararModeloContratual({ codigo: "Q116", versaoEsperada: 0, motivo: "Modelo contratual de teste", chaveIdempotencia: "modelo-q116", conteudo: {
    titulo: "Contrato {{nome}}", finalidade: "CONTRATO", regimes: [opcoes.porHora ? "HORA_PARTICULAR" : "MENSALIDADE"], aplicacao: "Modelo para contratação", campos: [{ chave: "nome", descricao: "Nome do aluno", origem: "ALUNO_NOME" }, ...(opcoes.camposCadastrais ? (["ALUNO_DOCUMENTO", "ALUNO_EMAIL", "ALUNO_ENDERECO", "PAGADOR_NOME", "PAGADOR_DOCUMENTO", "PAGADOR_EMAIL", "PAGADOR_ENDERECO"] as const).map(origem => ({ chave: origem.toLowerCase(), descricao: origem, origem })) : []), ...(opcoes.porHora ? [{ chave: "hora", descricao: "Preço por hora", origem: "HORA_VALOR" as const }, { chave: "agenda", descricao: "Agenda", origem: "AGENDA_PARTICULAR" as const }] : []), ...(opcoes.camposFinanceiros ? [
      { chave: "moeda", descricao: "Moeda", origem: "MOEDA" as const },
      { chave: "taxa", descricao: "Taxa", origem: "TAXA_VALOR" as const },
      { chave: "vencimento_taxa", descricao: "Vencimento da taxa", origem: "TAXA_VENCIMENTO" as const },
      { chave: "mensalidade", descricao: "Mensalidade", origem: "MENSALIDADE_VALOR" as const },
      { chave: "vencimento_mensal", descricao: "Primeiro vencimento", origem: "PRIMEIRA_MENSALIDADE_VENCIMENTO" as const },
      { chave: "inicio", descricao: "Início", origem: "COBERTURA_INICIO" as const },
      { chave: "fim", descricao: "Fim", origem: "COBERTURA_FIM" as const },
    ] : [])],
    secoes: [{ titulo: "Identificação", texto: "Aluno: {{nome}}." }, ...(opcoes.camposCadastrais ? [{ titulo: "Cadastro contratual", texto: "{{aluno_documento}} {{aluno_email}} {{aluno_endereco}} {{pagador_nome}} {{pagador_documento}} {{pagador_email}} {{pagador_endereco}}" }] : []), ...(opcoes.porHora ? [{ titulo: "Particulares", texto: "Hora: {{hora}}. Agenda: {{agenda}}." }] : []), ...(opcoes.camposFinanceiros ? [{ titulo: "Condições financeiras", texto: "Moeda {{moeda}}. Taxa {{taxa}} em {{vencimento_taxa}}. Mensalidade {{mensalidade}} em {{vencimento_mensal}}. Cobertura {{inicio}} até {{fim}}." }] : [])], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }],
  } }));
  const modelo = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modeloCriado.id } });
  entrar(admin.id);
  dado(await decidirModeloContratual({ modeloId: modelo.id, conteudoHash: modelo.conteudoHash, aprovada: true, motivo: "Modelo aprovado independentemente" }));
  entrar(secretaria.id);

  async function original(chave: string) {
    const consulta = { matriculaId, modeloId: modelo.id };
    const revisao = dado(await consultarPreenchimentoContratual(consulta));
    const previa = dado(await registrarPreviaContratual({ ...consulta, revisaoHash: revisao.revisaoHash, aplicacaoConferida: true, motivo: "Aplicação do modelo conferida", chaveIdempotencia: `previa-${chave}` }));
    const pessoa = await prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } });
    const participantes = dado(await conferirParticipantesContratuais({ previaId: previa.id, versaoEsperada: 0, maioridade: null,
      participantes: [{ papel: "ALUNO", identidade: { nome: [pessoa.primeiroNome, pessoa.sobrenome].filter(Boolean).join(" "), email: pessoa.email!, documento: pessoa.documento! } }],
      identificacoesConferidas: true, motivo: "Identidade do aluno conferida", chaveIdempotencia: `participantes-${chave}` }));
    const artefato = dado(await preservarOriginalContratual({ previaId: previa.id, conferenciaId: participantes.id, conteudoConferido: true, motivo: "Original contratual conferido" }));
    const alvo = { matriculaId, artefatoId: artefato.id };
    const assinatura = dado(await consultarConferenciaAssinatura(alvo));
    if (!assinatura.revisao) throw new Error(`Fixture assinatura: ${JSON.stringify(assinatura)}`);
    const conferencia = dado(await registrarConferenciaAssinatura({ ...alvo, revisaoHash: assinatura.revisao.hash, dadosConferidos: true, motivo: "Assinatura apta para envio", chaveIdempotencia: `assinatura-${chave}` }));
    return { artefatoId: artefato.id, conferenciaId: conferencia.id, revisaoHash: assinatura.revisao.hash };
  }
  const fonte = await original("fonte");
  const processo = await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, { matriculaId, artefatoId: fonte.artefatoId, conferenciaId: fonte.conferenciaId, executorId: secretaria.id, fornecedor: "ZAPSIGN", ambiente }));
  const tentativa = await prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: processo.id, executorId: secretaria.id }));
  const referenciaExternaFonte = "q116-fonte-simulada";
  await prisma.$transaction(tx => registrarResultadoEnvioTx(tx, { processoId: processo.id, tentativaId: tentativa.tentativaId, chave: "envio-q116", resultado: "REGISTRADO", referenciaExterna: referenciaExternaFonte, evidenciaHash: "a".repeat(64) }));
  if (opcoes.porHora || opcoes.semSubstituicao) return { secretariaId: secretaria.id, adminId: admin.id, matriculaId, processoId: processo.id, artefatoFonteId: fonte.artefatoId, conferenciaFonteId: fonte.conferenciaId, conferenciaSubstitutoId: fonte.conferenciaId, artefatoSubstitutoId: fonte.artefatoId, revisaoFonteHash: fonte.revisaoHash, revisaoSubstitutoHash: fonte.revisaoHash, referenciaExternaFonte };
  // Alteração real depois do envio. O original antigo permanece preservado.
  await prisma.aluno.update({ where: { id: aluno.id }, data: { sobrenome: "Corrigido" } });
  const substituto = await original("substituto");
  return { secretariaId: secretaria.id, adminId: admin.id, matriculaId, processoId: processo.id,
    artefatoFonteId: fonte.artefatoId, conferenciaFonteId: fonte.conferenciaId,
    conferenciaSubstitutoId: substituto.conferenciaId, artefatoSubstitutoId: substituto.artefatoId,
    revisaoFonteHash: fonte.revisaoHash, revisaoSubstitutoHash: substituto.revisaoHash, referenciaExternaFonte };
}
