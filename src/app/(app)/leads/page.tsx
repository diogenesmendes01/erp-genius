import { listarLeads, listarVendedores } from "@/server/comercial/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { LeadsLista, type LeadRow } from "./LeadsLista";
import { exigirSessaoPagina, podeAtribuirOutroDono } from "@/server/_shared";

export default async function LeadsPage() {
  // Guard de página com papéis FRESCOS do banco (não do JWT) — ver _shared/sessao.
  const usuario = await exigirSessaoPagina();

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
