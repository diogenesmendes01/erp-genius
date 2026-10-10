import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarDesistenciasFinanceiras } from "@/server/matricula/desistencia-financeiro-consulta";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";
export default async function Page({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const nav = lerNavegacao(await searchParams);
  const resultado = await listarDesistenciasFinanceiras(nav);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  return <section className="space-y-4"><VoltarPara href="/financeiro" />
    <h1 className="text-2xl font-medium">Desistências para conferência financeira</h1>
    <p>Pedidos de matrículas em preparação com cobranças registradas. Cada caso exige conferência das condições antes de propor seu tratamento.</p>
    {!d.itens.length && (cursorDaLeitura(nav) !== null
      ? <EstadoVazio bloco acao={<Link className="underline" href="/financeiro/desistencias">Ir para o início da fila</Link>}>Nenhum pedido a partir deste ponto da fila: os pedidos seguintes já foram concluídos ou o link ficou antigo.</EstadoVazio>
      : <EstadoVazio bloco>Nenhum pedido de desistência aguardando conferência financeira.</EstadoVazio>)}
    {d.itens.map(m => <article key={m.id} className="rounded border p-3"><Link className="underline" href={`/matriculas/${encodeURIComponent(m.id)}/desistencia/financeiro`}>{m.codigo ?? "Matrícula"} · Pedido {m.pedido?.versao}</Link><p className="whitespace-pre-wrap">{m.pedido?.motivo}</p></article>)}
    <PaginacaoFila anterior={d.anterior} proxima={d.proxima} href={(cursor) => hrefLista("/financeiro/desistencias", cursor)} rotulo="Navegação da fila de desistências para conferência financeira" />
  </section>;
}
