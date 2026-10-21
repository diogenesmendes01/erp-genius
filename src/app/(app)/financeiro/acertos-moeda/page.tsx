import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAditivosParaTrocaMoeda } from "@/server/contratos/moeda-aditivo";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ESTADO_PROPOSTA_DECIDIDA_LABEL, rotular } from "@/lib/labels";

/** Q173: entrada do Financeiro para as trocas de moeda formalizadas em aditivo. */
export default async function AcertosMoedaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  // ?pagina inválida cai na primeira página, sem erro na tela.
  const solicitada = Number((await searchParams).pagina ?? 1);
  const pagina = Number.isInteger(solicitada) && solicitada >= 1 && solicitada <= 10000 ? solicitada : 1;
  const r = await listarAditivosParaTrocaMoeda(pagina);
  return <main className="space-y-4"><VoltarPara href="/financeiro" /><h1 className="text-2xl">Trocas de moeda por aditivo</h1>
    <p>A nova moeda vale só para o futuro e exige a matrícula sem pendências na moeda anterior. Preparação, aprovação independente e aplicação ficam registradas separadamente.</p>
    {!r.ok ? <p role="alert">{r.erro}</p> : <><ul className="space-y-3">{r.dado?.itens.map(v => <li key={v.versaoId}>
      <Link className="underline" href={`/financeiro/acertos-moeda/${encodeURIComponent(v.matriculaId)}/${encodeURIComponent(v.propostaId)}`}>Matrícula {v.matriculaCodigo ?? "sem código"} · {v.aluno} · condições versão {v.versao}</Link>
      <span> · moeda atual {v.moedaAtual} · {v.estado ? rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, v.estado) : "Sem proposta de troca"}</span>
    </li>)}</ul>
    {!r.dado?.itens.length && (pagina > 1
      ? <EstadoVazio acao={<Link href="?pagina=1">Ir para a primeira página</Link>}>Nenhum aditivo de moeda nesta página.</EstadoVazio>
      : <EstadoVazio>Nenhum aditivo formaliza troca de moeda.</EstadoVazio>)}
    <nav className="flex gap-4">{pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}{r.dado?.temProxima && <Link href={`?pagina=${pagina + 1}`}>Próxima</Link>}</nav></>}
  </main>;
}
