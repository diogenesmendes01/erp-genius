import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarPendenciasAdministrativasDesistencia } from "@/server/matricula/desistencia-administrativa-fila";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";

export default async function DesistenciasAdministrativasPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const nav = lerNavegacao(await searchParams);
  const resultado = await listarPendenciasAdministrativasDesistencia(nav);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  return <section className="space-y-4">
    <VoltarPara href="/secretaria" />
    <h1 className="text-2xl font-medium">Desistências pendentes de decisão administrativa</h1>
    <p>Confira o pedido mais recente de cada matrícula. A Secretaria acompanha; outra pessoa da Administração decide. A decisão não substitui os tratamentos financeiros e documentais nem efetiva a desistência.</p>
    {!d.itens.length && (cursorDaLeitura(nav) !== null
      ? <EstadoVazio bloco acao={<Link className="underline" href="/secretaria/desistencias">Ir para o início da fila</Link>}>Nenhum pedido pendente a partir deste ponto da fila: os seguintes já foram decididos ou o link ficou antigo.</EstadoVazio>
      : <EstadoVazio bloco>Nenhum pedido aguardando decisão administrativa.</EstadoVazio>)}
    {d.itens.map(m => <article key={m.id} className="space-y-2 rounded border p-4">
      <h2 className="font-medium"><Link className="underline" href={`/matriculas/${encodeURIComponent(m.id)}/desistencia/administracao`}>{m.codigo ?? "Matrícula"} · Pedido {m.pedido.versao}</Link></h2>
      <p>Registrado por {m.pedido.registradorNome}.</p><p className="whitespace-pre-wrap">{m.pedido.motivo}</p>
      {m.exigeConferencia || !m.atual ? <p>As condições precisam de nova conferência antes de aprovar.</p>
        : m.podeAprovar ? <p>Pedido disponível para sua revisão administrativa.</p>
        : m.podeDecidir ? <p>Confira a situação do pedido; a aprovação não está disponível.</p>
        : <p>Aguardando revisão por outra pessoa da Administração.</p>}
    </article>)}
    <PaginacaoFila anterior={d.anterior} proxima={d.proxima} href={(cursor) => hrefLista("/secretaria/desistencias", cursor)} rotulo="Navegação da fila de desistências pendentes" />
  </section>;
}
