import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaReposicoesDocente } from "@/server/diario/reposicao-consulta";
import { ReposicaoDocente } from "./ReposicaoDocente";
import { listarReposicoesConcluidasDesignadas } from "@/server/diario/correcao-reposicao-consulta";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function ReposicoesDocentePage({ searchParams }: { searchParams: Promise<{ cursor?: string; correcoesAntes?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { cursor, correcoesAntes } = await searchParams;
  const [r, concluidas, preferencia] = await Promise.all([consultarFilaReposicoesDocente({ cursor }), listarReposicoesConcluidasDesignadas({ antesId: correcoesAntes }), consultarPreferenciaFusoEquipe()]);
  return <div className="space-y-5">
    <VoltarPara href="/diario" />
    <header><h1 className="text-2xl font-medium">Fila de reposições individuais</h1><p className="mt-1 text-sm text-gray-600">Mostra apenas reposições atribuídas a você. Não há dados pessoais, contrato comercial ou cobrança nesta fila.</p></header>
    {!r.ok && <p role="alert">{r.erro}</p>}
    {r.ok && r.dado?.itens.length === 0 && <p>Nenhuma reposição pendente para sua atuação.</p>}
    {r.ok && r.dado?.itens.map((item) => <ReposicaoDocente key={item.id} reposicaoId={item.id} versaoAnterior={item.versaoAnterior} modalidade={item.modalidade} origem={item.origem} entrega={item.entrega} encontros={item.encontros} fusoExibicao={resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, item.origem.fuso)} />)}
    {r.ok && r.dado?.proximoCursor && <Link className="inline-block text-sm text-brand-700 underline" href={`/diario/reposicoes?cursor=${encodeURIComponent(r.dado.proximoCursor)}`}>Próximas reposições</Link>}
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-medium">Histórico e correções</h2>
      <p>Reposições com conclusão registrada que continuam sob sua atribuição. Uma correção exige aprovação da gestão.</p>
      {!concluidas.ok && <p role="alert">{concluidas.erro}</p>}
      {concluidas.ok && !concluidas.dado?.itens.length && <p>Nenhuma conclusão disponível para sua consulta.</p>}
      {concluidas.ok && concluidas.dado?.itens.map(item => <div key={item.id}>
        <Link className="underline" href={`/academico/reposicoes/correcoes/${encodeURIComponent(item.id)}`}>
          {item.modalidade === "GRAVACAO" ? "Gravação" : "Particular"} — aula de {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, item.origem.fuso) }).format(new Date(item.origem.inicio))} (origem {item.origem.fuso}): consultar e propor correção
        </Link>
      </div>)}
      {concluidas.ok && concluidas.dado?.proximoAntesId && <Link className="block underline" href={`/diario/reposicoes?correcoesAntes=${encodeURIComponent(concluidas.dado.proximoAntesId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`}>Outras conclusões</Link>}
      {correcoesAntes && <Link className="block underline" href={`/diario/reposicoes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`}>Voltar ao início do histórico</Link>}
    </section>
  </div>;
}
