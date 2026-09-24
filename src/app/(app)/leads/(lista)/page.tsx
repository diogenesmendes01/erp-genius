import { listarLeadsPagina, listarVendedores } from "@/server/comercial/consultas";
import { listarPaisesOperacionais } from "@/server/paises/consultas";
import { Papel } from "@prisma/client";
import { redirect } from "next/navigation";
import { ExportarPlanilha } from "@/components/ExportarPlanilha";
import { LeadsLista, type LeadRow } from "../LeadsLista";
import { exigirSessaoPagina, podeAtribuirOutroDono } from "@/server/_shared";
import { destinoPaginaLeads, filtrosLeadsParaQuery, lerFiltrosLeads, sanearFiltrosLeads } from "@/server/comercial/filtros";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Guard de página com papéis FRESCOS do banco (não do JWT) — ver _shared/sessao.
  const usuario = await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);

  // Filtros na URL (E4): sobrevivem a voltar/F5, o link é compartilhável e a exportação usa o mesmo
  // recorte. Os filtros só estreitam a carteira (escopo comercial aplicado dentro da consulta).
  const lidos = lerFiltrosLeads(await searchParams);
  const [paises, vendedores] = await Promise.all([listarPaisesOperacionais(), listarVendedores()]);
  const podeAtribuir = podeAtribuirOutroDono(usuario.papeis);
  // Filtro por dono só para quem enxerga a carteira de outros (gerente/admin); o vendedor só vê a sua.
  const donos = podeAtribuir ? vendedores : [];
  // Em sequência: a lista precisa dos filtros já saneados pelas opções.
  const filtros = sanearFiltrosLeads(lidos, { donos });
  const pagina = await listarLeadsPagina(usuario, filtros);
  const destino = destinoPaginaLeads(filtros, pagina.total);
  if (destino) redirect(destino);

  const rows: LeadRow[] = pagina.itens.map((l) => ({
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
    <><div className="mb-3 flex justify-end"><ExportarPlanilha tipo="leads" query={filtrosLeadsParaQuery(filtros, { semPagina: true })} /></div>
    <LeadsLista
      leads={rows}
      total={pagina.total}
      totalBase={pagina.totalBase}
      filtros={filtros}
      donos={donos}
      paises={paises.map((p) => ({ id: p.id, nome: p.nome }))}
      vendedores={vendedores}
      podeAtribuir={podeAtribuir}
    />
    </>
  );
}
