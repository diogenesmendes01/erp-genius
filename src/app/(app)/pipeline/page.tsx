import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { listarLeads } from "@/server/comercial/consultas";
import { KanbanBoard, type KanbanLead } from "./KanbanBoard";
import type { UsuarioSessao } from "@/server/_shared";

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario: UsuarioSessao = {
    id: session.user.id,
    nome: session.user.name ?? "Usuário",
    papeis: (session.user.papeis ?? []) as Papel[],
  };

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
    valorPrevisto: l.valorPrevisto,
    ultimaAcaoEm: l.ultimaAcaoEm.toISOString(),
    etapaDesde: l.etapaDesde.toISOString(),
  }));

  return <KanbanBoard leads={rows} />;
}
