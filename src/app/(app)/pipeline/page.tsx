import { listarLeads } from "@/server/comercial/consultas";
import { KanbanBoard, type KanbanLead } from "./KanbanBoard";
import { exigirSessaoPagina, numeroOuNull } from "@/server/_shared";

export default async function PipelinePage() {
  // Guard de página com papéis FRESCOS do banco (não do JWT) — ver _shared/sessao.
  const usuario = await exigirSessaoPagina();

  const leads = await listarLeads(usuario);
  const rows: KanbanLead[] = leads.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    nome: l.nome,
    etapa: l.etapa,
    temperatura: l.temperatura,
    b2b: l.b2b,
    pais: l.pais,
    proximaAcao: l.proximaAcao,
    valorPrevisto: numeroOuNull(l.valorPrevisto),
    ultimaAcaoEm: l.ultimaAcaoEm.toISOString(),
    etapaDesde: l.etapaDesde.toISOString(),
  }));

  return <KanbanBoard leads={rows} />;
}
