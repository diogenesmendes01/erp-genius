import { Papel } from "@prisma/client";
import Link from "next/link";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { hrefLista } from "@/lib/pagina-url";
import { listarVendedores } from "@/server/comercial/consultas";
import { listarPaisesOperacionais } from "@/server/paises/consultas";
import { listarContatos, lerFiltrosContatos, obterContato } from "@/server/crm/contatos";
import { camposDaPessoa, paresDuplicados, pessoasMesclaveis, tagsAtivas, type PessoaMesclavel } from "@/server/crm/ficha-dados";
import { historicoPessoa, type FiltroHistoricoPessoa } from "@/server/crm/historico";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { CLASSES_COR_TAG } from "@/server/crm/tags";
import { FichaContato } from "./FichaContato";
import { ListaContatos } from "./ListaContatos";
import { paramsDaLista } from "./params-lista";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

type Params = Record<string, string | string[] | undefined>;

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const FILTROS_HISTORICO: FiltroHistoricoPessoa[] = ["tudo", "notas", "etapas", "alteracoes"];

export default async function ContatosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA);
  const params = await searchParams;
  const filtros = lerFiltrosContatos(params);
  const idAberto = primeiro(params.c).trim();
  const hist = primeiro(params.hist);
  const filtroHistorico = (FILTROS_HISTORICO as string[]).includes(hist) ? (hist as FiltroHistoricoPessoa) : "tudo";
  const capacidades = [...capacidadesCrm(usuario.papeis)];
  const pode = (c: (typeof capacidades)[number]) => capacidades.includes(c);
  const comercial = pode("funil.ver");
  const podeMesclar = pode("contatos.mesclar");
  const podeExportar = usuario.papeis.includes(Papel.ADMINISTRADOR) || (usuario.permissoes ?? []).includes("dados.exportar_contatos");

  const [lista, tags, vendedores, paises, config, detalhe, pares, preferencia] = await Promise.all([
    listarContatos(usuario, filtros),
    tagsAtivas(),
    comercial ? listarVendedores() : Promise.resolve([]),
    comercial ? listarPaisesOperacionais() : Promise.resolve([]),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    idAberto ? obterContato(idAberto, usuario) : Promise.resolve(null),
    podeMesclar ? paresDuplicados(usuario) : Promise.resolve([]),
    consultarPreferenciaFusoEquipe(),
  ]);
  const [historico, campos] = detalhe
    ? await Promise.all([historicoPessoa(detalhe.id, usuario, filtroHistorico).then((h) => h ?? []), camposDaPessoa(detalhe.id, usuario)])
    : [[], []];
  const idsPessoas = lista.itens.filter((l) => l.tipo === "pessoa").map((l) => l.id);
  const mapa = podeMesclar ? await pessoasMesclaveis(usuario, idsPessoas) : new Map<string, PessoaMesclavel>();

  const base = paramsDaLista(filtros);
  const filtrando = !!(filtros.busca || filtros.tagId || filtros.donoId || filtros.etapa || filtros.origem || filtros.tipo !== "todos");
  const hrefsHistorico = Object.fromEntries(
    FILTROS_HISTORICO.map((f) => [f, hrefLista("/contatos", { ...base, pagina: filtros.pagina, c: idAberto, hist: f === "tudo" ? null : f })]),
  ) as Record<FiltroHistoricoPessoa, string>;
  const aberto = !!detalhe;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Contatos</h1>
      {!!idAberto && !detalhe && (
        <p role="status" className="text-sm text-gray-600">
          Contato não encontrado na sua carteira. <Link href={hrefLista("/contatos", base)} className="text-brand-700 hover:underline">Ver a lista</Link>
        </p>
      )}
      <div className="grid gap-6 min-[700px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={aberto ? "max-[699px]:hidden" : ""}>
          <ListaContatos
            itens={lista.itens}
            total={lista.total}
            possuiMais={lista.possuiMais}
            filtros={filtros}
            abertoId={detalhe?.id ?? ""}
            tags={tags.map((t) => ({ id: t.id, nome: t.nome }))}
            vendedores={vendedores}
            comercial={comercial}
            podeImportar={pode("contatos.importar")}
            podeMesclar={podeMesclar}
            podeExportar={podeExportar}
            pares={pares}
            mesclaveis={Object.fromEntries(mapa)}
            filtrando={filtrando}
          />
        </div>
        {detalhe && (
          <div>
            <FichaContato
              detalhe={detalhe}
              historico={historico}
              campos={campos}
              tagsDisponiveis={tags}
              classesCor={CLASSES_COR_TAG}
              capacidades={capacidades}
              vendedores={vendedores}
              paises={paises.map((p) => ({ id: p.id, nome: p.nome }))}
              filtroHistorico={filtroHistorico}
              hrefVoltar={hrefLista("/contatos", { ...base, pagina: filtros.pagina })}
              hrefsHistorico={hrefsHistorico}
              fuso={config?.fusoInstitucional ?? undefined}
              preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
              abaInicial={hist ? "historico" : "geral"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
