import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRegularizacoesFonteGravacao } from "@/server/gravacoes/regularizacao-fonte";
import { RegularizacoesGravacao } from "./RegularizacoesGravacao";

export default async function RegularizacoesGravacaoPage() {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const dados = await consultarRegularizacoesFonteGravacao();
  const fontes = [
    ...dados.publicacoes.map((p) => ({ id: `PUBLICACAO_AULA:${p.id}`, rotulo: `Publicação da aula ${p.encontroId}`, versao: p.fontesRevisao[0]?.versao ?? null })),
    ...dados.materiais.map((m) => ({ id: `MATERIAL_REPOSICAO:${m.id}`, rotulo: `Material da reposição ${m.reposicaoId}`, versao: m.fontesRevisao[0]?.versao ?? null })),
  ];
  return <section className="mx-auto max-w-3xl space-y-5 p-6"><Link href="/diario" className="text-sm text-brand-700 underline">Voltar ao diário</Link><h1 className="text-2xl font-medium">Regularizações de gravação</h1><RegularizacoesGravacao fontes={fontes} propostas={dados.propostas} /></section>;
}