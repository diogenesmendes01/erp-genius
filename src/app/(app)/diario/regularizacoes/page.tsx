import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarRegularizacoesAula } from "@/server/diario/regularizacao-consultas";
import { GerirDesignacoes } from "./GerirDesignacoes";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { STATUS_ENCONTRO_LABEL, rotular } from "@/lib/labels";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerOpcao, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";


export default async function RegularizacoesAulaPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const q = await searchParams, pagina = lerPagina(q);
  const modo = lerOpcao(q, "modo", ["PENDENTES", "HISTORICO"] as const) ?? "PENDENTES";
  const [resultado, preferencia] = await Promise.all([listarRegularizacoesAula({ pagina, modo }), consultarPreferenciaFusoEquipe()]);
  return <div className="space-y-5">
    <VoltarPara href="/diario" />
    <div>
      <h1 className="text-2xl font-medium">Regularizações de aula</h1>
      <p className="mt-1 text-sm text-gray-600">A designação é limitada à aula escolhida e preserva o professor original.</p>
    </div>
    {!resultado.ok && <p role="alert" className="text-red-700">{resultado.erro}</p>}
    {resultado.ok && resultado.dado && <>
      {resultado.dado.gestao && <nav className="flex gap-4 text-sm text-brand-700" aria-label="Modo de regularizações">
        <Link className={modo === "PENDENTES" ? "font-medium underline" : "underline"} href="/diario/regularizacoes?modo=PENDENTES">Pendências</Link>
        <Link className={modo === "HISTORICO" ? "font-medium underline" : "underline"} href="/diario/regularizacoes?modo=HISTORICO">Histórico</Link>
      </nav>}
      {!resultado.dado.itens.length && <EstadoVazio>{modo === "HISTORICO" ? "Nenhuma designação encontrada no histórico." : "Nenhuma regularização pendente."}</EstadoVazio>}
      {resultado.dado.itens.map((item) => {
        const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, item.fusoOrigem);
        const formatar = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor));
        return <article key={item.id} className="space-y-3 rounded border bg-[var(--surface)] p-4">
          <div>
            <h2 className="font-medium">{item.turma}</h2>
            <p className="text-sm">{formatar(item.inicio)} — {formatar(item.fim)} · exibido em {fuso}; origem {item.fusoOrigem}</p>
            <p className="text-sm text-gray-600">Status: {rotular(STATUS_ENCONTRO_LABEL, item.status)}</p>
            <p className="text-sm text-gray-600">Professor original: {item.professor}</p>
            <p className="text-sm">{item.designacao ? `Responsável designado: ${item.designacao.responsavel}` : "Sem responsável designado."}</p>
          </div>
          {item.podeRegularizar && <Link className="inline-block text-sm text-brand-700 underline" href={`/diario/encontros/${encodeURIComponent(item.id)}`}>Abrir chamada para regularizar</Link>}
          {resultado.dado?.gestao && <GerirDesignacoes encontroId={item.id} somenteLeitura={!item.podeGerir} fusoExibicao={fuso} />}
        </article>;
      })}
      <Paginacao pagina={pagina} temProxima={resultado.dado.temProxima} href={(p) => hrefLista("/diario/regularizacoes", { modo, pagina: p })} rotulo={modo === "HISTORICO" ? "Páginas do histórico de regularizações" : "Páginas de regularizações pendentes"} />
    </>}
  </div>;
}
