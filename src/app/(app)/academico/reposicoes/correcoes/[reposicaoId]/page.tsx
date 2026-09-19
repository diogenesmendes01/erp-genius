import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCorrecoesConclusaoReposicao } from "@/server/diario/correcao-reposicao-consulta";
import { CorrecoesConclusaoReposicao } from "./CorrecoesConclusaoReposicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function CorrecoesReposicao({
  params, searchParams,
}: {
  params: Promise<{ reposicaoId: string }>;
  searchParams: Promise<{ antesVersao?: string; conclusaoVersao?: string }>;
}) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { reposicaoId } = await params;
  const { antesVersao, conclusaoVersao } = await searchParams;
  const numeroSeguro = (valor: string | undefined) => valor !== undefined && /^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
  const antes = antesVersao === undefined ? undefined : numeroSeguro(antesVersao);
  const conclusao = conclusaoVersao === undefined ? undefined : numeroSeguro(conclusaoVersao);
  if ((antesVersao !== undefined && antes === null) || (conclusaoVersao !== undefined && conclusao === null)) return <p role="alert">Versão da consulta inválida.</p>;
  const [resultado, preferencia] = await Promise.all([consultarCorrecoesConclusaoReposicao({
    reposicaoId,
    ...(antes ? { antesVersao: antes } : {}),
    ...(conclusao ? { conclusaoVersao: conclusao } : {}),
  }), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const dado = resultado.dado;
  const professorSomente = usuario.papeis.includes(Papel.PROFESSOR) && !usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
  const url = (opcoes: { conclusaoVersao?: number; antesVersao?: number } = {}) => {
    const parametros = new URLSearchParams();
    if (opcoes.conclusaoVersao) parametros.set("conclusaoVersao", String(opcoes.conclusaoVersao));
    if (opcoes.antesVersao) parametros.set("antesVersao", String(opcoes.antesVersao));
    const texto = parametros.toString();
    return texto ? `?${texto}` : `/academico/reposicoes/correcoes/${encodeURIComponent(reposicaoId)}`;
  };
  return <section className="space-y-5">
    <Link className="underline" href={professorSomente ? "/diario/reposicoes" : "/academico/reposicoes"}>Voltar às reposições</Link>
    <h1 className="text-2xl font-medium">Correções da conclusão de reposição</h1>
    <p>Uma proposta não altera a conclusão vigente. A alteração só produz efeito depois de aprovação independente e nova conferência no servidor.</p>
    <CorrecoesConclusaoReposicao key={`${dado.reposicao.id}:${dado.conclusao.id}:${dado.versaoEsperada}`} dados={dado} mostrarPreparacao={!dado.consultaHistorica && !antesVersao} fusoExibicao={resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, dado.reposicao.origem.fuso)} />
    <nav className="flex flex-wrap gap-4" aria-label="Navegação entre conclusões">
      {dado.conclusaoSeguinteVersao && <Link className="underline" href={url({ conclusaoVersao: dado.conclusaoSeguinteVersao })}>Conclusão seguinte</Link>}
      {dado.conclusaoAnteriorVersao && <Link className="underline" href={url({ conclusaoVersao: dado.conclusaoAnteriorVersao })}>Conclusão anterior</Link>}
      {dado.consultaHistorica && <Link className="underline" href={url()}>Voltar à conclusão atual (versão {dado.ultimaConclusaoVersao})</Link>}
    </nav>
    {dado.proximaAntesVersao && <Link className="inline-block underline" href={url({ conclusaoVersao: conclusao ?? undefined, antesVersao: dado.proximaAntesVersao })}>Correções anteriores</Link>}
    {antesVersao && <Link className="block underline" href={url({ conclusaoVersao: conclusao ?? undefined })}>Voltar às correções recentes</Link>}
  </section>;
}
