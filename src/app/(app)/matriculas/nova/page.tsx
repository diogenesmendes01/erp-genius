import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  obterLeadParaMatricula,
  listarProdutosParaMatricula,
  listarTurmasAbertas,
  listarPrecosAtivos,
} from "@/server/matricula/consultas";
import { listarNiveis } from "@/server/turmas/consultas";
import { vagasTurma } from "@/server/alunos/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { MatriculaFormulario, type PrecoRef } from "./MatriculaFormulario";
import type { UsuarioSessao } from "@/server/_shared";

export default async function NovaMatriculaPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario: UsuarioSessao = {
    id: session.user.id,
    nome: session.user.name ?? "Usuário",
    papeis: (session.user.papeis ?? []) as Papel[],
  };

  const { lead: leadId } = await searchParams;
  const [leadRaw, produtos, turmas, precos, paises, niveis] = await Promise.all([
    leadId ? obterLeadParaMatricula(leadId, usuario) : Promise.resolve(null),
    listarProdutosParaMatricula(),
    listarTurmasAbertas(),
    listarPrecosAtivos(),
    listarPaises(),
    listarNiveis(),
  ]);

  const lead = leadRaw
    ? {
        id: leadRaw.id,
        nome: leadRaw.nome,
        telefoneE164: leadRaw.telefoneE164,
        paisId: leadRaw.paisId,
      }
    : null;

  const turmasComVaga = turmas
    .filter((t) => vagasTurma(t.capacidade, t._count.alocacoes) > 0)
    .map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ${t.diasHorario ?? "a definir"} · ${vagasTurma(
        t.capacidade,
        t._count.alocacoes,
      )} vagas`,
    }));

  return (
    <MatriculaFormulario
      lead={lead}
      paises={paises.map((p) => ({ id: p.id, nome: p.nome, moedaLocal: p.moedaLocal }))}
      produtos={produtos.map((p) => ({ id: p.id, label: `${p.idioma.nome} · ${p.modalidade.nome}` }))}
      turmas={turmasComVaga}
      niveis={niveis.map((n) => ({ id: n.id, label: `${n.idioma.nome} ${n.codigo}` }))}
      precos={precos as PrecoRef[]}
    />
  );
}
