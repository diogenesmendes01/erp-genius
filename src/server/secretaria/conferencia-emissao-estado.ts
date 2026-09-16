import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { planejarCobrancasEntrada } from "@/server/matricula/plano-cobrancas-entrada";
import { carregarAgendaParticularContratual } from "@/server/contratos/agenda-particular";

export async function carregarRevisaoEmissao(tx: Prisma.TransactionClient, matriculaId: string) {
  const m = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { id: true, status: true, secretariaAssumiuEm: true, contratoOk: true,
    aluno: { select: { id: true, primeiroNome: true, sobrenome: true, paisId: true, documento: true, documentoValido: true, email: true, telefoneE164: true, rua: true, numero: true, cidade: true, regiao: true, cep: true, paisResidencia: true } },
    preparacaoComercial: { select: { id: true, reservaParticularId: true, referencias: true, decisaoPreco: { select: { id: true, aprovada: true } } } },
    pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, tipo: true, dados: true } },
    condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, dados: true } },
    reservasVaga: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, orderBy: { id: "asc" }, select: { id: true, status: true, expiraEm: true, turmaId: true } },
    documentos: { where: { arquivado: false }, orderBy: { id: "asc" }, select: { id: true, categoria: true, nome: true, url: true } },
  } });
  if (!m?.secretariaAssumiuEm || !m.preparacaoComercial || !["RASCUNHO", "AGUARDANDO"].includes(m.status) || m.contratoOk) throw new ErroRegra("Confira uma matrícula em preparação assumida pela Secretaria.");
  const pagador = m.pagadoresPreparacao[0], condicoes = m.condicoesEntradaPreparacao[0];
  if (!pagador || !condicoes) throw new ErroRegra("Registre pagador e condições de entrada antes da conferência.");
  const dados = z.object({ nome: z.string().trim().min(1), paisId: z.string().min(1), documento: z.string().nullable().optional(), email: z.string().nullable().optional(), telefoneE164: z.string().nullable().optional(), endereco: z.string().nullable().optional() }).safeParse(pagador.dados);
  if (!dados.success || (!dados.data.email?.trim() && !dados.data.telefoneE164?.trim())) throw new ErroRegra("Complete identificação e contato do pagador antes de emitir.");
  const referencia = z.object({ pagadorRegistroId: z.string(), preparacaoId: z.string() }).parse(condicoes.dados);
  if (referencia.pagadorRegistroId !== pagador.id || referencia.preparacaoId !== m.preparacaoComercial.id) throw new ErroRegra("As condições precisam referenciar a proposta e o pagador atuais.");
  const plano = planejarCobrancasEntrada(condicoes.dados);
  const agendaParticular = m.preparacaoComercial.reservaParticularId
    ? await carregarAgendaParticularContratual(tx, m.id, m.preparacaoComercial.reservaParticularId) : null;
  const snapshot = JSON.parse(JSON.stringify({ ...m, plano, ...(agendaParticular ? { agendaParticular: agendaParticular.snapshot } : {}) })) as Prisma.InputJsonObject;
  const hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const avisos = [];
  if (!m.aluno.documento || !m.aluno.documentoValido) avisos.push("Documento do aluno ausente ou com alerta de validação: confira a informação antes de confirmar.");
  if (!dados.data.documento?.trim()) avisos.push("Documento do pagador não informado; confira a identificação necessária para esta cobrança.");
  return { dadosVisiveis: { aluno: m.aluno, pagador: { tipo: pagador.tipo, versao: pagador.versao, dados: dados.data }, documentos: m.documentos, versaoCondicoes: condicoes.versao, agendaParticular: agendaParticular?.texto ?? null }, snapshot, hash, condicoesId: condicoes.id, alunoId: m.aluno.id, avisos, plano };
}
