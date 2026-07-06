import { notFound } from "next/navigation";
import { obterLead } from "@/server/comercial/consultas";
import { listarProfessores } from "@/server/turmas/consultas";
import { FichaLead, type LeadFicha, type EventoTimeline } from "./FichaLead";
import { exigirSessaoPagina, numeroOuNull } from "@/server/_shared";

export default async function LeadDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guard de página com papéis FRESCOS do banco (não do JWT) — ver _shared/sessao.
  const usuario = await exigirSessaoPagina();

  const dados = await obterLead(id, usuario);
  if (!dados) notFound();
  const { lead, timeline } = dados;
  const professores = await listarProfessores();

  const ficha: LeadFicha = {
    id: lead.id,
    codigo: lead.codigo,
    nome: lead.nome,
    telefoneE164: lead.telefoneE164,
    etapa: lead.etapa,
    segmento: lead.segmento,
    temperatura: lead.temperatura,
    b2b: lead.b2b,
    criadoEm: lead.criadoEm.toISOString(),
    pais: lead.pais ? { nome: lead.pais.nome } : null,
    vendedor: lead.vendedor ? { nome: lead.vendedor.nome } : null,
    origemCampanha: lead.origemCampanha,
    origemAnuncio: lead.origemAnuncio,
    interesse: lead.interesse,
    objetivo: lead.objetivo,
    urgencia: lead.urgencia,
    orcamento: lead.orcamento,
    objecao: lead.objecao,
    proximaAcao: lead.proximaAcao,
    proximoFollowUp: lead.proximoFollowUp ? lead.proximoFollowUp.toISOString() : null,
    dataExperimental: lead.dataExperimental ? lead.dataExperimental.toISOString() : null,
    dataProposta: lead.dataProposta ? lead.dataProposta.toISOString() : null,
    motivoPerda: lead.motivoPerda,
    matricula: lead.matricula
      ? { id: lead.matricula.id, codigo: lead.matricula.codigo, status: lead.matricula.status }
      : null,
    valorPrevisto: numeroOuNull(lead.valorPrevisto),
    planoPrevisto: lead.planoPrevisto,
    comissaoPrevista: numeroOuNull(lead.comissaoPrevista),
    documentos: lead.documentos.map((d) => ({ id: d.id, categoria: d.categoria, nome: d.nome, url: d.url })),
    professorExperimentalId: lead.professorExperimentalId,
  };

  const eventos: EventoTimeline[] = timeline.map((ev) => ({
    id: ev.id,
    tipo: ev.tipo,
    payload: ev.payload,
    criadoEm: ev.criadoEm.toISOString(),
    autor: ev.autor ? { nome: ev.autor.nome } : null,
  }));

  return <FichaLead lead={ficha} timeline={eventos} professores={professores} />;
}
