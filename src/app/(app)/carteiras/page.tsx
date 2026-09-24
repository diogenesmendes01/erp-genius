import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { CoberturasPainel } from "./CoberturasPainel";
import { redirect } from "next/navigation";
import { Paginacao } from "@/components/Paginacao";
import { faixaDaPagina, hrefLista, lerPagina, paginaAlemDoFim, type ParametrosUrl } from "@/lib/pagina-url";

/** Coberturas por página (E4: antes, as 100 mais recentes, sem aviso nem como ver as demais). */
const COBERTURAS_POR_PAGINA = 50;

export default async function CarteirasPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_COMERCIAL);
  const admin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const pagina = lerPagina((await searchParams) ?? {});
  const whereCoberturas = admin ? {} : { titular: { gerenteComercialId: usuario.id }, substituto: { gerenteComercialId: usuario.id } };
  const total = await prisma.coberturaCarteira.count({ where: whereCoberturas });
  const ultima = paginaAlemDoFim(pagina, COBERTURAS_POR_PAGINA, total);
  if (ultima) redirect(hrefLista("/carteiras", { pagina: ultima }));
  const [vendedores, coberturas, preferencia] = await Promise.all([
    prisma.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.VENDEDOR }, ...(admin ? {} : { gerenteComercialId: usuario.id }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.coberturaCarteira.findMany({ where: whereCoberturas, include: { titular: { select: { nome: true } }, substituto: { select: { nome: true } } }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (pagina - 1) * COBERTURAS_POR_PAGINA, take: COBERTURAS_POR_PAGINA }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const { inicio, fim, temProxima } = faixaDaPagina(pagina, COBERTURAS_POR_PAGINA, coberturas.length, total);
  return <div className="space-y-5"><h1 className="text-2xl font-medium">Carteiras e coberturas</h1><p className="text-sm text-gray-500">A cobertura permite atender temporariamente a carteira do titular. Comissão, exportação e aprovação mantêm suas próprias permissões.</p><CoberturasPainel vendedores={vendedores} coberturas={coberturas.map((c) => ({ id: c.id, titular: c.titular.nome, substituto: c.substituto.nome, inicio: c.inicio.toISOString(), fim: c.fim.toISOString(), revogada: !!c.revogadaEm, motivo: c.motivo }))} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />{total > 0 && <p className="text-xs text-gray-500">{inicio}–{fim} de {total} {total === 1 ? "cobertura" : "coberturas"}</p>}<Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista("/carteiras", { pagina: p })} rotulo="Páginas de coberturas" /></div>;
}
