import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { CoberturasPainel } from "./CoberturasPainel";

export default async function CarteirasPage() {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_COMERCIAL);
  const admin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const [vendedores, coberturas, preferencia] = await Promise.all([
    prisma.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.VENDEDOR }, ...(admin ? {} : { gerenteComercialId: usuario.id }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.coberturaCarteira.findMany({ where: admin ? {} : { titular: { gerenteComercialId: usuario.id }, substituto: { gerenteComercialId: usuario.id } }, include: { titular: { select: { nome: true } }, substituto: { select: { nome: true } } }, orderBy: { criadoEm: "desc" }, take: 100 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  return <div className="space-y-5"><h1 className="text-2xl font-medium">Carteiras e coberturas</h1><p className="text-sm text-gray-500">A cobertura permite atender temporariamente a carteira do titular. Comissão, exportação e aprovação mantêm suas próprias permissões.</p><CoberturasPainel vendedores={vendedores} coberturas={coberturas.map((c) => ({ id: c.id, titular: c.titular.nome, substituto: c.substituto.nome, inicio: c.inicio.toISOString(), fim: c.fim.toISOString(), revogada: !!c.revogadaEm, motivo: c.motivo }))} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} /></div>;
}
