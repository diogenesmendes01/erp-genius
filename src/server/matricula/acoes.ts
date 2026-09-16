"use server";

import { revalidatePath } from "next/cache";
import {
  Papel,
  EtapaLead,
  StatusMatricula,
  StatusCobranca,
  StatusComissao,
  TipoCobranca,
  FormaPagamento,
  PapelResponsavel,
  Prisma,
  StatusPais,
  TipoAprovacao,
  TipoAjuste,
  Vigencia,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import {
  exigirSessao,
  exigirPapel,
  temPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  vencimentoMensalidade,
  numero,
  numeroOuNull,
  normalizarTelefoneE164,
  validarDocumento,
  type UsuarioSessao,
  type Resultado,
} from "@/server/_shared";
import {
  MatriculaSchema,
  AtivacaoSchema,
  type MatriculaInput,
  type AtivacaoInput,
  type MatriculaComAtivacaoInput,
} from "./schema";
import {
  validarOfertaPais,
  validarOfertaPreco,
  validarTurmaParaProduto,
} from "./validacao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import { resolverComissao, limitesAtuais, exigeAprovacaoComponente } from "@/server/financeiro/politica";
import { receberTx, bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { pagamentoConfirmado, validarEstadoAtivacao } from "@/server/financeiro/regras";
import { exigirContratoAceito } from "./ativacao";
import { exigirEntradaMensalRegistrada } from "./entrada-ativacao";
import { expandirCoberturaMensal } from "./cronograma-cobertura";
import { periodoMensalNaData } from "./cobertura";
import { exigirCondicoesMensaisAceitas } from "./condicoes-aceitas";
import { ativarPreparacaoTx } from "./ativacao-preparacao-tx";
import { nomeCompleto } from "@/lib/nome";
import { resolverMensalVigente } from "@/server/contratos/aditivo-mensal-vigente";
// Conjuntos de papéis centralizados (compartilhados com a UI).
import { PAPEIS_CRIAR, PAPEIS_ATIVAR } from "./permissoes";

// Quem pode matricular SEM preço de referência (exceção de preço, Issue #7).
const PAPEIS_EXCECAO_PRECO: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR];

function revalidar(leadId?: string | null) {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/alunos");
  revalidatePath("/financeiro");
  revalidatePath("/secretaria");
  revalidatePath("/comissoes");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

// vencimento/comissão: regras puras em @/server/_shared/regras (testáveis).
const vencimentoMes = vencimentoMensalidade;

/**
 * Cria a matrícula (aluno, contrato, cobranças, comissão) dentro de uma transação.
 * Reutilizado por `criarMatricula` e pela operação atômica `criarEAtivarMatricula`.
 */
async function criarMatriculaTx(
  tx: Prisma.TransactionClient,
  autor: UsuarioSessao,
  input: MatriculaInput,
): Promise<{ id: string; alunoId: string; leadId: string | null; aguardaPreco: boolean }> {
  const dados = MatriculaSchema.parse(input);

  const pais = await tx.pais.findUnique({
    where: { id: dados.alunoPaisId },
    include: { tiposDocumento: true },
  });
  if (!pais) throw new ErroRegra("País não encontrado.");
  if (pais.status !== StatusPais.ATIVO) throw new ErroRegra("Este país está pausado para novas matrículas.");
  const produto = await tx.produto.findUnique({ where: { id: dados.produtoId } });
  if (!produto) throw new ErroRegra("Produto não encontrado.");

  // Revalidação no servidor (Issue #7) — NÃO confiar no client.
  // 1) Produto precisa estar OFERECIDO no país (catálogo coerente).
  const ofertaPais = await tx.produtoPais.findUnique({
    where: { produtoId_paisId: { produtoId: produto.id, paisId: pais.id } },
    select: { oferecido: true },
  });
  validarOfertaPais(ofertaPais?.oferecido);

  const moeda = pais.moedaLocal;

  // dono do lead = quem recebe a comissão; senão o criador (se vendedor)
  let vendedorId = autor.id;
  let leadId: string | null = null;
  let etapaLeadAtual: EtapaLead | null = null;
  if (dados.leadId) {
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${dados.leadId} FOR UPDATE`;
    const lead = await tx.lead.findUnique({
      where: { id: dados.leadId },
      include: { matricula: { select: { id: true } } },
    });
    if (!lead) throw new ErroRegra("Lead não encontrado.");
    // Ownership/escopo: vendedor só converte lead do próprio escopo (doc 07).
    if (!temPapel(autor, Papel.SECRETARIA_ACADEMICA) && !await tx.lead.findFirst({ where: { AND: [{ id: lead.id }, await escopoComercialAtual(autor, tx)] }, select: { id: true } })) throw new ErroPermissao();
    if (lead.matricula) throw new ErroRegra("Lead já possui matrícula.");
    leadId = lead.id;
    etapaLeadAtual = lead.etapa;
    if (lead.vendedorDonoId) vendedorId = lead.vendedorDonoId;
  }

  // referência de preço (para registrar valorOriginal)
  const precos = await tx.precoReferencia.findMany({
    where: { ativo: true, paisId: pais.id, produtoId: produto.id },
  });
  // 2) Oferta de preço válida (matrícula + mensalidade) — ou exceção AUDITÁVEL,
  // JUSTIFICADA + APROVADA por papel (Issues #7/#22). A autorização é apurada no
  // servidor (temPapel), nunca por flag do client; ausência de preço marca a
  // matrícula (`precoReferenciaAusente`) e grava Evento `MatriculaSemPrecoReferencia`.
  const { precoReferenciaAusente } = validarOfertaPreco(precos, produto.id, pais.id, {
    justificativa: dados.justificativaSemPreco,
    autorizado: temPapel(autor, ...PAPEIS_EXCECAO_PRECO),
  });
  const refTaxa =
    numeroOuNull(precos.find((p) => p.tipoCobranca === TipoCobranca.MATRICULA)?.valor) ?? dados.taxaValor;
  const refMens =
    numeroOuNull(precos.find((p) => p.tipoCobranca === TipoCobranca.MENSALIDADE)?.valor) ?? dados.mensalidadeValor;

  const limites = await limitesAtuais(tx, autor);
  const aguardaPreco = precoReferenciaAusente || exigeAprovacaoComponente(limites, TipoCobranca.MATRICULA, refTaxa, dados.taxaValor) ||
    exigeAprovacaoComponente(limites, TipoCobranca.MENSALIDADE, refMens, dados.mensalidadeValor);
  // Um pedido acima da alçada não torna o preço proposto vigente antes da aprovação.
  const taxaEfetiva = aguardaPreco ? refTaxa : dados.taxaValor;
  const mensalidadeEfetiva = aguardaPreco ? refMens : dados.mensalidadeValor;
  const comissao = await resolverComissao(tx, { paisId: pais.id, produtoId: produto.id, taxa: taxaEfetiva, moeda });

  const codAluno = await gerarCodigo("aluno");
  const codMatricula = await gerarCodigo("matricula");
  const codTaxa = await gerarCodigo("cobranca");
  const codPrimeiraMensalidade = await gerarCodigo("cobranca");
  const codCertificado = dados.certificadoValor && dados.certificadoValor > 0 ? await gerarCodigo("cobranca") : null;

  // Documento estruturado (doc 04): o tipo escolhido deve pertencer ao país; a
  // validação mira o validador DESSE tipo. Documento avisa, não bloqueia (flag).
  const tipoDoc = pais.tiposDocumento.find((t) => t.id === dados.alunoTipoDocumentoId);
  if (!tipoDoc) throw new ErroRegra("Tipo de documento não pertence ao país selecionado.");

  const aluno = await tx.aluno.create({
    data: {
      codigo: codAluno,
      // Identificação
      primeiroNome: dados.alunoPrimeiroNome,
      sobrenome: dados.alunoSobrenome,
      nomePreferido: dados.alunoNomePreferido || null,
      nascimento: dados.alunoNascimento,
      genero: dados.alunoGenero,
      // Documentação
      paisId: pais.id,
      tipoDocumentoId: tipoDoc.id,
      documento: dados.alunoDocumento,
      documentoValido: validarDocumento(tipoDoc.validador, dados.alunoDocumento),
      documentoPaisEmissor: dados.alunoDocumentoPaisEmissor || null,
      nacionalidade: dados.alunoNacionalidade,
      segundaNacionalidade: dados.alunoSegundaNacionalidade || null,
      // Contato
      email: dados.alunoEmail,
      telefoneE164: normalizarTelefoneE164(dados.alunoTelefone, pais.ddi),
      whatsapp: dados.alunoWhatsapp,
      aceitaComunicacoes: dados.alunoAceitaComunicacoes,
      // Residência
      paisResidencia: dados.alunoPaisResidencia,
      cep: dados.alunoCep || null,
      rua: dados.alunoRua || null,
      numero: dados.alunoNumero || null,
      complemento: dados.alunoComplemento || null,
      bairro: dados.alunoBairro || null,
      cidade: dados.alunoCidade || null,
      regiao: dados.alunoRegiao || null,
      // Acadêmico
      escolaridade: dados.alunoEscolaridade ?? null,
      idiomaNativo: dados.alunoIdiomaNativo || null,
      // Operacional
      fuso: dados.alunoFuso || null,
      observacoes: dados.alunoObservacoes || null,
    },
  });

  // Contato de emergência (opcional) — reaproveita Responsavel com papel EMERGENCIA.
  if (dados.emergenciaNome) {
    const emerg = await tx.responsavel.create({
      data: {
        nome: dados.emergenciaNome,
        parentesco: dados.emergenciaParentesco || null,
        telefoneE164: normalizarTelefoneE164(dados.emergenciaTelefone, pais.ddi),
      },
    });
    await tx.alunoResponsavel.create({
      data: { alunoId: aluno.id, responsavelId: emerg.id, papel: PapelResponsavel.EMERGENCIA },
    });
  }

  // Responsável financeiro (pagador) quando não é o próprio aluno (Kids/Teens/B2B)
  if (dados.pagador !== "ALUNO" && dados.responsavelNome) {
    const resp = await tx.responsavel.create({
      data: {
        nome: dados.responsavelNome,
        parentesco: dados.pagador === "EMPRESA" ? "Empresa" : dados.responsavelParentesco || null,
        telefoneE164: normalizarTelefoneE164(dados.responsavelTelefone, pais.ddi),
        email: dados.responsavelEmail || null,
      },
    });
    await tx.alunoResponsavel.create({
      data: { alunoId: aluno.id, responsavelId: resp.id, papel: PapelResponsavel.FINANCEIRO },
    });
  }

  const matricula = await tx.matricula.create({
    data: {
      codigo: codMatricula,
      alunoId: aluno.id,
      leadId,
      produtoId: produto.id,
      paisId: pais.id,
      moeda,
      status: StatusMatricula.AGUARDANDO,
      diaVencimento: dados.diaVencimento,
      mesesPlano: dados.mesesPlano,
      referenciaCobertura: dados.cobertura?.referencia,
      dataReferenciaCobertura: dados.cobertura?.referencia === "CICLO_MATRICULA" ? new Date(`${dados.cobertura.inicio}T00:00:00Z`) : null,
      nivelInicialId: dados.nivelInicialId || null,
      origemNivel: dados.origemNivel ?? null,
      dataAvaliacaoNivel: dados.dataAvaliacaoNivel ?? null,
      precoReferenciaAusente,
      justificativaSemPreco: precoReferenciaAusente ? dados.justificativaSemPreco?.trim() || null : null,
    },
  });

  // Auditoria da exceção de preço (Issue #7): registra motivo + autor na
  // MESMA transação da criação.
  if (precoReferenciaAusente) {
    await registrarEvento(tx, {
      tipo: "MatriculaSemPrecoReferencia",
      agregadoTipo: "Matricula",
      agregadoId: matricula.id,
      autorId: autor.id,
      payload: {
        produtoId: produto.id,
        paisId: pais.id,
        justificativa: dados.justificativaSemPreco?.trim() ?? null,
      },
    });
  }

  // Data de início da PRIMEIRA AULA = Turma.dataInicio (quando há turma alocada).
  // Base do vencimento da 1ª mensalidade (início + 30d, ajustado ao dia escolhido).
  if (dados.turmaId) {
    // 3) Revalida a turma DENTRO da transação (turma aberta, coerente com o
    // produto e com vaga). Vaga = capacidade − alocações ATIVAS (ativa:true).
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${dados.turmaId} FOR UPDATE`;
    const turma = await tx.turma.findUnique({
      where: { id: dados.turmaId },
      select: {
        id: true,
        status: true,
        capacidade: true,
        modalidadeId: true,
        dataInicio: true,
        nivel: { select: { idiomaId: true } },
      },
    });
    if (!turma) throw new ErroRegra("Turma não encontrada.");
    const alocacoesAtivas = await tx.alocacaoTurma.count({
      where: { turmaId: turma.id, ativa: true },
    });
    const reservasOcupantes = await tx.reservaVagaMatricula.count({ where: { turmaId: turma.id, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } });
    validarTurmaParaProduto(turma, produto, alocacoesAtivas + reservasOcupantes);
    await tx.alocacaoTurma.create({
      data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id, ativa: true },
    });
  }

  // Taxa de matrícula (vence agora)
  const taxaCriada = await tx.cobranca.create({
    data: {
      codigo: codTaxa,
      matriculaId: matricula.id,
      tipo: TipoCobranca.MATRICULA,
      valorOriginal: refTaxa,
      valorNegociado: taxaEfetiva,
      saldo: taxaEfetiva,
      moeda,
      vencimento: new Date(),
      status: StatusCobranca.PENDENTE,
    },
  });

  // 1ª mensalidade (o restante do cronograma é gerado na ATIVAÇÃO — doc 09 / P18).
  // Cobertura e primeiro vencimento são condições explícitas da contratação.
  const primeira = (() => {
    const [ano, mes, dia] = dados.primeiroVencimento.split("-").map(Number);
    return { data: new Date(ano, mes - 1, dia, 12), competencia: dados.primeiroVencimento.slice(0, 7) };
  })();
  const coberturaInicial = periodoMensalNaData(
    dados.cobertura.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: dados.cobertura.inicio },
    dados.cobertura.inicio,
  );
  const mensalidadeCriada = await tx.cobranca.create({
    data: {
      codigo: codPrimeiraMensalidade,
      coberturaInicio: coberturaInicial ? new Date(`${coberturaInicial.inicio}T00:00:00Z`) : null,
      coberturaFim: coberturaInicial ? new Date(`${coberturaInicial.fim}T00:00:00Z`) : null,
      matriculaId: matricula.id,
      tipo: TipoCobranca.MENSALIDADE,
      competencia: primeira.competencia,
      valorOriginal: refMens,
      valorNegociado: mensalidadeEfetiva,
      saldo: mensalidadeEfetiva,
      moeda,
      vencimento: primeira.data,
      status: StatusCobranca.PENDENTE,
    },
  });

  // Certificado profissional (linha opcional — só Costa Rica, valor fixo)
  if (codCertificado && dados.certificadoValor) {
    await tx.cobranca.create({
      data: {
        codigo: codCertificado,
        matriculaId: matricula.id,
        tipo: TipoCobranca.CERTIFICADO,
        valorOriginal: dados.certificadoValor,
        valorNegociado: dados.certificadoValor,
        moeda,
        vencimento: new Date(),
        status: StatusCobranca.PENDENTE,
      },
    });
  }

  // Comissão determinada no servidor pela política vigente, com memória do cálculo.
  await tx.comissao.create({
    data: {
      matriculaId: matricula.id,
      vendedorId,
      percentual: comissao.regra.percentual ?? 0,
      tipo: comissao.regra.tipo, politicaId: comissao.regra.id,
      valorBase: taxaEfetiva, valorFixo: comissao.regra.valorFixo,
      memoriaCalculo: { ...comissao.memoria, vendedorId }, calculadaEm: new Date(),
      valor: comissao.valor,
      moeda,
      status: StatusComissao.PENDENTE,
    },
  });

  if (aguardaPreco) {
    await tx.aprovacao.create({ data: {
      tipo: TipoAprovacao.DESCONTO, solicitanteId: autor.id, alvoTipo: "Matricula", alvoId: matricula.id,
      vigencia: Vigencia.ESTA_COBRANCA, motivo: precoReferenciaAusente ? `Exceção sem referência: ${dados.justificativaSemPreco}` : "Preço proposto na criação da matrícula acima da alçada",
      impactoMensal: refMens - dados.mensalidadeValor,
      payload: {
        alunoId: aluno.id, alunoNome: nomeCompleto(aluno), moeda, tipo: TipoAjuste.DESCONTO,
        exigeDirecao: precoReferenciaAusente || autor.papeis.includes(Papel.GERENTE_COMERCIAL) || autor.papeis.includes(Papel.ADMINISTRADOR),
        valorDe: refTaxa + refMens, valorPara: dados.taxaValor + dados.mensalidadeValor,
        descontoValor: refTaxa + refMens - dados.taxaValor - dados.mensalidadeValor,
        alvos: [
          { id: taxaCriada.id, versao: taxaCriada.versao, valorDe: refTaxa, referencia: refTaxa, valorPara: dados.taxaValor, novoVencimento: null },
          { id: mensalidadeCriada.id, versao: mensalidadeCriada.versao, valorDe: refMens, referencia: refMens, valorPara: dados.mensalidadeValor, novoVencimento: null },
        ],
      },
    } });
  }

  if (leadId && etapaLeadAtual !== EtapaLead.AGUARDANDO_MATRICULA) {
    await tx.lead.update({ where: { id: leadId }, data: { etapa: EtapaLead.AGUARDANDO_MATRICULA } });
    // Etapa do lead muda no fluxo de matrícula: registra no agregado Lead para
    // alimentar a timeline e o `etapaDesde` confiável (issue #15).
    await registrarEvento(tx, {
      tipo: "EtapaAlterada",
      agregadoTipo: "Lead",
      agregadoId: leadId,
      autorId: autor.id,
      payload: { de: etapaLeadAtual, para: EtapaLead.AGUARDANDO_MATRICULA },
    });
  }

  await registrarEvento(tx, {
    tipo: "MatriculaCriada",
    agregadoTipo: "Matricula",
    agregadoId: matricula.id,
    autorId: autor.id,
    payload: { codigo: codMatricula, alunoId: aluno.id, produtoId: produto.id, leadId, referencias: { taxa: { id: precos.find((p) => p.tipoCobranca === TipoCobranca.MATRICULA)?.id ?? null, valor: refTaxa }, mensalidade: { id: precos.find((p) => p.tipoCobranca === TipoCobranca.MENSALIDADE)?.id ?? null, valor: refMens } } },
  });
  await registrarEvento(tx, {
    tipo: "AlunoMatriculado",
    agregadoTipo: "Aluno",
    agregadoId: aluno.id,
    autorId: autor.id,
    payload: { matriculaId: matricula.id, turmaId: dados.turmaId || null },
  });
  await registrarEvento(tx, {
    tipo: "ComissaoGerada",
    agregadoTipo: "Matricula",
    agregadoId: matricula.id,
    autorId: autor.id,
    payload: { vendedorId, ...comissao.memoria },
  });

  return { id: matricula.id, alunoId: aluno.id, leadId, aguardaPreco };
}

/**
 * Preserva os recebimentos e estados existentes ao ativar. Valor novo, quando
 * informado por FIN/caixa, usa o mesmo ledger idempotente dos pagamentos.
 * Valor zero consulta a taxa já quitada; nunca cria uma baixa fictícia.
 * Exige contrato aceito e taxa confirmada. A configuração pode exigir também
 * a primeira mensalidade; informe de pagamento não confirma nenhum requisito.
 */
async function ativarMatriculaTx(
  tx: Prisma.TransactionClient,
  autor: UsuarioSessao,
  matriculaId: string,
  dados: {
    valorRecebido: number;
    forma: FormaPagamento;
    dataPagamento?: Date | null;
    comprovanteUrl?: string | null;
    comentario?: string | null;
  } | null,
): Promise<{ leadId: string | null }> {
  if (await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId }, select: { id: true } })) {
    if (dados && dados.valorRecebido > 0) throw new ErroRegra("Confirme o recebimento no Financeiro e conclua a preparação com os pagamentos já registrados.");
    return ativarPreparacaoTx(tx, matriculaId, autor.id);
  }
  await bloquearMatriculas(tx, [matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${matriculaId} ORDER BY id FOR UPDATE`;
  const matricula = await tx.matricula.findUnique({
    where: { id: matriculaId },
    include: {
      cobrancas: { orderBy: { vencimento: "asc" } },
      comissoes: true,
      lead: { select: { etapa: true } },
    },
  });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${matricula.alunoId} FOR UPDATE`;
  const aluno = await tx.aluno.findUnique({ where: { id: matricula.alunoId }, select: { status: true } });
  if (aluno?.status !== "ATIVO") throw new ErroRegra("A ativação exige aluno ativo. Aluno pausado precisa de proposta de retomada aprovada; aluno encerrado exige revisão da secretaria.");

  const exigirPrimeiraMensalidade = await exigirEntradaMensalRegistrada(tx, matricula.id);
  const taxa = matricula.cobrancas.find((c) => c.tipo === TipoCobranca.MATRICULA);
  const primeiraMensalidade = matricula.cobrancas.find((c) => c.tipo === TipoCobranca.MENSALIDADE);
  if (!taxa || !primeiraMensalidade)
    throw new ErroRegra("Matrícula sem taxa ou mensalidade para receber.");

  validarEstadoAtivacao(matricula.status, taxa.status);
  const contratoDocumentoId = await exigirContratoAceito(tx, matricula);
  await exigirCondicoesMensaisAceitas(tx, matricula);
  if (await tx.aprovacao.count({ where: { alvoTipo: "Matricula", alvoId: matricula.id, status: "PENDENTE" } })) {
    throw new ErroRegra("A matrícula aguarda decisão dos preços propostos. Consulte as aprovações.");
  }
  // Pagamentos já confirmados são preservados. Receber na ativação usa o mesmo ledger.
  if (dados && dados.valorRecebido > 0) {
    const caixa = autor.papeis.includes(Papel.FINANCEIRO) || autor.papeis.includes(Papel.ADMINISTRADOR) || (await tx.usuario.findUniqueOrThrow({ where: { id: autor.id }, select: { permissoes: true } })).permissoes.includes("pagamento.caixa");
    if (!caixa) throw new ErroPermissao("A secretaria informa o pagamento na ficha financeira; o Financeiro confirma antes da ativação.");
    if (dados.comprovanteUrl) await exigirArquivoVinculavel(autor, dados.comprovanteUrl, { cobrancaId: taxa.id, alunoId: matricula.alunoId, leadId: matricula.leadId ?? undefined }, tx);
    await receberTx(tx, { ...dados, cobrancaId: taxa.id, autorId: autor.id,
      chaveIdempotencia: `ativacao:${matricula.id}`, dataPagamento: dados.dataPagamento ?? new Date() });
  }
  const taxaAtual = await tx.cobranca.findUniqueOrThrow({ where: { id: taxa.id } });
  if (!pagamentoConfirmado(taxaAtual)) {
    throw new ErroRegra("A taxa de matrícula precisa estar integralmente recebida e confirmada pelo Financeiro. Informe a conferir não permite ativação.");
  }
  const primeiraConfirmada = pagamentoConfirmado(primeiraMensalidade);
  if (exigirPrimeiraMensalidade && !primeiraConfirmada) {
    throw new ErroRegra("A regra de entrada aplicável exige a primeira mensalidade integralmente recebida e confirmada antes da ativação.");
  }

  // Cronograma gerado NA ATIVAÇÃO (doc 09 / P18): meses 2..N (o 1º já existe).
  const restante = Math.max(0, matricula.mesesPlano - 1);
  const coberturas = expandirCoberturaMensal(matricula, primeiraMensalidade, restante);
  // A matrícula já está bloqueada; a formalização de versões também trava a
  // matrícula, portanto esta leitura única não pode se intercalar com uma nova
  // versão antes da criação do cronograma.
  const versoesAditivo = await tx.versaoCondicoesAditivo.findMany({ where: { matriculaId }, select: {
    id: true, versao: true, condicoes: true, condicoesHash: true, vigenciaInicio: true,
  } });
  const codsRestante: string[] = [];
  for (let i = 0; i < restante; i++) codsRestante.push(await gerarCodigo("cobranca"));

  const agora = new Date();
  // A primeira mensalidade conserva estado, vencimento e recebimentos anteriores.
  const venc1 = { data: primeiraMensalidade.vencimento, competencia: primeiraMensalidade.competencia };

  await tx.matricula.update({
    where: { id: matriculaId },
    data: {
      status: StatusMatricula.ATIVA,
      pagamentoTaxaOk: true,
      // Preserva a confirmação financeira existente da primeira mensalidade.
      primeiraMensalidadeOk: primeiraConfirmada,
      ativadaComPendencia: false,
      ativadaEm: agora,
    },
  });

  // Gera o restante do cronograma de mensalidades (meses 2..N), a partir do mês
  // de vencimento da 1ª mensalidade.
  const mensalidadesGeradas: { cobrancaId: string; coberturaInicio: string | null; coberturaFim: string | null; valorOriginal: string; valorNegociado: string; moeda: string; versaoAditivo: { id: string; versao: number; condicoesHash: string } | null }[] = [];
  for (let i = 0; i < restante; i++) {
    const { data, competencia } = vencimentoMes(matricula.diaVencimento, i + 1, venc1.data);
    const cobertura = coberturas?.[i];
    // Nunca usa vencimento como substituto da cobertura para aplicar um
    // aditivo. Sem período explícito, uma versão formalizada não tem alvo
    // mensal determinável neste cronograma.
    if (!cobertura && versoesAditivo.length) throw new ErroRegra("Aditivo formalizado exige cobertura explícita antes de gerar mensalidades.");
    const valores = cobertura
      ? resolverMensalVigente(versoesAditivo, cobertura.coberturaInicio, cobertura.coberturaFim,
        primeiraMensalidade.valorOriginal.toString(), primeiraMensalidade.valorNegociado.toString(), matricula.moeda)
      : { valorOriginal: primeiraMensalidade.valorOriginal.toString(), valorNegociado: primeiraMensalidade.valorNegociado.toString(), moeda: matricula.moeda, versaoAditivo: null };
    const criada = await tx.cobranca.create({
      data: {
        codigo: codsRestante[i],
        ...(cobertura ?? {}),
        matriculaId,
        tipo: TipoCobranca.MENSALIDADE,
        competencia,
        // Referência comercial permanece a do contrato; o aditivo formalizado
        // pode alterar somente o valor negociado da parcela nova.
        valorOriginal: valores.valorOriginal,
        valorNegociado: valores.valorNegociado,
        moeda: valores.moeda,
        vencimento: data,
        status: StatusCobranca.PENDENTE,
      },
    });
    mensalidadesGeradas.push({ cobrancaId: criada.id, coberturaInicio: cobertura?.coberturaInicio.toISOString() ?? null,
      coberturaFim: cobertura?.coberturaFim.toISOString() ?? null, valorOriginal: valores.valorOriginal,
      valorNegociado: valores.valorNegociado, moeda: valores.moeda, versaoAditivo: valores.versaoAditivo });
  }
  if (restante > 0) {
    await registrarEvento(tx, {
      tipo: "CobrancaGerada",
      agregadoTipo: "Matricula",
      agregadoId: matriculaId,
      autorId: autor.id,
      payload: { quantidade: restante, tipo: "MENSALIDADE", mensalidades: mensalidadesGeradas },
    });
  }

  // Comissão: Pendente → Aprovada (matrícula ativa)
  for (const com of matricula.comissoes) {
    if (com.status !== StatusComissao.PENDENTE) continue;
    await tx.comissao.updateMany({
      where: { id: com.id, status: StatusComissao.PENDENTE },
      data: { status: StatusComissao.APROVADA },
    });
  }

  if (matricula.leadId && matricula.lead?.etapa !== EtapaLead.MATRICULADO) {
    await tx.lead.update({ where: { id: matricula.leadId }, data: { etapa: EtapaLead.MATRICULADO } });
    // Etapa do lead muda na ativação: registra no agregado Lead p/ timeline e
    // `etapaDesde` confiável (issue #15).
    await registrarEvento(tx, {
      tipo: "EtapaAlterada",
      agregadoTipo: "Lead",
      agregadoId: matricula.leadId,
      autorId: autor.id,
      payload: { de: matricula.lead?.etapa ?? null, para: EtapaLead.MATRICULADO },
    });
  }

  await registrarEvento(tx, {
    tipo: "MatriculaAtivada",
    agregadoTipo: "Matricula",
    agregadoId: matriculaId,
    autorId: autor.id,
    payload: {
      ativadaEm: agora.toISOString(),
      lastro: exigirPrimeiraMensalidade ? "CONTRATO_TAXA_PRIMEIRA_MENSALIDADE" : "CONTRATO_TAXA",
      contratoDocumentoId, contratoConfirmadoEm: matricula.confirmacaoContratoEm!.toISOString(),
      contratoConfirmadoPorId: matricula.confirmacaoContratoPorId,
      exigirPrimeiraMensalidade,
      forma: dados && dados.valorRecebido > 0 ? dados.forma : null,
      valorRecebido: dados?.valorRecebido ?? 0,
      taxaValor: numero(taxa.valorNegociado),
      recebidoAcumulado: numero(taxaAtual.valorRecebido ?? 0),
      primeiraMensalidadeVencimento: venc1.data.toISOString(),
    },
  });
  await registrarEvento(tx, {
    tipo: "ComissaoAprovada",
    agregadoTipo: "Matricula",
    agregadoId: matriculaId,
    autorId: autor.id,
  });

  return { leadId: matricula.leadId };
}

/**
 * Criar-sem-ativar (issue #8): registra a matrícula em AGUARDANDO.
 * Exige apenas papel de criação; a ativação/recebimento fica para o Financeiro.
 */
export async function criarMatricula(
  input: MatriculaInput,
): Promise<Resultado<{ id: string; alunoId: string; aguardaPreco?: boolean }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_CRIAR);

    const res = await prisma.$transaction((tx) => criarMatriculaTx(tx, autor, input));
    revalidar(res.leadId);
    return { id: res.id, alunoId: res.alunoId, aguardaPreco: res.aguardaPreco };
  });
}

/** Ativa matrícula com contrato aceito e pagamentos exigidos confirmados. */
export async function ativarMatricula(
  matriculaId: string,
  input: AtivacaoInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ATIVAR);
    const dados = AtivacaoSchema.parse(input);

    const { leadId } = await prisma.$transaction((tx) =>
      ativarMatriculaTx(tx, autor, matriculaId, {
        valorRecebido: dados.valorRecebido,
        forma: dados.forma as FormaPagamento,
        dataPagamento: dados.dataPagamento,
        comprovanteUrl: dados.comprovanteUrl,
        comentario: dados.comentario,
      }),
    );
    revalidar(leadId);
  });
}

/** Conclui sem registrar baixa: secretaria, financeiro e administração usam as confirmações existentes. */
export async function concluirMatricula(matriculaId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ATIVAR);
    if (!matriculaId.trim()) throw new ErroRegra("Matrícula obrigatória.");
    const { leadId } = await prisma.$transaction((tx) => ativarMatriculaTx(tx, autor, matriculaId, null));
    revalidar(leadId);
  });
}

/**
 * Criar + ativar atômico (issue #8): cria a matrícula e a ativa numa única
 * transação. Exige os papéis de criar E ativar — se faltar qualquer um, nada é
 * gravado (não fica matrícula parcial). Para quem só pode criar, use `criarMatricula`.
 * Compatibilidade de API: a mesma validação exige contrato aceito. Uma nova
 * matrícula sem aceite não ativa; a transação inteira é desfeita.
 */
export async function criarEAtivarMatricula(
  input: MatriculaComAtivacaoInput,
): Promise<Resultado<{ id: string; alunoId: string; aguardaPreco?: boolean }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_CRIAR);
    exigirPapel(autor, ...PAPEIS_ATIVAR);
    const ativacao = AtivacaoSchema.parse(input.ativacao);

    const res = await prisma.$transaction(async (tx) => {
      const criada = await criarMatriculaTx(tx, autor, input.matricula);
      if (criada.aguardaPreco) throw new ErroRegra("Os preços exigem aprovação. Use Salvar matrícula para encaminhar o pedido.");
      const ativada = await ativarMatriculaTx(tx, autor, criada.id, {
        valorRecebido: ativacao.valorRecebido,
        forma: ativacao.forma as FormaPagamento,
        dataPagamento: ativacao.dataPagamento,
        comprovanteUrl: ativacao.comprovanteUrl,
        comentario: ativacao.comentario,
      });
      return { id: criada.id, alunoId: criada.alunoId, leadId: ativada.leadId };
    });

    revalidar(res.leadId);
    return { id: res.id, alunoId: res.alunoId };
  });
}
