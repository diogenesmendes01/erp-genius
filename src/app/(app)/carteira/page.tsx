import { Papel } from "@prisma/client";
import Link from "next/link";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { botaoClasses } from "@/components/Botao";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";
import { carregarCarteira, lerFiltrosCarteira } from "@/server/crm/carteira";
import { listarCoberturas } from "@/server/acesso/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { CoberturasPainel } from "./CoberturasPainel";
import { ListaCarteira } from "./ListaCarteira";

const um = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

type Usuario = Parameters<typeof carregarCarteira>[0];

async function dadosCoberturas(usuario: Usuario, params: ParametrosUrl) {
  const pagina = lerPagina(params);
  const [lista, vendedores, preferencia, config] = await Promise.all([
    listarCoberturas(usuario, pagina),
    prisma.usuario.findMany({
      where: { ativo: true, papeis: { has: Papel.VENDEDOR }, ...(usuario.papeis.includes(Papel.ADMINISTRADOR) ? {} : { gerenteComercialId: usuario.id }) },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    consultarPreferenciaFusoEquipe(),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
  ]);
  return { pagina, lista, vendedores, fusoPadrao: config?.fusoInstitucional ?? "", fusoExibicao: (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null };
}

export default async function CarteiraPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
  const params = (await searchParams) ?? {};
  const gestao = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  // Só a gestão tem a aba Coberturas; ?aba=coberturas de vendedor cai na carteira.
  const aba = gestao && um(params.aba) === "coberturas" ? "coberturas" : "carteira";
  const filtros = lerFiltrosCarteira(params);
  const [cob, carteira] = await Promise.all([
    aba === "coberturas" ? dadosCoberturas(usuario, params) : null,
    aba === "carteira" ? carregarCarteira(usuario, filtros) : null,
  ]);
  const filtrando = !!(filtros.donoId || filtros.busca || filtros.semInteracaoDias || filtros.emTurma || filtros.tipo !== "todos");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium">{gestao ? "Carteira" : "Minha carteira"}</h1>
      {gestao && (
        <nav className="flex flex-wrap gap-1" aria-label="Seções da carteira">
          <Link href="/carteira" aria-current={aba === "carteira" ? "page" : undefined} className={botaoClasses({ variante: aba === "carteira" ? "primario" : "fantasma", tamanho: "md" })}>
            Carteira
          </Link>
          <Link href="/carteira?aba=coberturas" aria-current={aba === "coberturas" ? "page" : undefined} className={botaoClasses({ variante: aba === "coberturas" ? "primario" : "fantasma", tamanho: "md" })}>
            Coberturas
          </Link>
        </nav>
      )}
      {cob && (
        <>
          <p className="text-sm text-gray-500">A cobertura permite atender temporariamente a carteira do titular. Comissão, exportação e aprovação mantêm suas próprias permissões.</p>
          <CoberturasPainel
            vendedores={cob.vendedores}
            coberturas={cob.lista.itens.map((c) => ({ id: c.id, titular: c.titular, substituto: c.substituto, inicio: c.inicio.toISOString(), fim: c.fim.toISOString(), revogada: !!c.revogadaEm, motivo: c.motivo }))}
            fusoPadrao={cob.fusoPadrao}
            preferenciaFusoExibicao={cob.fusoExibicao}
          />
          <Paginacao pagina={cob.pagina} temProxima={cob.lista.possuiMais} href={(p) => hrefLista("/carteira", { aba: "coberturas", pagina: p })} rotulo="Páginas de coberturas" />
        </>
      )}
      {carteira && (
        <ListaCarteira
          linhas={carteira.linhas}
          vendedores={carteira.vendedores}
          total={carteira.total}
          filtros={filtros}
          podeReatribuir={gestao}
          filtrando={filtrando}
        />
      )}
    </div>
  );
}
