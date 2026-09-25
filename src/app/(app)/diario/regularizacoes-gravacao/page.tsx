import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRegularizacoesFonteGravacao } from "@/server/gravacoes/regularizacao-fonte";
import { RegularizacoesGravacao } from "./RegularizacoesGravacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function RegularizacoesGravacaoPage({ searchParams }: { searchParams: Promise<{ cursor?: string; busca?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const busca = await searchParams;
  const [dados, preferencia] = await Promise.all([consultarRegularizacoesFonteGravacao(busca.cursor || busca.busca ? { cursor: busca.cursor, busca: busca.busca } : {}), consultarPreferenciaFusoEquipe()]);
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const fontes = [
    ...dados.publicacoes.map((p) => { const exibicao = formatarInstanteExibicao(p.encontro.inicio, preferencia.ok ? preferencia.dado?.fusoExibicao : null, p.encontro.fusoOrigem); return { id: `PUBLICACAO_AULA:${p.id}`, rotulo: `Aula ${p.encontro.turma?.codigo ?? p.encontro.turma?.nome ?? p.encontroId} — ${exibicao.texto} (${exibicao.fuso}; origem ${p.encontro.fusoOrigem})`, versao: p.fontesRevisao[0]?.versao ?? null }; }),
    ...dados.materiais.map((m) => ({ id: `MATERIAL_REPOSICAO:${m.id}`, rotulo: `Reposição ${m.reposicao.matricula.codigo ?? m.reposicaoId} — ${[m.reposicao.matricula.aluno.primeiroNome, m.reposicao.matricula.aluno.sobrenome].filter(Boolean).join(" ")}`, versao: m.fontesRevisao[0]?.versao ?? null })),
  ];
  const propostas = dados.propostas.map((p) => { const exibicao = p.publicacaoAula && formatarInstanteExibicao(p.publicacaoAula.encontro.inicio, preferencia.ok ? preferencia.dado?.fusoExibicao : null, p.publicacaoAula.encontro.fusoOrigem); return { ...p, destino: p.publicacaoAula && exibicao ? `Aula ${p.publicacaoAula.encontro.turma?.codigo ?? p.publicacaoAula.encontro.turma?.nome ?? p.publicacaoAulaId} — ${exibicao.texto} (${exibicao.fuso}; origem ${p.publicacaoAula.encontro.fusoOrigem})` : `Reposição ${p.materialReposicao?.reposicao.matricula.codigo ?? p.materialReposicaoId} — ${[p.materialReposicao?.reposicao.matricula.aluno.primeiroNome, p.materialReposicao?.reposicao.matricula.aluno.sobrenome].filter(Boolean).join(" ")}` }; });
  return <section className="mx-auto max-w-3xl space-y-5 p-6"><VoltarPara href="/diario" para="Diário" /><h1 className="text-2xl font-medium">Regularizações de gravação</h1><form className="flex gap-2"><input name="busca" defaultValue={busca.busca} aria-label="Buscar regularizações por ID do arquivo ou matrícula" placeholder="Buscar ID do arquivo ou matrícula" className="rounded border p-2" /><button className="rounded border px-3">Buscar</button></form><RegularizacoesGravacao fontes={fontes} propostas={propostas} fusoExibicao={fusoExibicao} />{dados.proximoCursor && <Link href={`/diario/regularizacoes-gravacao?cursor=${encodeURIComponent(dados.proximoCursor)}${busca.busca ? `&busca=${encodeURIComponent(busca.busca)}` : ""}`} className="text-sm text-brand-700 underline">Próximas fontes</Link>}</section>;
}
