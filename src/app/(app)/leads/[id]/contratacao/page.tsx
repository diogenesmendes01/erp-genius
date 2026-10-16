import { redirect } from "next/navigation";

// Redirecionamento temporário: a contratação mora em /oportunidades/[id]/contratacao. Sai com a Tarefa 37.
export default async function ContratacaoLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect("/oportunidades/" + id + "/contratacao");
}
