import { EtapaLead, type AcaoAgenteIATipo, type FinalidadeAtendimentoWhatsApp, type Prisma } from "@prisma/client";
import { ETAPA_LABEL, MOTIVO_HANDOFF_LABEL } from "@/lib/labels";
import type { UsuarioSessao } from "../_shared";
import { escopoComercialAtual } from "../_shared/escopo-comercial";
import { capacidadesCrm } from "../crm/permissoes";
import { escopoTarefas } from "../crm/tarefas";
import { idsHandoffPendente } from "../inbox/estado-aria";
import { podeExecutar } from "../inbox/permissoes";
import type { Db } from "../whatsapp/escopo";
import { ehLinhaComercial } from "../whatsapp/linha-comercial";
import { podeVerLeadNaThread } from "../whatsapp/visibilidade-lead";
import { lerNotaResumo } from "./turno/handoff";
import type { MotivoHandoff } from "./turno/tipos";

const objeto = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const texto = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const etapa = (v: unknown): v is EtapaLead => Object.values(EtapaLead).some(e => e === v);
const motivoConhecido = (v: unknown): v is MotivoHandoff => typeof v === "string" && Object.hasOwn(MOTIVO_HANDOFF_LABEL, v);

/** Descreve a ação histórica; estado de ação não é recibo de entrega externa. */
export function descreverAcaoExecutada(acao: AcaoAgenteIATipo, payload: unknown): string {
  const p = objeto(payload);
  switch (acao) {
    case "RESPONDER": return "Respondeu ao contato";
    case "ENVIAR_DOCUMENTO": return "Enviou um documento";
    case "ATUALIZAR_CAMPO":
      return texto(p.nomeCampo) && (p.para === null || typeof p.para === "string" || typeof p.para === "boolean" || (typeof p.para === "number" && Number.isFinite(p.para))) ? "Preencheu " + p.nomeCampo + ": " + String(p.para ?? "") : "Preencheu um campo";
    case "TAG": return texto(p.nome) ? "Adicionou a tag " + p.nome : "Adicionou uma tag";
    case "MOVER_ETAPA": return etapa(p.para) ? "Moveu para " + ETAPA_LABEL[p.para] : "Moveu a etapa";
    case "MARCAR_PERDIDO": return "Marcou como perdido";
    case "CRIAR_TAREFA": return texto(p.titulo) ? "Criou tarefa: " + p.titulo : "Criou uma tarefa";
    case "AGENDAR_MENSAGEM": return "Agendou mensagem";
    case "NOTA_INTERNA": return "Escreveu uma nota interna";
    case "CONDICAO_COMERCIAL": return "Ofereceu condição comercial";
    case "CLASSIFICAR_SETOR": return "Classificou o setor";
    case "HANDOFF": return "Pediu um humano";
  }
}

export interface HandoffDoAtendimento {
  acaoId: string;
  pedidoEm: string;
  motivo: MotivoHandoff | null;
  motivoTexto: string;
  destino: "RESPONSAVEL" | "USUARIO" | "FILA_SETOR";
  responsavelNome: string | null;
  resumo: { quer: string | null; proximoPasso: string | null } | null;
  feito: { texto: string; quando: string }[];
  podeAssumir: boolean;
  ehResponsavel: boolean;
}
interface AlvoHandoff {
  id: string; finalidade: FinalidadeAtendimentoWhatsApp; leadId: string | null; responsavelId: string | null;
  conversa: { numero: { donoId: string | null; finalidade: string } };
}
const selectAcao = { id: true, acao: true, criadoEm: true, oportunidadeId: true, payload: true } as const;
type Linha = Prisma.AcaoAgenteIAGetPayload<{ select: typeof selectAcao }>;

/** Uso interno: a vem do escopo autorizado do atendimento, nunca de identidade fornecida pelo cliente. */
export async function handoffDoAtendimento(db: Db, u: UsuarioSessao, a: AlvoHandoff, agora: Date): Promise<HandoffDoAtendimento | null> {
  if (!(await idsHandoffPendente(db, [a.id])).includes(a.id)) return null;
  const handoff = await db.acaoAgenteIA.findFirst({ where: { atendimentoId: a.id, acao: "HANDOFF", status: "EXECUTADA" }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, criadoEm: true, payload: true } });
  if (!handoff) return null;
  const p = objeto(handoff.payload);
  const motivo = motivoConhecido(p.motivo) ? p.motivo : null;
  const destino = p.destino === "RESPONSAVEL" || p.destino === "USUARIO" ? p.destino : "FILA_SETOR";
  const responsavel = texto(p.responsavelId) ? await db.usuario.findUnique({ where: { id: p.responsavelId }, select: { nome: true } }) : null;
  // Nota do ATENDIMENTO segue E0: todo leitor autorizado pode ler, inclusive convidado.
  const nota = typeof p.nota === "string" ? lerNotaResumo(p.nota) : {};
  const resumo = nota.resumo || nota.proximoPasso ? { quer: nota.resumo ?? null, proximoPasso: nota.proximoPasso ?? null } : null;
  const contextoVisivel = a.finalidade === "COMERCIAL" && !!a.leadId && await podeVerLeadNaThread(u, a.id, a.leadId, agora.getTime(), db);
  const escopo = await escopoComercialAtual(u, db);
  const escolhidas: { linha: Linha; dados: boolean }[] = [];
  const base: Prisma.AcaoAgenteIAWhereInput = { atendimentoId: a.id, acao: { not: "HANDOFF" }, status: { in: ["EXECUTADA", "APROVADA"] }, criadoEm: { lte: handoff.criadoEm } };
  let cursor: { id: string; criadoEm: Date } | null = null;
  for (;;) {
    const pagina: Linha[] = await db.acaoAgenteIA.findMany({ where: cursor ? { AND: [base, { OR: [{ criadoEm: { lt: cursor.criadoEm } }, { criadoEm: cursor.criadoEm, id: { lt: cursor.id } }] }] } : base, select: selectAcao, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 100 });
    const ids = [...new Set(pagina.map(s => s.oportunidadeId ?? a.leadId).filter((id): id is string => id !== null))];
    const visiveis = new Set(ids.length ? (await db.oportunidade.findMany({ where: { AND: [{ id: { in: ids } }, escopo] }, select: { id: true } })).map(o => o.id) : []);
    if (contextoVisivel && a.leadId) visiveis.add(a.leadId);
    for (const linha of pagina) {
      const alvo = linha.oportunidadeId ?? a.leadId;
      if (alvo !== null && !visiveis.has(alvo)) continue;
      escolhidas.push({ linha, dados: alvo !== null });
      if (escolhidas.length === 10) break;
    }
    if (escolhidas.length === 10 || pagina.length < 100) break;
    cursor = pagina[pagina.length - 1];
  }
  const capacidades = capacidadesCrm(u.papeis);
  const idsTarefa = [...new Set(escolhidas.flatMap(({ linha }) => {
    const id = objeto(linha.payload).tarefaId;
    return linha.acao === "CRIAR_TAREFA" && texto(id) ? [id] : [];
  }))];
  const tarefasVisiveis = new Set(capacidades.has("tarefas.ver") && idsTarefa.length
    ? (await db.tarefa.findMany({ where: { AND: [{ id: { in: idsTarefa } }, await escopoTarefas(u, capacidades.has("tarefas.equipe"))] }, select: { id: true } })).map(t => t.id) : []);
  const feito = escolhidas.reverse().map(({ linha, dados }) => {
    const tarefaId = objeto(linha.payload).tarefaId;
    const detalhePermitido = dados && (linha.acao !== "ATUALIZAR_CAMPO" || capacidades.has("contatos.ver")) && (linha.acao !== "CRIAR_TAREFA" || (texto(tarefaId) && tarefasVisiveis.has(tarefaId)));
    return { texto: descreverAcaoExecutada(linha.acao, detalhePermitido ? linha.payload : null), quando: linha.criadoEm.toISOString() };
  });
  return { acaoId: handoff.id, pedidoEm: handoff.criadoEm.toISOString(), motivo, motivoTexto: motivo ? MOTIVO_HANDOFF_LABEL[motivo] : "Motivo não informado", destino, responsavelNome: responsavel?.nome ?? null, resumo, feito,
    podeAssumir: a.responsavelId === null && podeExecutar(u, "assumir", { setor: a.finalidade, responsavelId: null, linhaComercial: ehLinhaComercial(a.conversa.numero), donoLinhaId: a.conversa.numero.donoId }), ehResponsavel: a.responsavelId === u.id };
}
