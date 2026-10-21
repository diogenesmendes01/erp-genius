import { carregarAgendaParticularContratual } from "./agenda-particular";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { exigirPrecoPreparacaoAutorizado } from "@/server/matricula/preco-autorizado";
import { planejarCobrancasEntrada } from "@/server/matricula/plano-cobrancas-entrada";
import { preencherModelo } from "./preencher-modelo";
import { ConteudoModeloSchema } from "./modelo-schema";
import { OrigemCampo } from "./campos";
import { planejarExigenciasAssinatura } from "./exigencias-assinatura";

export const hashPrevia = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function carregarBasePrevia(tx: Prisma.TransactionClient, matriculaId: string, modeloId: string) {
  const m = await tx.matricula.findUnique({ where: { id: matriculaId }, include: {
    aluno: { select: { id: true, primeiroNome: true, sobrenome: true, documento: true, email: true, rua: true, numero: true, cidade: true, regiao: true, cep: true, paisResidencia: true } },
    preparacaoComercial: { select: { id: true, regime: true, reservaParticularId: true } },
    condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 },
    pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1 },
  } });
  if (!m?.secretariaAssumiuEm || !m.preparacaoComercial || !["RASCUNHO", "AGUARDANDO"].includes(m.status) || m.contratoOk) throw new ErroRegra("A prévia exige matrícula em preparação assumida pela Secretaria, ainda sem aceite confirmado.");
  const modelo = await tx.versaoModeloContratual.findUnique({ where: { id: modeloId }, include: { decisao: true } });
  if (!modelo?.decisao?.aprovada) throw new ErroRegra("Selecione uma versão de modelo publicada.");
  const conteudo = ConteudoModeloSchema.parse(modelo.conteudo);
  if (conteudo.finalidade !== "CONTRATO") throw new ErroRegra("Aditivo exige o fluxo vinculado ao contrato original.");
  if (!conteudo.regimes.includes(m.preparacaoComercial.regime as "MENSALIDADE" | "HORA_PARTICULAR")) throw new ErroRegra("Modelo incompatível com o regime desta contratação.");
  const condicoes = m.condicoesEntradaPreparacao[0], pagador = m.pagadoresPreparacao[0];
  if (!condicoes || !pagador) throw new ErroRegra("Confira pagador e condições antes da prévia.");
  const dados = z.object({ preparacaoId: z.string(), pagadorRegistroId: z.string(), valorServicoProposto: z.string(), aulas: z.object({ regime: z.string() }) }).parse(condicoes.dados);
  if (dados.preparacaoId !== m.preparacaoComercial.id || dados.pagadorRegistroId !== pagador.id || dados.aulas.regime !== m.preparacaoComercial.regime) throw new ErroRegra("Atualize as condições para a preparação e o pagador atuais.");
  await exigirPrecoPreparacaoAutorizado(tx, m.id);
  const plano = planejarCobrancasEntrada(condicoes.dados), taxa = plano.find((p) => p.tipo === "MATRICULA")!, mensalidade = plano.find((p) => p.tipo === "MENSALIDADE"), adiantamento = plano.find((p) => p.tipo === "HORA_PARTICULAR");
  const p = z.object({ nome: z.string().min(1), documento: z.string().nullable().optional(), email: z.string().nullable().optional(), endereco: z.string().nullable().optional() }).parse(pagador.dados);
  const dinheiro = (v: string) => `${new Prisma.Decimal(v).toFixed(2)} ${taxa.moeda}`;
  const fontes: Partial<Record<OrigemCampo, string | null | undefined>> = {
    ALUNO_NOME: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" "), ALUNO_DOCUMENTO: m.aluno.documento, ALUNO_EMAIL: m.aluno.email,
    ALUNO_ENDERECO: [m.aluno.rua, m.aluno.numero, m.aluno.cidade, m.aluno.regiao, m.aluno.cep, m.aluno.paisResidencia].filter(Boolean).join(", "),
    PAGADOR_NOME: p.nome, PAGADOR_DOCUMENTO: p.documento, PAGADOR_EMAIL: p.email, PAGADOR_ENDERECO: p.endereco,
    MOEDA: taxa.moeda, REGIME: m.preparacaoComercial.regime === "MENSALIDADE" ? "Mensalidade" : "Particular por hora",
    TAXA_VALOR: dinheiro(taxa.valor), TAXA_VENCIMENTO: taxa.vencimento,
    MENSALIDADE_VALOR: mensalidade && dinheiro(mensalidade.valor), PRIMEIRA_MENSALIDADE_VENCIMENTO: mensalidade?.vencimento,
    COBERTURA_INICIO: mensalidade?.cobertura?.inicio, COBERTURA_FIM: mensalidade?.cobertura?.fim,
    HORA_VALOR: m.preparacaoComercial.regime === "HORA_PARTICULAR" ? dinheiro(dados.valorServicoProposto) : undefined,
    ADIANTAMENTO_VALOR: adiantamento && dinheiro(adiantamento.valor), ADIANTAMENTO_MINUTOS: adiantamento?.minutos?.toString(), ADIANTAMENTO_VENCIMENTO: adiantamento?.vencimento,
  };
  const agendaParticular = m.preparacaoComercial.reservaParticularId ? await carregarAgendaParticularContratual(tx, m.id, m.preparacaoComercial.reservaParticularId) : null;
  if (agendaParticular) {
    const camposAgenda = conteudo.campos.filter((c) => c.origem === "AGENDA_PARTICULAR");
    if (!camposAgenda.some((c) => conteudo.secoes.some((s) => s.texto.includes(`{{${c.chave}}}`)))) throw new ErroRegra("O modelo aprovado precisa incluir a agenda particular no corpo do documento.");
    fontes.AGENDA_PARTICULAR = agendaParticular.texto;
  }
  const documento = preencherModelo(conteudo, fontes);
  const assinaturasPlanejadas = planejarExigenciasAssinatura(conteudo.assinaturas, {
    maioridade: null, // Conferência específica ainda não registrada; nascimento não basta.
    pagador: z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]).parse(pagador.tipo),
  });
  const snapshot = { ...(agendaParticular ? { agendaParticular: agendaParticular.snapshot } : {}), matriculaId: m.id, alunoId: m.aluno.id, preparacaoId: m.preparacaoComercial.id, pagadorRegistroId: pagador.id,
    condicoesId: condicoes.id, condicoesVersao: condicoes.versao, condicoes: condicoes.dados,
    modeloId: modelo.id, modeloCodigo: modelo.codigo, modeloVersao: modelo.versao, modeloHash: modelo.conteudoHash,
    publicacaoId: modelo.decisao.id, aplicacao: conteudo.aplicacao, assinaturasExigidas: conteudo.assinaturas, assinaturasPlanejadas, documento };
  return { snapshot, revisaoHash: hashPrevia(snapshot), condicoesId: condicoes.id, alunoId: m.aluno.id };
}
