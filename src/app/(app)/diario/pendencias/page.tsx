import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAvisosDiario } from "@/server/diario/avisos-pendencias-diario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

function dataNoFuso(valor: string, fuso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor));
}

export default async function PendenciasDiarioPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const [resultado, preferencia] = await Promise.all([consultarAvisosDiario({ cursor }), consultarPreferenciaFusoEquipe()]);

  return <section className="space-y-5">
    <Link className="text-sm text-brand-700 underline" href="/diario">Voltar ao diário</Link>
    <div>
      <h1 className="text-2xl font-medium">Pendências do diário</h1>
      <p className="mt-1 text-sm text-gray-600">Cada prazo é mostrado no fuso registrado no encontro. Os avisos são atualizados ao consultar este painel. A regularização da aula acontece no diário.</p>
    </div>
    {!resultado.ok && <p role="alert" className="text-red-700">{resultado.erro}</p>}
    {resultado.ok && resultado.dado && <>
      {!resultado.dado.configurada && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Os prazos de regularização e lembrete do diário ainda não foram configurados.{usuario.papeis.includes(Papel.ADMINISTRADOR) && <> <Link className="underline" href="/configuracao/operacao/avisos-diario">Configurar avisos</Link>.</>}</p>}
      {resultado.dado.gestao && <p className="text-sm text-gray-600">Acompanhamento da gestão: alertas começam somente depois do prazo de regularização.</p>}
      {!resultado.dado.itens.length && <p>Nenhuma pendência de diário encontrada.</p>}
      {resultado.dado.itens.map((item) => {
        const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, item.fusoOrigem);
        return <article key={item.id} className="space-y-2 rounded border bg-[var(--surface)] p-4">
        <div>
          <h2 className="font-medium">{item.turma}</h2>
          <p className="text-sm text-gray-700">{dataNoFuso(item.inicio, fuso)} — {dataNoFuso(item.fim, fuso)} · exibido em {fuso}; origem {item.fusoOrigem}</p>
          <p className="text-sm text-gray-600">Professor: {item.professor}</p>
        </div>
        <ul className="list-disc pl-5 text-sm">{item.pendencias.map((pendencia) => <li key={pendencia}>{pendencia}</li>)}</ul>
        <p className={item.atrasada ? "text-sm font-medium text-red-700" : "text-sm text-gray-700"}>{item.vencimento ? <>Prazo: {dataNoFuso(item.vencimento, fuso)}{item.atrasada ? " — atrasada" : ""}</> : "Prazo ainda não configurado."}</p>
        <p className="text-sm text-gray-600">{item.quantidadeLembretes > 0 ? `${item.quantidadeLembretes} lembrete(s) registrado(s).` : "Nenhum lembrete registrado."}{item.ultimoLembreteEm && <> Último: {dataNoFuso(item.ultimoLembreteEm, fuso)}.</>}{item.proximoLembreteEm && <> Próximo: {dataNoFuso(item.proximoLembreteEm, fuso)}.</>}</p>
        {item.podeRegularizar && <Link className="inline-block text-sm text-brand-700 underline" href={`/diario/encontros/${encodeURIComponent(item.encontroId)}`}>Abrir diário para regularizar</Link>}
      </article>})}
      <nav className="flex gap-4 text-sm text-brand-700" aria-label="Paginação de pendências">
        {cursor && <Link className="underline" href="/diario/pendencias">Primeira página</Link>}
        {resultado.dado.proximoCursor && <Link className="underline" href={`/diario/pendencias?cursor=${encodeURIComponent(resultado.dado.proximoCursor)}`}>Próximas pendências</Link>}
      </nav>
    </>}
  </section>;
}
