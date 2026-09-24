import { Papel } from "@prisma/client";
import { redirect } from "next/navigation";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarEmpresasPagina } from "@/server/empresas/consultas";
import { destinoPaginaEmpresas, lerFiltrosEmpresas, sanearFiltrosEmpresas } from "@/server/empresas/filtros";
import { listarPaisesSimples } from "@/server/paises/consultas";
import { EmpresasCliente } from "./EmpresasCliente";

// B2B — Fase 2 (doc 03): lista de empresas (contrato corporativo). Guard server-side
// ANTES de buscar dados; papéis alinhados ao nav.

const PAPEIS: Papel[] = [Papel.FINANCEIRO];

export default async function EmpresasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const papeis = await exigirPapelLeitura(...PAPEIS);
  if (!papeis) return <AcessoNegado recurso="as empresas (B2B)" />;

  // Filtros na URL (E4): sobrevivem a voltar/F5 e o link é compartilhável. A lista traz uma página.
  const lidos = lerFiltrosEmpresas(await searchParams);
  const paises = await listarPaisesSimples();
  // Em sequência: a lista precisa dos filtros já saneados pelas opções.
  const filtros = sanearFiltrosEmpresas(lidos, { paises });
  const pagina = await listarEmpresasPagina(filtros);
  const destino = destinoPaginaEmpresas(filtros, pagina.total);
  if (destino) redirect(destino);
  return (
    <EmpresasCliente
      empresas={pagina.itens}
      total={pagina.total}
      totalBase={pagina.totalBase}
      filtros={filtros}
      paises={paises}
    />
  );
}
