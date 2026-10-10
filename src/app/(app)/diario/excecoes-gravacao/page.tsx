import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarExcecoesGravacao } from "@/server/diario/excecao-consulta";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { DecidirExcecao } from "./DecidirExcecao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";

export default async function ExcecoesPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const q = await searchParams, historico = q.historico === "todos", nav = lerNavegacao(q);
  const filtro = { historico: historico ? "todos" : null };
  const [r, preferencia] = await Promise.all([listarExcecoesGravacao({ ...nav, apenasPendentes: !historico }), consultarPreferenciaFusoEquipe()]);
  return <div className="space-y-4">
    <VoltarPara href="/diario" />
    <h1 className="text-2xl font-medium">Exceções de gravação</h1>
    <nav className="flex gap-4"><Link href="/diario/excecoes-gravacao">Pendentes</Link><Link href="/diario/excecoes-gravacao?historico=todos">Incluir histórico</Link></nav>
    {!r.ok && <p role="alert">{r.erro}</p>}
    {r.ok && !r.dado?.itens.length && (cursorDaLeitura(nav) !== null
      ? <EstadoVazio bloco acao={<Link className="underline" href={hrefLista("/diario/excecoes-gravacao", filtro)}>Ir para o início da fila</Link>}>Nenhuma solicitação a partir deste ponto da fila: o link ficou antigo ou a fila terminou.</EstadoVazio>
      : <EstadoVazio bloco>Nenhuma solicitação encontrada.</EstadoVazio>)}
    {r.ok && r.dado?.itens.map((p) => <article key={p.id} className="space-y-3 rounded border bg-[var(--surface)] p-4">
      {(() => { const exibicao = formatarInstanteExibicao(p.inicio, preferencia.ok ? preferencia.dado?.fusoExibicao : null, p.fusoOrigem); return <><h2 className="font-medium">{p.professor} · {exibicao.texto}</h2><p className="text-sm">{exibicao.fuso}</p></>; })()}<p className="whitespace-pre-wrap">{p.motivo}</p>
      {p.decisao && <p>{p.decisao.aprovada ? "Exceção aprovada" : "Solicitação rejeitada"}: {p.decisao.motivo}</p>}
      {p.diarioParaRevisao && <details><summary>Conferir diário atual</summary><p className="my-2 whitespace-pre-wrap">{p.diarioParaRevisao.conteudo}</p>
        <ul className="space-y-1">{p.diarioParaRevisao.registros.map((r, i) => <li key={i}>{r.nomeAluno}: {r.participacao === "IMPEDIDO_POR_RESTRICAO" ? "Impedido por restrição" : r.presente === null ? "Não informado" : r.presente ? "Presente" : "Ausente"}{r.observacao ? ` — ${r.observacao}` : ""}</li>)}</ul>
      </details>}
      {p.podeDecidir && <DecidirExcecao id={p.id} diarioCorresponde={p.diarioCorresponde} />}
    </article>)}
    {r.ok && r.dado && <PaginacaoFila anterior={r.dado.anterior} proxima={r.dado.proxima} href={(cursor) => hrefLista("/diario/excecoes-gravacao", { ...filtro, ...cursor })} rotulo="Navegação da fila de exceções de gravação" />}
  </div>;
}
