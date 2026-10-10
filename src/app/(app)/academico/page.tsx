import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarFilaSolicitacoesAcademicas } from "@/server/academico/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";
import { MudancasAcademicasPainel } from "./MudancasAcademicasPainel";

export default async function AcademicoPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  // As sub-seções da área estão nas abas do layout (E2); aqui fica só o que é desta tela.
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR);
  const filtros = await searchParams;
  const todas = filtros.historico === "todos", nav = lerNavegacao(filtros);
  const filtro = { historico: todas ? "todos" : null };
  const [resultado, preferencia] = await Promise.all([
    listarFilaSolicitacoesAcademicas({ ...nav, historico: todas }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const dados = resultado.ok ? resultado.dado : null;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "America/Sao_Paulo");
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-medium">Mudanças acadêmicas</h1><p className="mt-1 text-sm text-gray-500">Acompanhe pareceres, decisões pedagógicas e execução pela secretaria.</p></header>
    {/* Encontros é do diário, que a Secretaria não tem no menu: o caminho dela até lá é este. */}
    <Link className="inline-block text-sm text-brand-700 underline" href="/diario/encontros">Encontros e cancelamentos de particulares</Link>
    <nav aria-label="Filtro das solicitações acadêmicas" className="flex gap-3 text-sm"><Link href="/academico" className={!todas ? "font-medium text-brand-700" : "text-gray-500"} aria-current={!todas ? "page" : undefined}>Abertas</Link><Link href="/academico?historico=todos" className={todas ? "font-medium text-brand-700" : "text-gray-500"} aria-current={todas ? "page" : undefined}>Incluir histórico</Link></nav>
    <MudancasAcademicasPainel solicitacoes={dados?.solicitacoes ?? []} erroConsulta={resultado.ok ? null : resultado.erro} fusoExibicao={fusoExibicao} inicioDaFila={cursorDaLeitura(nav) !== null ? hrefLista("/academico", filtro) : null} />
    <PaginacaoFila anterior={dados?.anterior ?? null} proxima={dados?.proxima ?? null} href={(cursor) => hrefLista("/academico", { ...filtro, ...cursor })} rotulo="Navegação da fila de solicitações acadêmicas" />
  </div>;
}
