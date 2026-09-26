import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarExtrasRecuperacao } from "@/server/avaliacoes/extra-recuperacao";
import { ProporExtra, DecidirExtra } from "./Formularios";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function ExtrasPage({ params, searchParams }: { params: Promise<{ alocacaoId: string }>; searchParams: Promise<{ antesId?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId } = await params, { antesId } = await searchParams;
  const r = await consultarExtrasRecuperacao({ alocacaoId, antesId });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <VoltarPara href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`} para="Avaliações" />
    <h1 className="text-2xl font-medium">Oportunidades extras de recuperação</h1>
    <p>{d.identificacao.aluno} · matrícula {d.identificacao.matriculaCodigo ?? d.identificacao.matriculaId} · {d.identificacao.oferta} · {d.identificacao.nivel}</p>
    <p>Quando o saldo estiver esgotado, professor ou gestão pode propor uma quantidade adicional. Outra pessoa da Gestão Pedagógica/Administração decide. A autorização não dispensa notas mínimas, plano aprovado ou prazo de realização.</p>
    {d.habilidadesSolicitaveis.length ? <ProporExtra alocacaoId={alocacaoId} habilidades={d.habilidadesSolicitaveis} /> : <EstadoVazio bloco>Nenhuma habilidade deste vínculo ativo exige oportunidade extra neste momento.</EstadoVazio>}
    <h2 className="text-xl font-medium">Propostas e decisões</h2>
    {!d.itens.length && <EstadoVazio bloco>Nenhuma proposta registrada.</EstadoVazio>}
    {d.itens.map(p => <article className="space-y-2 rounded border p-4" key={p.id}>
      <h3 className="font-medium">{p.habilidade.replaceAll("_", " ")} — {p.quantidade} oportunidade(s) adicional(is)</h3>
      <p>Na solicitação: limite da regra {p.base.limiteBase}; extras já aprovadas {p.base.extrasAprovados}; oportunidades ocupadas {p.base.ocupadas}.</p>
      <p className="whitespace-pre-wrap">Motivo: {p.motivo}</p><p className="whitespace-pre-wrap">Evidências: {p.evidencias}</p>
      {p.decisao ? <p className="whitespace-pre-wrap">{p.decisao.aprovada ? "Aprovada" : "Rejeitada"}: {p.decisao.motivo}</p> : <p>Aguardando decisão independente.</p>}
      {p.podeDecidir && !p.podeAprovar && <p>A base da proposta mudou. Rejeite para registrar uma nova proposta com os dados atuais.</p>}
      {p.podeDecidir && p.entradaHash && <DecidirExtra propostaId={p.id} entradaHash={p.entradaHash} podeAprovar={p.podeAprovar} />}
    </article>)}
    {d.proximoId && <Link className="underline" href={`?${new URLSearchParams({ antesId: d.proximoId })}`}>Propostas anteriores</Link>}
  </section>;
}
