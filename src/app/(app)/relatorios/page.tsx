import { OrigemCanal, Papel, Temperatura } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { lerOpcao, lerTexto, type ParametrosUrl } from "@/lib/pagina-url";
import { ETAPA_LABEL, MOTIVO_PERDA_LABEL, rotular } from "@/lib/labels";
import { escopoRelatorio } from "@/server/relatorios/escopo";
import { periodoAnterior, periodoDoFiltro, type FiltroPeriodo } from "@/server/relatorios/periodo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import type { FiltrosRelatorio } from "@/server/relatorios/pipeline";
import { detalharMetrica, lerChaveDetalhe, LIMITE_DETALHE } from "@/server/relatorios/detalhe";
import { Filtros } from "./_componentes/Filtros";
import { carregar, type IdAba } from "./_componentes/carregar";
import { Conteudo } from "./_componentes/Conteudo";
import { PainelDetalhe } from "./_componentes/PainelDetalhe";
import { listarResponsaveis } from "./_componentes/responsaveis";
import { podeExportar } from "./_componentes/pode-exportar";
import { hrefRelatorio, type ParamsRelatorio } from "./_componentes/formato";

const ABAS = [
  { id: "visao", rotulo: "Visão geral", soGestao: false, exporta: "pipeline" },
  { id: "funil", rotulo: "Funil", soGestao: false, exporta: "funil" },
  { id: "equipe", rotulo: "Equipe", soGestao: true, exporta: "equipe" },
  { id: "aria", rotulo: "Aria", soGestao: true, exporta: "aria" },
  { id: "conversas", rotulo: "Conversas", soGestao: false, exporta: "atendimento" },
  { id: "atividades", rotulo: "Atividades", soGestao: false, exporta: "atividades" },
] as const;

const TIPOS_PERIODO = ["HOJE", "7D", "30D", "PERSONALIZADO"] as const;

function rotuloDetalhe(chave: string): string {
  const [tipo, ...resto] = chave.split(":");
  const valor = resto.join(":");
  if (chave === "abertas") return "Oportunidades abertas";
  if (chave === "ganhas") return "Oportunidades ganhas";
  if (chave === "perdidas") return "Oportunidades perdidas";
  if (tipo === "etapa") return `Etapa ${rotular(ETAPA_LABEL, valor)}`;
  if (tipo === "perda") return `Perdidas: ${rotular(MOTIVO_PERDA_LABEL, valor)}`;
  if (tipo === "responsavel") return "Oportunidades da pessoa";
  return "Oportunidades";
}

/** Monta a query da exportação a partir do período efetivo; só leva `de`/`ate` no personalizado válido. */
function linkExportacao(aba: string, tipo: string, de: string, ate: string, extras: Record<string, string | undefined>): string {
  const q = new URLSearchParams({ aba, periodo: tipo });
  if (tipo === "PERSONALIZADO") { q.set("de", de); q.set("ate", ate); }
  for (const [k, v] of Object.entries(extras)) if (v) q.set(k, v);
  return q.toString();
}

export default async function RelatoriosPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
  const sp = (await searchParams) ?? {};
  const ehGestao = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  const abasVisiveis = ABAS.filter((a) => ehGestao || !a.soGestao);
  const aba: IdAba = lerOpcao(sp, "aba", abasVisiveis.map((a) => a.id)) ?? "visao";

  const escopo = await escopoRelatorio(usuario);
  const fuso = await fusoDaEscola();

  // Parâmetros da URL, validados. Vendedor não filtra por responsável nem por autor.
  const tipo = lerOpcao(sp, "periodo", TIPOS_PERIODO) ?? "30D";
  const de = lerTexto(sp, "de", 10);
  const ate = lerTexto(sp, "ate", 10);
  let erroPeriodo: string | null = null;
  let periodo;
  try {
    periodo = periodoDoFiltro({ tipo, de, ate } as FiltroPeriodo, fuso);
  } catch (erro) {
    erroPeriodo = erro instanceof Error ? erro.message : "Período inválido.";
    periodo = periodoDoFiltro({ tipo: "30D" }, fuso);
  }

  // Período que a tela de fato mostra: com período personalizado inválido, cai em 30D (sem `de`/`ate`).
  const tipoEfetivo = erroPeriodo ? "30D" : tipo;

  const pessoas = ehGestao ? await listarResponsaveis(escopo) : [];
  const filtroResponsavel = ehGestao ? lerOpcao(sp, "responsavel", pessoas.map((r) => r.id)) ?? undefined : undefined;
  const origem = lerOpcao(sp, "origem", Object.values(OrigemCanal)) ?? undefined;
  const temperatura = lerOpcao(sp, "temperatura", Object.values(Temperatura)) ?? undefined;
  const autor = ehGestao ? lerOpcao(sp, "autor", ["ARIA", "EQUIPE"] as const) ?? undefined : undefined;

  const f: FiltrosRelatorio = { periodo, responsavelId: filtroResponsavel, origem, temperatura, autor };
  const fa: FiltrosRelatorio = { ...f, periodo: periodoAnterior(periodo) };

  const params: ParamsRelatorio = {};
  const guardar = (k: string, v: string | undefined) => { if (v) params[k] = v; };
  guardar("aba", aba === "visao" ? undefined : aba);
  guardar("periodo", tipo === "30D" ? undefined : tipo);
  if (tipo === "PERSONALIZADO") { guardar("de", de); guardar("ate", ate); }
  guardar("responsavel", filtroResponsavel);
  guardar("origem", origem);
  guardar("temperatura", temperatura);
  guardar("autor", autor);

  const chave = lerChaveDetalhe(lerTexto(sp, "detalhe", 80));
  const busca = lerTexto(sp, "busca", 100);
  const paramsDetalhe: ParamsRelatorio = chave ? { ...params, detalhe: chave, ...(busca ? { busca } : {}) } : params;

  let carga: Awaited<ReturnType<typeof carregar>> | null = null;
  let erroDados = false;
  try {
    carga = await carregar(aba, f, fa, escopo);
  } catch {
    erroDados = true;
  }

  let detalhe: { total: number; itens: Awaited<ReturnType<typeof detalharMetrica>>["itens"] } | null = null;
  let erroDetalhe = false;
  if (chave) {
    try {
      detalhe = await detalharMetrica(chave, { ...f, busca: busca || undefined }, escopo);
    } catch {
      erroDetalhe = true;
    }
  }

  const exporta = (await podeExportar(usuario)) ? ABAS.find((a) => a.id === aba)!.exporta : null;
  const exportarHref = exporta
    ? `/api/relatorios/exportar?${linkExportacao(exporta, tipoEfetivo, de, ate, { responsavel: filtroResponsavel, origem, temperatura, autor })}`
    : null;

  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric" });
  const intervalo = (p: { inicio: Date; fim: Date }) => `${dia.format(p.inicio)} a ${dia.format(new Date(p.fim.getTime() - 1))}`;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium">Relatórios</h1>
        <p className="text-xs text-gray-600">
          {intervalo(periodo)} · comparado com {intervalo(periodoAnterior(periodo))}
        </p>
      </div>

      <nav aria-label="Abas dos relatórios" className="flex flex-wrap gap-1">
        {abasVisiveis.map((a) => {
          const ativa = a.id === aba;
          return (
            <a
              key={a.id}
              className={"rounded-full px-3 py-1.5 text-sm transition-colors max-sm:inline-flex max-sm:min-h-11 max-sm:items-center " + (ativa ? "bg-brand-solid font-medium text-on-brand" : "text-gray-600 hover:bg-highlight")}
            
              href={hrefRelatorio(params, { aba: a.id === "visao" ? null : a.id, detalhe: null, busca: null })}
              aria-current={ativa ? "page" : undefined}
            >
              {a.rotulo}
            </a>
          );
        })}
      </nav>

      <Filtros
        valores={{ periodo: tipo === "30D" ? "" : tipo, de, ate, responsavel: filtroResponsavel ?? "", origem: origem ?? "", temperatura: temperatura ?? "", autor: autor ?? "" }}
        aba={aba}
        pessoas={pessoas}
        mostrarResponsavel={ehGestao}
        mostrarAutor={ehGestao}
        mostrarFunil={false}
        exportarHref={exportarHref}
      />

      {erroPeriodo && <p role="alert" className="rounded-md bg-red-100 p-3 text-sm text-red-700">{erroPeriodo} Mostrando os últimos 30 dias.</p>}

      {erroDados || !carga ? (
        <p role="alert" className="rounded-md bg-red-100 p-3 text-sm text-red-700">Não foi possível carregar este relatório. Seus dados não foram alterados. Tente de novo; se repetir, fale com um administrador.</p>
      ) : (
        <Conteudo carga={carga} params={params} ehGestao={ehGestao} />
      )}

      {chave && <PainelDetalhe titulo={rotuloDetalhe(chave)} params={paramsDetalhe} resultado={detalhe} erro={erroDetalhe} limite={LIMITE_DETALHE} />}
    </div>
  );
}
