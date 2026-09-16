import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarLotesPreparacaoMigracao } from "@/server/migracao/consultas";
import { PreparacaoMigracaoPainel } from "./PreparacaoMigracaoPainel";

export default async function PreparacaoMigracaoPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const resultado = await consultarLotesPreparacaoMigracao(cursor ? { cursor } : {});
  const fila = resultado.ok && resultado.dado ? resultado.dado : { itens: [], proximoCursor: null };
  return <section className="max-w-5xl space-y-6">
    <div><h2 className="text-lg font-medium">Preparação de migração</h2><p className="mt-1 text-sm text-gray-600">Registra a fotografia da origem e as pendências para revisão. Esta tela não cria alunos, matrículas, consentimentos, presença, cobranças ou recebimentos.</p></div>
    <PreparacaoMigracaoPainel />
    <div className="rounded border"><div className="border-b px-4 py-3 text-sm font-medium">Lotes preparados</div>{resultado.ok ? fila.itens.length ? <ul className="divide-y">{fila.itens.map((lote) => <li key={lote.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div><Link className="font-medium text-brand-700 underline" href={`/configuracao/migracao/${encodeURIComponent(lote.id)}`}>{lote.origem} · {lote.chaveLote}</Link><p className="text-gray-500">{lote.linhas} linhas · {lote.pendencias} pendências · {lote.colisoes} colisões · {lote.conflitosEntrada} tentativas divergentes · preparado por {lote.preparadoPorNome}</p></div><span className={lote.estado === "PREPARADO" ? "text-green-700" : "text-amber-700"}>{lote.estado === "PREPARADO" ? "Preparado" : "Com pendências"}</span></li>)}</ul> : <p className="px-4 py-5 text-sm text-gray-500">Nenhum lote foi preparado ainda.</p> : <p className="px-4 py-5 text-sm text-red-700">Não foi possível consultar os lotes: {resultado.erro}</p>}{fila.proximoCursor && <div className="border-t px-4 py-3"><Link className="text-sm text-brand-700 underline" href={`/configuracao/migracao?cursor=${encodeURIComponent(fila.proximoCursor)}`}>Próxima página</Link></div>}</div>
  </section>;
}
