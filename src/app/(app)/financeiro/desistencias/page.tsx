import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarDesistenciasFinanceiras } from "@/server/matricula/desistencia-financeiro-consulta";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
export default async function Page({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const resultado = await listarDesistenciasFinanceiras({ cursor });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  return <section className="space-y-4"><VoltarPara href="/financeiro" />
    <h1 className="text-2xl font-medium">Desistências para conferência financeira</h1>
    <p>Pedidos de matrículas em preparação com cobranças registradas. Cada caso exige conferência das condições antes de propor seu tratamento.</p>
    {!d.itens.length && <EstadoVazio bloco>Nenhum pedido nesta página.</EstadoVazio>}
    {d.itens.map(m => <article key={m.id} className="rounded border p-3"><Link className="underline" href={`/matriculas/${encodeURIComponent(m.id)}/desistencia/financeiro`}>{m.codigo ?? "Matrícula"} · Pedido {m.pedido?.versao}</Link><p className="whitespace-pre-wrap">{m.pedido?.motivo}</p></article>)}
    {d.proximoCursor && <Link className="underline" href={`/financeiro/desistencias?cursor=${encodeURIComponent(d.proximoCursor)}`}>Próxima página</Link>}
    {cursor && <Link className="ml-4 underline" href="/financeiro/desistencias">Voltar ao início</Link>}
  </section>;
}
