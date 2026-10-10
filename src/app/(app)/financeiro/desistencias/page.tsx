import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarDesistenciasFinanceiras } from "@/server/matricula/desistencia-financeiro-consulta";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";
export default async function Page({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const pagina = lerPagina(await searchParams);
  const resultado = await listarDesistenciasFinanceiras({ pagina });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  return <section className="space-y-4"><VoltarPara href="/financeiro" />
    <h1 className="text-2xl font-medium">Desistências para conferência financeira</h1>
    <p>Pedidos de matrículas em preparação com cobranças registradas. Cada caso exige conferência das condições antes de propor seu tratamento.</p>
    {!d.itens.length && (pagina > 1
      ? <EstadoVazio bloco>Nenhum pedido nesta página.</EstadoVazio>
      : <EstadoVazio bloco>Nenhum pedido de desistência aguardando conferência financeira.</EstadoVazio>)}
    {d.itens.map(m => <article key={m.id} className="rounded border p-3"><Link className="underline" href={`/matriculas/${encodeURIComponent(m.id)}/desistencia/financeiro`}>{m.codigo ?? "Matrícula"} · Pedido {m.pedido?.versao}</Link><p className="whitespace-pre-wrap">{m.pedido?.motivo}</p></article>)}
    <Paginacao pagina={pagina} temProxima={d.temProxima} href={(p) => hrefLista("/financeiro/desistencias", { pagina: p })} rotulo="Páginas de desistências para conferência financeira" />
  </section>;
}
