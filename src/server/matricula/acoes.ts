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
  calcularComissao,
  vencimentoMensalidade,
  vencimentoPrimeiraMensalidade,
  alocarPagamento,
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
import { podeConverterLead } from "./escopo";
// Conjuntos de papéis centralizados (compartilhados com a UI).
import { PAPEIS_CRIAR, PAPEIS_ATIVAR } from "./permissoes";

// Quem pode matricular SEM preço de referência (exceção de preço, Issue #7).
const PAPEIS_EXCECAO_PRECO: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR];

function revalidar(leadId?: string | null) {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/alunos");
  revalidatePath("/financeiro");
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
): Promise<{ id: string; alunoId: string; leadId: string | null }> {
  const dados = MatriculaSchema.parse(input);

  const pais = await tx.pais.findUnique({
    where: { id: dados.alunoPaisId },
    include: { tiposDocumento: true },
  });
  if (!pais) throw new ErroRegra("País não encontrado.");
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
    const lead = await tx.lead.findUnique({
      where: { id: dados.leadId },
      include: { matricula: { select: { id: true } } },
    });
    if (!lead) throw new ErroRegra("Lead não encontrado.");
    // Ownership/escopo: vendedor só converte lead do próprio escopo (doc 07).
    if (!podeConverterLead(autor, lead.vendedorDonoId)) throw new ErroPermissao();
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
  const refTaxa = precos.find((p) => p.tipoCobranca === TipoCobranca.MATRICULA)?.valor ?? dados.taxaValor;
  const refMens = precos.find((p) => p.tipoCobranca === TipoCobranca.MENSALIDADE)?.valor ?? dados.mensalidadeValor;

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
  let dataInicioAula: Date | null = null;
  if (dados.turmaId) {
    // 3) Revalida a turma DENTRO da transação (turma aberta, coerente com o
    // produto e com vaga). Vaga = capacidade − alocações ATIVAS (ativa:true).
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
    validarTurmaParaProduto(turma, produto, alocacoesAtivas);
    dataInicioAula = turma.dataInicio ?? null;
    await tx.alocacaoTurma.create({
      data: { alunoId: aluno.id, turmaId: turma.id, ativa: true },
    });
  }

  // Taxa de matrícula (vence agora)
  await tx.cobranca.create({
    data: {
      codigo: codTaxa,
      matriculaId: matricula.id,
      tipo: TipoCobranca.MATRICULA,
      valorOriginal: refTaxa,
      valorNegociado: dados.taxaValor,
      moeda,
      vencimento: new Date(),
      status: StatusCobranca.PENDENTE,
    },
  });

  // 1ª mensalidade (o restante do cronograma é gerado na ATIVAÇÃO — doc 09 / P18).
  // Vencimento = início da 1ª aula + 30 dias, ajustado ao dia escolhido (regra PO).
  // Não exige pagamento p/ ativar: entra PENDENTE com esse vencimento; sem turma/
  // dataInicio cai para a data atual + 30 dias.
  const primeira = vencimentoPrimeiraMensalidade(dados.diaVencimento, dataInicioAula);
  await tx.cobranca.create({
    data: {
      codigo: codPrimeiraMensalidade,
      matriculaId: matricula.id,
      tipo: TipoCobranca.MENSALIDADE,
      competencia: primeira.competencia,
      valorOriginal: refMens,
      valorNegociado: dados.mensalidadeValor,
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

  // Comissão = % da taxa, amarrada ao dono
  await tx.comissao.create({
    data: {
      matriculaId: matricula.id,
      vendedorId,
      percentual: dados.comissaoPct,
      valor: calcularComissao(dados.taxaValor, dados.comissaoPct),
      moeda,
      status: StatusComissao.PENDENTE,
    },
  });

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
    payload: { codigo: codMatricula, alunoId: aluno.id, produtoId: produto.id, leadId },
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
    payload: { vendedorId, percentual: dados.comissaoPct },
  });

  return { id: matricula.id, alunoId: aluno.id, leadId };
}

/**
 * Ativa uma matrícula recém-criada (ou existente) dentro de uma transação.
 *
 * Regra de domínio do PO (caminho único "Receber pagamento e ativar"):
 * - Lastro da ativação = TAXA DE MATRÍCULA QUITADA. O valor recebido é alocado
 *   SÓ à taxa; se NÃO cobrir a taxa, a matrícula NÃO ativa (lança ErroRegra e a
 *   transação é desfeita — fica AGUARDANDO). A 1ª mensalidade NÃO é exigida.
 * - Com a taxa quitada: matrícula vira ATIVA, e a 1ª mensalidade é apenas
 *   AGENDADA (vencimento = início da 1ª aula + 30 dias, ajustado ao dia
 *   escolhido) — não é baixada na ativação.
 *
 * Gera o restante do cronograma (meses 2..N a partir do vencimento da 1ª
 * mensalidade), aprova a comissão, move o lead para Matriculado e registra os
 * eventos de auditoria. Reutilizado por `ativarMatricula` e pela operação
 * atômica `criarEAtivarMatricula`.
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
  },
): Promise<{ leadId: string | null }> {
  const matricula = await tx.matricula.findUnique({
    where: { id: matriculaId },
    include: {
      cobrancas: { orderBy: { vencimento: "asc" } },
      comissoes: true,
      lead: { select: { etapa: true } },
    },
  });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  if (matricula.status === StatusMatricula.ATIVA) throw new ErroRegra("Matrícula já está ativa.");

  const taxa = matricula.cobrancas.find((c) => c.tipo === TipoCobranca.MATRICULA);
  const primeiraMensalidade = matricula.cobrancas.find((c) => c.tipo === TipoCobranca.MENSALIDADE);
  if (!taxa || !primeiraMensalidade)
    throw new ErroRegra("Matrícula sem taxa ou mensalidade para receber.");

  // Lastro da ativação: o valor recebido precisa cobrir a TAXA. A 1ª mensalidade
  // NÃO entra na alocação — não é exigida para ativar.
  const alocacao = alocarPagamento(dados.valorRecebido, [
    { id: taxa.id, valorNegociado: taxa.valorNegociado },
  ]);
  const taxaAloc = alocacao.alocacoes[0];
  // Regra dura: sem taxa paga não há ativação. Fica AGUARDANDO.
  if (!taxaAloc?.quitada) {
    throw new ErroRegra(
      "O valor recebido não cobre a taxa de matrícula; a matrícula continua AGUARDANDO ativação.",
    );
  }

  // Início da 1ª aula = Turma.dataInicio da turma alocada (quando houver).
  const alocacaoTurma = await tx.alocacaoTurma.findFirst({
    where: { alunoId: matricula.alunoId, ativa: true },
    orderBy: { criadoEm: "desc" },
    include: { turma: { select: { dataInicio: true } } },
  });
  const dataInicioAula = alocacaoTurma?.turma.dataInicio ?? null;

  // Cronograma gerado NA ATIVAÇÃO (doc 09 / P18): meses 2..N (o 1º já existe).
  const restante = Math.max(0, matricula.mesesPlano - 1);
  const codsRestante: string[] = [];
  for (let i = 0; i < restante; i++) codsRestante.push(await gerarCodigo("cobranca"));

  const agora = new Date();
  const dataPagamento = dados.dataPagamento ?? agora;

  // ----- Baixa da TAXA (lastro da ativação) -----
  await tx.cobranca.update({
    where: { id: taxa.id },
    data: {
      status: StatusCobranca.PAGO,
      pagoEm: dataPagamento,
      formaPagamento: dados.forma,
      valorRecebido: taxaAloc.valorRecebido,
      saldo: taxaAloc.saldo,
      comprovanteUrl: dados.comprovanteUrl || null,
      comentario: dados.comentario || null,
    },
  });
  await registrarEvento(tx, {
    tipo: "PagamentoRegistrado",
    agregadoTipo: "Cobranca",
    agregadoId: taxa.id,
    autorId: autor.id,
    payload: {
      valorRecebido: taxaAloc.valorRecebido,
      saldo: taxaAloc.saldo,
      quitada: true,
      forma: dados.forma,
      tipo: TipoCobranca.MATRICULA,
      comprovanteUrl: dados.comprovanteUrl || null,
    },
  });

  // ----- 1ª mensalidade: apenas AGENDADA (não é baixada na ativação) -----
  // Vencimento = início da 1ª aula + 30 dias, ajustado ao dia escolhido.
  const venc1 = vencimentoPrimeiraMensalidade(matricula.diaVencimento, dataInicioAula, agora);
  await tx.cobranca.update({
    where: { id: primeiraMensalidade.id },
    data: {
      competencia: venc1.competencia,
      vencimento: venc1.data,
      status: StatusCobranca.PENDENTE,
    },
  });

  await tx.matricula.update({
    where: { id: matriculaId },
    data: {
      status: StatusMatricula.ATIVA,
      contratoOk: true,
      pagamentoTaxaOk: true,
      // 1ª mensalidade NÃO é exigida para ativar — apenas agendada.
      primeiraMensalidadeOk: false,
      ativadaComPendencia: false,
      ativadaEm: agora,
    },
  });

  // Gera o restante do cronograma de mensalidades (meses 2..N), a partir do mês
  // de vencimento da 1ª mensalidade.
  for (let i = 0; i < restante; i++) {
    const { data, competencia } = vencimentoMes(matricula.diaVencimento, i + 1, venc1.data);
    await tx.cobranca.create({
      data: {
        codigo: codsRestante[i],
        matriculaId,
        tipo: TipoCobranca.MENSALIDADE,
        competencia,
        valorOriginal: primeiraMensalidade.valorOriginal,
        valorNegociado: primeiraMensalidade.valorNegociado,
        moeda: matricula.moeda,
        vencimento: data,
        status: StatusCobranca.PENDENTE,
      },
    });
  }
  if (restante > 0) {
    await registrarEvento(tx, {
      tipo: "CobrancaGerada",
      agregadoTipo: "Matricula",
      agregadoId: matriculaId,
      autorId: autor.id,
      payload: { quantidade: restante, tipo: "MENSALIDADE" },
    });
  }

  // Comissão: Pendente → Aprovada (matrícula ativa)
  for (const com of matricula.comissoes) {
    await tx.comissao.update({
      where: { id: com.id },
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
      lastro: "TAXA_QUITADA",
      forma: dados.forma,
      valorRecebido: dados.valorRecebido,
      taxaValor: taxa.valorNegociado,
      troco: alocacao.troco,
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
): Promise<Resultado<{ id: string; alunoId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_CRIAR);

    const res = await prisma.$transaction((tx) => criarMatriculaTx(tx, autor, input));
    revalidar(res.leadId);
    return { id: res.id, alunoId: res.alunoId };
  });
}

/**
 * Ativar matrícula (regra de domínio do PO). Lastro = TAXA DE MATRÍCULA QUITADA.
 *
 * Caminho único "Receber pagamento e ativar":
 * - O valor recebido é alocado à TAXA. Se NÃO cobrir a taxa, a matrícula NÃO
 *   ativa: permanece AGUARDANDO e a ação retorna mensagem clara (regra dura,
 *   sem exceção de papel). A 1ª mensalidade NÃO é exigida para ativar.
 * - Com a taxa quitada: matrícula vira ATIVA, a 1ª mensalidade é apenas
 *   AGENDADA (vencimento = início da 1ª aula + 30 dias, ajustado ao dia
 *   escolhido) e NÃO é baixada na ativação.
 *
 * Gera o cronograma (meses 2..N), aprova a comissão, move o lead e registra os
 * eventos de auditoria (MatriculaAtivada + PagamentoRegistrado da taxa). Tudo
 * na mesma transação. Exige papel de ativação.
 */
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

/**
 * Criar + ativar atômico (issue #8): cria a matrícula e a ativa numa única
 * transação. Exige os papéis de criar E ativar — se faltar qualquer um, nada é
 * gravado (não fica matrícula parcial). Para quem só pode criar, use `criarMatricula`.
 * A ativação segue a regra de domínio do PO: lastro = TAXA QUITADA; se o valor
 * recebido não cobrir a taxa, a transação inteira é desfeita (nada é gravado).
 */
export async function criarEAtivarMatricula(
  input: MatriculaComAtivacaoInput,
): Promise<Resultado<{ id: string; alunoId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_CRIAR);
    exigirPapel(autor, ...PAPEIS_ATIVAR);
    const ativacao = AtivacaoSchema.parse(input.ativacao);

    const res = await prisma.$transaction(async (tx) => {
      const criada = await criarMatriculaTx(tx, autor, input.matricula);
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
