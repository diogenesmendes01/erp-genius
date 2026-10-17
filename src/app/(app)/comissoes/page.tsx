import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { hrefLista, lerOpcao, lerPagina, lerTexto, type ParametrosUrl } from "@/lib/pagina-url";
import { carregarPainelComissoes, type PeriodoComissao } from "@/server/crm/comissoes-painel";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { PainelComissoes } from "./PainelComissoes";

const PERIODOS: readonly PeriodoComissao[] = ["mes", "mes_anterior", "trimestre", "ano"];

export default async function ComissoesPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
  const params = (await searchParams) ?? {};
  const papeis = usuario.papeis;
  const veTodos = papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO) || papeis.includes(Papel.GERENTE_COMERCIAL);
  const periodo = lerOpcao(params, "periodo", PERIODOS) ?? "mes";
  const pagina = lerPagina(params);
  const vendedorId = veTodos ? lerTexto(params, "vendedor") || undefined : undefined;
  const [painel, config, vendedores] = await Promise.all([
    carregarPainelComissoes(usuario, { periodo, vendedorId, pagina }),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    veTodos
      ? prisma.usuario.findMany({
          where: { ativo: true, papeis: { has: Papel.VENDEDOR }, ...(papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO) ? {} : { gerenteComercialId: usuario.id }) },
          select: { id: true, nome: true }, orderBy: { nome: "asc" },
        })
      : Promise.resolve([] as { id: string; nome: string }[]),
  ]);
  return (
    <PainelComissoes
      painel={painel}
      periodo={periodo}
      pagina={pagina}
      vendedorId={vendedorId ?? ""}
      vendedores={vendedores}
      veTodos={veTodos}
      podeFecharMes={papeis.includes(Papel.FINANCEIRO)}
      podeEstornar={capacidadesCrm(papeis).has("comissoes.estornar")}
      fuso={config?.fusoInstitucional ?? "America/Sao_Paulo"}
      hrefPagina={(p) => hrefLista("/comissoes", { periodo: periodo === "mes" ? null : periodo, vendedor: vendedorId, pagina: p })}
    />
  );
}
