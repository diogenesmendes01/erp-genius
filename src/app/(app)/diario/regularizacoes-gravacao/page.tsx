import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRegularizacoesFonteGravacao } from "@/server/gravacoes/regularizacao-fonte";
import { RegularizacoesGravacao } from "./RegularizacoesGravacao";

export default async function RegularizacoesGravacaoPage({ searchParams }: { searchParams: Promise<{ cursor?: string; busca?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const busca = await searchParams;
  const dados = await consultarRegularizacoesFonteGravacao(busca.cursor || busca.busca ? { cursor: busca.cursor, busca: busca.busca } : {});
  const fontes = [
    ...dados.publicacoes.map((p) => ({ id: `PUBLICACAO_AULA:${p.id}`, rotulo: `Aula ${p.encontro.turma?.codigo ?? p.encontro.turma?.nome ?? p.encontroId} — ${new Date(p.encontro.inicio).toLocaleString("pt-BR")}`, versao: p.fontesRevisao[0]?.versao ?? null })),
    ...dados.materiais.map((m) => ({ id: `MATERIAL_REPOSICAO:${m.id}`, rotulo: `Reposição ${m.reposicao.matricula.codigo ?? m.reposicaoId} — ${[m.reposicao.matricula.aluno.primeiroNome, m.reposicao.matricula.aluno.sobrenome].filter(Boolean).join(" ")}`, versao: m.fontesRevisao[0]?.versao ?? null })),
  ];
  const propostas = dados.propostas.map((p) => ({ ...p, destino: p.publicacaoAula ? `Aula ${p.publicacaoAula.encontro.turma?.codigo ?? p.publicacaoAula.encontro.turma?.nome ?? p.publicacaoAulaId} — ${new Date(p.publicacaoAula.encontro.inicio).toLocaleString("pt-BR")}` : `Reposição ${p.materialReposicao?.reposicao.matricula.codigo ?? p.materialReposicaoId} — ${[p.materialReposicao?.reposicao.matricula.aluno.primeiroNome, p.materialReposicao?.reposicao.matricula.aluno.sobrenome].filter(Boolean).join(" ")}` }));
  return <section className="mx-auto max-w-3xl space-y-5 p-6"><Link href="/diario" className="text-sm text-brand-700 underline">Voltar ao diário</Link><h1 className="text-2xl font-medium">Regularizações de gravação</h1><form className="flex gap-2"><input name="busca" defaultValue={busca.busca} placeholder="Buscar ID do arquivo ou matrícula" className="rounded border p-2" /><button className="rounded border px-3">Buscar</button></form><RegularizacoesGravacao fontes={fontes} propostas={propostas} />{dados.proximoCursor && <Link href={`/diario/regularizacoes-gravacao?cursor=${encodeURIComponent(dados.proximoCursor)}${busca.busca ? `&busca=${encodeURIComponent(busca.busca)}` : ""}`} className="text-sm text-brand-700 underline">Próximas fontes</Link>}</section>;
}
