"use server";

import { z } from "zod";
import { Papel, CategoriaDocumento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, registrarEvento, ErroRegra, ErroPermissao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { expandirCoberturaMensal } from "@/server/matricula/cronograma-cobertura";
import { exigirPrecoPreparacaoAutorizado } from "@/server/matricula/preco-autorizado";
import { exigirAceiteManualPermitido } from "@/server/contratos/aceite-legado";

const PedidoSchema = z.object({ matriculaId: z.string().min(1), campo: z.enum(["primeiroNome", "sobrenome", "nomePreferido", "email", "telefoneE164", "documentos"]), valorProposto: z.string().trim().max(500), motivo: z.string().trim().min(5).max(2000) }).superRefine((d, ctx) => {
  let mensagem: string | undefined;
  if ((d.campo === "primeiroNome" || d.campo === "documentos") && !d.valorProposto) mensagem = "Informe o valor ou descreva a correção documental.";
  if (["primeiroNome", "sobrenome", "nomePreferido"].includes(d.campo) && d.valorProposto.length > 100) mensagem = "Use até 100 caracteres para o nome.";
  if (d.campo === "email" && d.valorProposto && !z.string().email().safeParse(d.valorProposto).success) mensagem = "Informe um e-mail válido.";
  if (d.campo === "telefoneE164" && d.valorProposto && !/^\+[1-9]\d{7,14}$/.test(d.valorProposto)) mensagem = "Informe telefone internacional com DDI.";
  if (mensagem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valorProposto"], message: mensagem });
});

function revalidar() { revalidatePath("/secretaria"); revalidatePath("/alunos", "layout"); revalidatePath("/leads", "layout"); }

export async function anexarDocumentoMatricula(matriculaId: string, input: { categoria: CategoriaDocumento; nome: string; url: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = z.object({ categoria: z.enum([CategoriaDocumento.CONTRATO, CategoriaDocumento.PROPOSTA, CategoriaDocumento.COMPROVANTE]), nome: z.string().trim().min(1).max(255), url: z.string().min(1) }).parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
      const matricula = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { alunoId: true, secretariaAssumiuEm: true } });
      if (!matricula?.secretariaAssumiuEm) throw new ErroRegra("Assuma a matrícula antes de anexar os documentos administrativos.");
      await exigirArquivoVinculavel(autor, dados.url, { matriculaId, categoriaDocumento: dados.categoria }, tx);
      const existente = await tx.documento.findFirst({ where: { url: dados.url }, select: { matriculaId: true, categoria: true, arquivado: true } });
      if (existente) {
        if (existente.matriculaId !== matriculaId || existente.categoria !== dados.categoria || existente.arquivado) throw new ErroPermissao("O arquivo já está vinculado a outro documento. Envie um novo arquivo.");
        return;
      }
      const documento = await tx.documento.create({ data: { matriculaId, ...dados } });
      await registrarEvento(tx, { tipo: "DocumentoAnexado", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: autor.id, payload: { documentoId: documento.id, categoria: dados.categoria } });
    });
    revalidar();
  });
}

export async function arquivarDocumentoMatricula(documentoId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const documento = await prisma.documento.findUnique({ where: { id: documentoId }, select: { matriculaId: true } });
    if (!documento?.matriculaId) throw new ErroRegra("Documento da matrícula não encontrado.");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${documento.matriculaId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR UPDATE`;
      const matricula = await tx.matricula.findUnique({ where: { id: documento.matriculaId! }, select: { secretariaAssumiuEm: true, contratoOk: true, contratoDocumentoId: true } });
      if (!matricula?.secretariaAssumiuEm) throw new ErroPermissao();
      if (matricula.contratoOk && matricula.contratoDocumentoId === documentoId) throw new ErroRegra("Registre a substituição contratual antes de arquivar um contrato confirmado.");
      const alterado = await tx.documento.updateMany({ where: { id: documentoId, arquivado: false }, data: { arquivado: true } });
      if (alterado.count) await registrarEvento(tx, { tipo: "DocumentoArquivado", agregadoTipo: "Matricula", agregadoId: documento.matriculaId!, autorId: autor.id, payload: { documentoId } });
    });
    revalidar();
  });
}

export async function assumirMatricula(matriculaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
      const matricula = await tx.matricula.findUnique({ where: { id: matriculaId } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      if (matricula.secretariaAssumiuEm) return;
      if (["ENCERRADA", "CANCELADA"].includes(matricula.status)) throw new ErroRegra("Matrícula encerrada não pode ser assumida.");
      await tx.matricula.update({ where: { id: matriculaId }, data: { secretariaAssumiuEm: new Date(), secretariaResponsavelId: autor.id } });
      await registrarEvento(tx, { tipo: "MatriculaAssumida", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: autor.id });
    });
    revalidar();
  });
}

export async function solicitarCorrecaoCadastro(input: z.input<typeof PedidoSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
    const dados = PedidoSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${dados.matriculaId} FOR UPDATE`;
      const escopo = await escopoComercialAtual(autor, tx);
      const matricula = await tx.matricula.findFirst({ where: { id: dados.matriculaId, lead: { is: escopo } }, select: { id: true, secretariaAssumiuEm: true } });
      if (!matricula) throw new ErroPermissao();
      if (!matricula.secretariaAssumiuEm) throw new ErroRegra("A secretaria ainda não assumiu esta matrícula.");
      const pedido = await tx.solicitacaoCorrecaoCadastro.create({ data: { ...dados, autorId: autor.id } });
      await registrarEvento(tx, { tipo: "CorrecaoCadastroSolicitada", agregadoTipo: "SolicitacaoCorrecaoCadastro", agregadoId: pedido.id, autorId: autor.id, payload: { matriculaId: dados.matriculaId, campo: dados.campo } });
    });
    revalidar();
  });
}

export async function resolverCorrecaoCadastro(id: string, input: { aprovar: boolean; motivo: string; documentoId?: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = z.object({ aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000), documentoId: z.string().optional() }).parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SolicitacaoCorrecaoCadastro" WHERE id = ${id} FOR UPDATE`;
      const pedido = await tx.solicitacaoCorrecaoCadastro.findUnique({ where: { id }, include: { matricula: { select: { id: true, alunoId: true, leadId: true } } } });
      if (!pedido || pedido.status !== "PENDENTE") throw new ErroRegra("Solicitação não está pendente.");
      if (dados.aprovar) {
        if (pedido.campo === "documentos") {
          if (dados.documentoId) await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${dados.documentoId} FOR UPDATE`;
          const documento = dados.documentoId && await tx.documento.findFirst({ where: { id: dados.documentoId, OR: [{ matriculaId: pedido.matricula.id }, ...(pedido.matricula.leadId ? [{ leadId: pedido.matricula.leadId }] : [])], arquivado: false, criadoEm: { gte: pedido.criadoEm }, categoria: { in: [CategoriaDocumento.CONTRATO, CategoriaDocumento.PROPOSTA, CategoriaDocumento.COMPROVANTE] } } });
          if (!documento) throw new ErroRegra("Anexe o documento corrigido e selecione-o como evidência da resolução.");
          await exigirArquivoVinculavel(autor, documento.url, { ...(documento.leadId ? { leadId: documento.leadId, alunoId: pedido.matricula.alunoId } : { matriculaId: pedido.matricula.id }), categoriaDocumento: documento.categoria }, tx);
        } else {
          const campo = z.enum(["primeiroNome", "sobrenome", "nomePreferido", "email", "telefoneE164"]).parse(pedido.campo);
          let valor: string | null = pedido.valorProposto?.trim() || null;
          if (campo === "primeiroNome") valor = z.string().min(1).max(100).parse(valor);
          if (campo === "email" && valor) valor = z.string().email().parse(valor);
          if (campo === "telefoneE164" && valor) valor = z.string().regex(/^\+[1-9]\d{7,14}$/, "Informe telefone internacional com DDI.").parse(valor);
          await tx.aluno.update({ where: { id: pedido.matricula.alunoId }, data: { [campo]: valor } });
          await registrarEvento(tx, { tipo: "AlunoEditado", agregadoTipo: "Aluno", agregadoId: pedido.matricula.alunoId, autorId: autor.id, payload: { campo, solicitacaoId: id } });
        }
      }
      await tx.solicitacaoCorrecaoCadastro.update({ where: { id }, data: { status: dados.aprovar ? "CONCLUIDA" : "REJEITADA", responsavelId: autor.id, motivoResolucao: dados.motivo, resolvidaEm: new Date() } });
      await registrarEvento(tx, { tipo: "CorrecaoCadastroResolvida", agregadoTipo: "SolicitacaoCorrecaoCadastro", agregadoId: id, autorId: autor.id, payload: { aprovada: dados.aprovar, motivo: dados.motivo, documentoId: dados.documentoId ?? null } });
    });
    revalidar();
  });
}

export async function confirmarContratoMatricula(matriculaId: string, documentoId: string, mensalidadesExibidas: { id: string; versao: number }[]) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const exibidas = z.array(z.object({ id: z.string().min(1), versao: z.number().int().nonnegative() }).strict()).parse(mensalidadesExibidas);
    await prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${matriculaId} ORDER BY id FOR UPDATE`;
      const matricula = await tx.matricula.findUnique({ where: { id: matriculaId } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      if (!matricula.secretariaAssumiuEm) throw new ErroRegra("Assuma a matrícula antes de confirmar o contrato.");
      await exigirPrecoPreparacaoAutorizado(tx, matriculaId);
      await exigirAceiteManualPermitido(tx, matriculaId);
      const mensalidades = await tx.cobranca.findMany({ where: { matriculaId, tipo: "MENSALIDADE" }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], select: { id: true, versao: true, coberturaInicio: true, coberturaFim: true, vencimento: true, valorNegociado: true, moeda: true } });
      if (exibidas.length !== mensalidades.length || new Set(exibidas.map((c) => c.id)).size !== exibidas.length || mensalidades.some((c) => !exibidas.some((e) => e.id === c.id && e.versao === c.versao))) {
        throw new ErroRegra("As mensalidades mudaram desde a consulta. Atualize a tela e confira as condições antes de registrar o aceite.");
      }
      if (matricula.referenciaCobertura || mensalidades.some((c) => c.coberturaInicio || c.coberturaFim)) {
        if (!mensalidades.length) throw new ErroRegra("Confira a primeira mensalidade antes do aceite.");
        expandirCoberturaMensal(matricula, mensalidades[0], 0);
      }
      await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR UPDATE`;
      const documento = await tx.documento.findFirst({ where: { id: documentoId, OR: [{ matriculaId }, ...(matricula.leadId ? [{ leadId: matricula.leadId }] : [])], categoria: "CONTRATO", arquivado: false } });
      if (!documento) throw new ErroRegra("Selecione um contrato vigente desta matrícula.");
      await exigirArquivoVinculavel(autor, documento.url, { ...(documento.leadId ? { leadId: documento.leadId, alunoId: matricula.alunoId } : { matriculaId }), categoriaDocumento: CategoriaDocumento.CONTRATO }, tx);
      if (matricula.contratoOk && matricula.contratoDocumentoId === documento.id) return;
      await tx.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: autor.id, contratoDocumentoId: documento.id } });
      await registrarEvento(tx, { tipo: "ContratoConfirmado", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: autor.id, payload: { documentoId, condicoesMensais: {
        referenciaCobertura: matricula.referenciaCobertura, dataReferenciaCobertura: matricula.dataReferenciaCobertura?.toISOString() ?? null, diaVencimento: matricula.diaVencimento,
        mensalidades: mensalidades.map((c) => ({ id: c.id, versao: c.versao, coberturaInicio: c.coberturaInicio?.toISOString() ?? null, coberturaFim: c.coberturaFim?.toISOString() ?? null, vencimento: c.vencimento.toISOString(), valorNegociado: c.valorNegociado.toString(), moeda: c.moeda })),
      } } });
    });
    revalidar();
  });
}
