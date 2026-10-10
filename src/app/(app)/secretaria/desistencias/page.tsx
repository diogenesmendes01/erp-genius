import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarPendenciasAdministrativasDesistencia } from "@/server/matricula/desistencia-administrativa-fila";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";

export default async function DesistenciasAdministrativasPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const pagina = lerPagina(await searchParams);
  const resultado = await listarPendenciasAdministrativasDesistencia({ pagina });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  return <section className="space-y-4">
    <VoltarPara href="/secretaria" />
    <h1 className="text-2xl font-medium">Desistências pendentes de decisão administrativa</h1>
    <p>Confira o pedido mais recente de cada matrícula. A Secretaria acompanha; outra pessoa da Administração decide. A decisão não substitui os tratamentos financeiros e documentais nem efetiva a desistência.</p>
    {!d.itens.length && (pagina > 1
      ? <EstadoVazio bloco>Nenhum pedido pendente nesta página.</EstadoVazio>
      : <EstadoVazio bloco>Nenhum pedido aguardando decisão administrativa.</EstadoVazio>)}
    {d.itens.map(m => <article key={m.id} className="space-y-2 rounded border p-4">
      <h2 className="font-medium"><Link className="underline" href={`/matriculas/${encodeURIComponent(m.id)}/desistencia/administracao`}>{m.codigo ?? "Matrícula"} · Pedido {m.pedido.versao}</Link></h2>
      <p>Registrado por {m.pedido.registradorNome}.</p><p className="whitespace-pre-wrap">{m.pedido.motivo}</p>
      {m.exigeConferencia || !m.atual ? <p>As condições precisam de nova conferência antes de aprovar.</p>
        : m.podeAprovar ? <p>Pedido disponível para sua revisão administrativa.</p>
        : m.podeDecidir ? <p>Confira a situação do pedido; a aprovação não está disponível.</p>
        : <p>Aguardando revisão por outra pessoa da Administração.</p>}
    </article>)}
    <Paginacao pagina={pagina} temProxima={d.temProxima} href={(p) => hrefLista("/secretaria/desistencias", { pagina: p })} rotulo="Páginas de desistências pendentes" />
  </section>;
}
