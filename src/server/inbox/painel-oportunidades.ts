import { papelEditaPrevisao } from "./previsao-capacidade";
import { carregarTarefasDoAtendimento, type TarefaPainel } from "./painel-tarefas";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { Papel, type CategoriaDocumento, type EtapaLead, type MotivoPerda, type StatusCobranca, type Temperatura } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { podeVerLeadNaThread } from "@/server/whatsapp/consultas-inbox";

export type StatusAlcadaPainel = "DENTRO_ALCADA" | "AGUARDANDO_APROVACAO" | "APROVADA" | "REJEITADA";
export type ContratacaoPainel = {
  matriculaId: string | null;
  statusAlcada: StatusAlcadaPainel | null;
  motivoDecisao: string | null;
  taxaMatricula: { cobrancaId: string; status: StatusCobranca; linkPagamento: string | null } | null;
};
export type DocumentoPropostaPainel = { id: string; nome: string; url: string; categoria: CategoriaDocumento };
export type OportunidadeAtualPainel = {
  id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null;
  probabilidadePct: number | null; previsaoFechamento: string | null; podeEditarPrevisao: boolean;
  etapa: EtapaLead; temperatura: Temperatura; responsavel: { id: string; nome: string } | null;
  dataExperimental: string | null; experimentalConfirmada: boolean; professorExperimental: string | null;
  professorExperimentalId: string | null; atendimentoId?: string; professores?: { id: string; nome: string }[];
  motivoPerda: MotivoPerda | null;
  interesse: string | null; objetivo: string | null; urgencia: string | null; orcamento: string | null; objecao: string | null; proximaAcao: string | null;
  documentosProposta: DocumentoPropostaPainel[];
  contratacao: ContratacaoPainel;
};

const ReferenciasAlcadaSchema = z.object({
  alcada: z.object({
    componentes: z.array(z.object({ resultado: z.enum(["DENTRO_ALCADA", "EXIGE_APROVACAO", "REFERENCIA_INSUFICIENTE"]) })).min(1),
  }).optional(),
}).passthrough();

type PreparacaoAlcada = {
  id: string;
  referencias: unknown;
  decisaoPreco: { aprovada: boolean; motivo: string; decididaEm: Date } | null;
} | null;
type MatriculaPainel = {
  id: string;
  status: string;
  preparacaoComercial: PreparacaoAlcada;
  cobrancas: { id: string; status: StatusCobranca; linkPagamento: string | null }[];
} | null;

export function projetarContratacao(matricula: MatriculaPainel): ContratacaoPainel {
  if (!matricula) return { matriculaId: null, statusAlcada: null, motivoDecisao: null, taxaMatricula: null };
  const decisao = matricula.preparacaoComercial?.decisaoPreco ?? null;
  let statusAlcada: StatusAlcadaPainel | null = null;
  let motivoDecisao: string | null = null;
  if (decisao) {
    statusAlcada = decisao.aprovada ? "APROVADA" : "REJEITADA";
    motivoDecisao = decisao.motivo;
  } else if (matricula.preparacaoComercial) {
    const lido = ReferenciasAlcadaSchema.safeParse(matricula.preparacaoComercial.referencias);
    const componentes = lido.success ? lido.data.alcada?.componentes : undefined;
    if (componentes?.length) statusAlcada = componentes.every((c) => c.resultado === "DENTRO_ALCADA") ? "DENTRO_ALCADA" : "AGUARDANDO_APROVACAO";
  }
  const taxa = matricula.cobrancas[0] ?? null;
  return {
    matriculaId: matricula.id,
    statusAlcada,
    motivoDecisao,
    taxaMatricula: taxa ? { cobrancaId: taxa.id, status: taxa.status, linkPagamento: taxa.linkPagamento } : null,
  };
}
export type OutraOportunidadePainel = { id: string; titulo: string; etapa: EtapaLead; valor: string | null; moeda: string | null };
export type ProfessorPainel = { id: string; nome: string };
export type OportunidadesPainel = { atual: OportunidadeAtualPainel | null; outras: OutraOportunidadePainel[]; pessoaId: string | null; tarefas: TarefaPainel[]; fusoEscola: string; professores: ProfessorPainel[]; professorExperimentalId: string | null };
const vazio = (tarefas: TarefaPainel[] = [], fusoEscola = ""): OportunidadesPainel => ({ atual: null, outras: [], pessoaId: null, tarefas, fusoEscola, professores: [], professorExperimentalId: null });

export async function carregarOportunidadesPainel(u: UsuarioSessao, atendimentoId: string, db: Db = prisma): Promise<OportunidadesPainel | null> {
  if (!u?.id) return null;
  if (db === prisma) return prisma.$transaction(tx => carregarOportunidadesPainel(u, atendimentoId, tx));
  const a = await db.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u, { db })] },
    select: { id: true, finalidade: true, leadId: true, conversa: { select: { contatoId: true } } },
  });
  if (!a) return null;
  if (a.finalidade !== "COMERCIAL") return vazio();
  const fusoEscola = await carregarFusoInstitucionalTx(db) ?? "";
  const leadVisivel = a.leadId && a.conversa.contatoId ? await podeVerLeadNaThread(u, a.id, a.leadId, Date.now(), db) : false;
  const tarefas = await carregarTarefasDoAtendimento(u, a, { soDaConversa: false }, db);
  if (!a.leadId || !leadVisivel) return vazio(tarefas, fusoEscola);
  const op = await db.oportunidade.findUnique({
    where: { id: a.leadId },
    select: {
      id: true, nome: true, pessoaId: true, probabilidadePct: true, previsaoFechamento: true, planoPrevisto: true, valorPrevisto: true, etapa: true, temperatura: true, motivoPerda: true,
      interesse: true, objetivo: true, urgencia: true, orcamento: true, objecao: true, proximaAcao: true,
      dataExperimental: true, experimentalConfirmadaEm: true, professorExperimentalId: true, pais: { select: { moedaLocal: true } },
      vendedor: { select: { id: true, nome: true } }, professorExperimental: { select: { id: true, nome: true } },
      documentos: { where: { arquivado: false, categoria: "PROPOSTA" }, orderBy: { criadoEm: "desc" }, select: { id: true, nome: true, url: true, categoria: true } },
      matricula: {
        select: {
          id: true,
          status: true,
          preparacaoComercial: {
            select: {
              id: true,
              referencias: true,
              decisaoPreco: { select: { aprovada: true, motivo: true, decididaEm: true } },
            },
          },
          cobrancas: {
            where: { tipo: "MATRICULA" },
            orderBy: { criadoEm: "asc" },
            take: 1,
            select: { id: true, status: true, linkPagamento: true },
          },
        },
      },
    },
  });
  if (!op) return vazio(tarefas, fusoEscola);
  const professores = await db.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const podeEditarPrevisao = papelEditaPrevisao(u) && !!await db.oportunidade.findFirst({where:{AND:[{id:op.id},await escopoComercialAtual(u,db)]},select:{id:true}});
  const outras = op.pessoaId ? await db.oportunidade.findMany({
    where: { AND: [{ pessoaId: op.pessoaId, id: { not: op.id } }, await escopoComercialAtual(u, db)] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 10,
    select: { id: true, nome: true, etapa: true, valorPrevisto: true, pais: { select: { moedaLocal: true } } },
  }) : [];
  return {
    atual: {
      id: op.id, titulo: op.nome, produto: op.planoPrevisto, valor: op.valorPrevisto?.toFixed(2) ?? null, moeda: op.pais?.moedaLocal ?? null,
      probabilidadePct: op.probabilidadePct, previsaoFechamento: op.previsaoFechamento, podeEditarPrevisao,
      etapa: op.etapa, temperatura: op.temperatura, responsavel: op.vendedor, dataExperimental: op.dataExperimental?.toISOString() ?? null,
      experimentalConfirmada: op.experimentalConfirmadaEm !== null, professorExperimental: op.professorExperimental?.nome ?? null,
      professorExperimentalId: op.professorExperimentalId ?? null, atendimentoId, professores, motivoPerda: op.motivoPerda,
      interesse: op.interesse ?? null, objetivo: op.objetivo ?? null, urgencia: op.urgencia ?? null, orcamento: op.orcamento ?? null, objecao: op.objecao ?? null, proximaAcao: op.proximaAcao ?? null,
      documentosProposta: op.documentos ?? [],
      contratacao: projetarContratacao(op.matricula ?? null),
    },
    outras: outras.map(o => ({ id: o.id, titulo: o.nome, etapa: o.etapa, valor: o.valorPrevisto?.toFixed(2) ?? null, moeda: o.pais?.moedaLocal ?? null })),
    pessoaId: op.pessoaId, tarefas, fusoEscola, professores, professorExperimentalId: op.professorExperimentalId ?? null,
  };
}