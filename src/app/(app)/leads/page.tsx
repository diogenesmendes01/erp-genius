import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { listarLeads, listarVendedores } from "@/server/comercial/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { LeadsLista, type LeadRow } from "./LeadsLista";
import { podeAtribuirOutroDono, type UsuarioSessao } from "@/server/_shared";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario: UsuarioSessao = {
    id: session.user.id,
    nome: session.user.name ?? "Usuário",
    papeis: (session.user.papeis ?? []) as Papel[],
  };

  const [leads, paises, vendedores] = await Promise.all([
    listarLeads(usuario),
    listarPaises(),
    listarVendedores(),
  ]);

  const rows: LeadRow[] = leads.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    nome: l.nome,
    telefoneE164: l.telefoneE164,
    segmento: l.segmento,
    temperatura: l.temperatura,
    etapa: l.etapa,
    b2b: l.b2b,
    pais: l.pais,
    vendedor: l.vendedor ? { nome: l.vendedor.nome } : null,
  }));

  return (
    <LeadsLista
      leads={rows}
      paises={paises.map((p) => ({ id: p.id, nome: p.nome }))}
      vendedores={vendedores}
      podeAtribuir={podeAtribuirOutroDono(usuario.papeis)}
    />
  );
}
