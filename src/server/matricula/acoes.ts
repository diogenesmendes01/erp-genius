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
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import {
  exigirSessao,
  exigirPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  calcularComissao,
  vencimentoMensalidade,
  normalizarTelefoneE164,
  avaliarPrecoReferencia,
  type Resultado,
} from "@/server/_shared";
import { MatriculaSchema, AtivacaoSchema, type MatriculaInput, type AtivacaoInput } from "./schema";

const PAPEIS_CRIAR: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];
const PAPEIS_ATIVAR: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

function revalidar(leadId?: string | null) {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/alunos");
  revalidatePath("/financeiro");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

// vencimento/comissão: regras puras em @/server/_shared/regras (testáveis).
const vencimentoMes = vencimentoMensalidade;

export async function criarMatricula(
  input: MatriculaInput,
): Promise<Resultado<{ id: string; alunoId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_CRIAR);
    const dados = MatriculaSchema.parse(input);

    const pais = await prisma.pais.findUnique({ where: { id: dados.alunoPaisId } });
    if (!pais) throw new ErroRegra("País não encontrado.");
    const produto = await prisma.produto.findUnique({ where: { id: dados.produtoId } });
    if (!produto) throw new ErroRegra("Produto não encontrado.");

    const moeda = pais.moedaLocal;

    // dono do lead = quem recebe a comissão; senão o criador (se vendedor)
    let vendedorId = autor.id;
    let leadId: string | null = null;
    if (dados.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: dados.leadId },
        include: { matricula: { select: { id: true } } },
      });
      if (!lead) throw new ErroRegra("Lead não encontrado.");
      if (lead.matricula) throw new ErroRegra("Lead já possui matrícula.");
      leadId = lead.id;
      if (lead.vendedorDonoId) vendedorId = lead.vendedorDonoId;
    }

    // referência de preço (para registrar valorOriginal)
    const precos = await prisma.precoReferencia.findMany({
      where: { ativo: true, paisId: pais.id, produtoId: produto.id },
    });

    // Issue #22 — regra para matrícula sem preço de referência ativo.
    // Decisão: PERMITIR, mas como EXCEÇÃO AUDITÁVEL: exige justificativa, marca a
    // matrícula (`precoReferenciaAusente`) e grava Evento `MatriculaSemPrecoReferencia`.
    // (Sem preço ativo, o valor "negociado" segue, mas não há referência sugerida —
    // o valorOriginal cai para o próprio valor manual informado.)
    const precoRef = avaliarPrecoReferencia(precos);
    const justificativaSemPreco = dados.justificativaSemPreco?.trim() || null;
    if (precoRef.ausente && !justificativaSemPreco) {
      throw new ErroRegra(
        "Não há preço de referência ativo para este país/produto. Informe uma justificativa para registrar a matrícula como exceção.",
      );
    }

    const refTaxa = precos.find((p) => p.tipoCobranca === TipoCobranca.MATRICULA)?.valor ?? dados.taxaValor;
    const refMens = precos.find((p) => p.tipoCobranca === TipoCobranca.MENSALIDADE)?.valor ?? dados.mensalidadeValor;

    const codAluno = await gerarCodigo("aluno");
    const codMatricula = await gerarCodigo("matricula");
    const codTaxa = await gerarCodigo("cobranca");
    const codPrimeiraMensalidade = await gerarCodigo("cobranca");
    const codCertificado = dados.certificadoValor && dados.certificadoValor > 0 ? await gerarCodigo("cobranca") : null;

    const ids = await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.create({
        data: {
          codigo: codAluno,
          nome: dados.alunoNome,
          paisId: pais.id,
          documento: dados.alunoDocumento || null,
          telefoneE164: normalizarTelefoneE164(dados.alunoTelefone, pais.ddi),
          email: dados.alunoEmail || null,
          genero: dados.alunoGenero ?? null,
          nascimento: dados.alunoNascimento ?? null,
        },
      });

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
          precoReferenciaAusente: precoRef.ausente,
          justificativaSemPreco: precoRef.ausente ? justificativaSemPreco : null,
        },
      });

      if (dados.turmaId) {
        await tx.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: dados.turmaId } });
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

      // 1ª mensalidade (o restante do cronograma é gerado na ATIVAÇÃO — doc 09 / P18)
      const primeira = vencimentoMes(dados.diaVencimento, 0);
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

      if (leadId) {
        await tx.lead.update({ where: { id: leadId }, data: { etapa: EtapaLead.AGUARDANDO_MATRICULA } });
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

      // Exceção auditável (issue #22): sem preço de referência ativo.
      if (precoRef.ausente) {
        await registrarEvento(tx, {
          tipo: "MatriculaSemPrecoReferencia",
          agregadoTipo: "Matricula",
          agregadoId: matricula.id,
          autorId: autor.id,
          payload: {
            paisId: pais.id,
            produtoId: produto.id,
            tiposAusentes: precoRef.tiposAusentes,
            justificativa: justificativaSemPreco,
            taxaValor: dados.taxaValor,
            mensalidadeValor: dados.mensalidadeValor,
          },
        });
      }

      return { id: matricula.id, alunoId: aluno.id };
    });

    revalidar(leadId);
    return ids;
  });
}

/**
 * Receber pagamento e ativar (decisão P7): exige taxa + 1ª mensalidade pagas + contrato.
 * Marca as duas cobranças como pagas, ativa a matrícula, aprova a comissão e
 * move o lead para Matriculado.
 */
export async function ativarMatricula(
  matriculaId: string,
  input: AtivacaoInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ATIVAR);
    const dados = AtivacaoSchema.parse(input);

    const matricula = await prisma.matricula.findUnique({
      where: { id: matriculaId },
      include: { cobrancas: { orderBy: { vencimento: "asc" } }, comissoes: true },
    });
    if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
    if (matricula.status === StatusMatricula.ATIVA) throw new ErroRegra("Matrícula já está ativa.");

    const taxa = matricula.cobrancas.find((c) => c.tipo === TipoCobranca.MATRICULA);
    const primeiraMensalidade = matricula.cobrancas.find((c) => c.tipo === TipoCobranca.MENSALIDADE);
    if (!taxa || !primeiraMensalidade)
      throw new ErroRegra("Matrícula sem taxa ou mensalidade para receber.");

    // Cronograma gerado NA ATIVAÇÃO (doc 09 / P18): meses 2..N (o 1º já existe).
    const restante = Math.max(0, matricula.mesesPlano - 1);
    const codsRestante: string[] = [];
    for (let i = 0; i < restante; i++) codsRestante.push(await gerarCodigo("cobranca"));

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      for (const c of [taxa, primeiraMensalidade]) {
        await tx.cobranca.update({
          where: { id: c.id },
          data: {
            status: StatusCobranca.PAGO,
            pagoEm: agora,
            formaPagamento: dados.forma as FormaPagamento,
            valorRecebido: c.valorNegociado,
            saldo: 0,
          },
        });
        await registrarEvento(tx, {
          tipo: "PagamentoRegistrado",
          agregadoTipo: "Cobranca",
          agregadoId: c.id,
          autorId: autor.id,
          payload: { valorRecebido: c.valorNegociado, forma: dados.forma },
        });
      }

      await tx.matricula.update({
        where: { id: matriculaId },
        data: {
          status: StatusMatricula.ATIVA,
          contratoOk: true,
          pagamentoTaxaOk: true,
          primeiraMensalidadeOk: true,
          ativadaEm: agora,
        },
      });

      // Gera o restante do cronograma de mensalidades (meses 2..N)
      for (let i = 0; i < restante; i++) {
        const { data, competencia } = vencimentoMes(matricula.diaVencimento, i + 1);
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

      if (matricula.leadId) {
        await tx.lead.update({ where: { id: matricula.leadId }, data: { etapa: EtapaLead.MATRICULADO } });
      }

      await registrarEvento(tx, {
        tipo: "MatriculaAtivada",
        agregadoTipo: "Matricula",
        agregadoId: matriculaId,
        autorId: autor.id,
        payload: { ativadaEm: agora.toISOString(), forma: dados.forma },
      });
      await registrarEvento(tx, {
        tipo: "ComissaoAprovada",
        agregadoTipo: "Matricula",
        agregadoId: matriculaId,
        autorId: autor.id,
      });
    });

    revalidar(matricula.leadId);
  });
}
