import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  obterLeadParaMatricula,
  listarProdutosParaMatricula,
  listarTurmasAbertas,
  listarPrecosAtivos,
} from "@/server/matricula/consultas";
import { listarNiveis } from "@/server/turmas/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { MatriculaFormulario, type PrecoRef } from "./MatriculaFormulario";

export default async function NovaMatriculaPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead: leadId } = await searchParams;
  // "Receber pagamento e ativar" exige perfil Financeiro/Secretaria (ou Admin).
  // Mantemos a verificação real no servidor; isto é só UX (issue #8).
  const session = await auth();
  const papeis = (session?.user?.papeis ?? []) as Papel[];
  const podeAtivar =
    papeis.includes(Papel.ADMINISTRADOR) ||
    papeis.includes(Papel.FINANCEIRO) ||
    papeis.includes(Papel.SECRETARIA_ACADEMICA);
  const [leadRaw, produtos, turmas, precos, paises, niveis] = await Promise.all([
    leadId ? obterLeadParaMatricula(leadId) : Promise.resolve(null),
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
    .filter((t) => t.capacidade - t._count.alocacoes > 0)
    .map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ${t.diasHorario ?? "a definir"} · ${
        t.capacidade - t._count.alocacoes
      } vagas`,
    }));

  return (
    <MatriculaFormulario
      podeAtivar={podeAtivar}
      lead={lead}
      paises={paises.map((p) => ({ id: p.id, nome: p.nome, moedaLocal: p.moedaLocal }))}
      produtos={produtos.map((p) => ({ id: p.id, label: `${p.idioma.nome} · ${p.modalidade.nome}` }))}
      turmas={turmasComVaga}
      niveis={niveis.map((n) => ({ id: n.id, label: `${n.idioma.nome} ${n.codigo}` }))}
      precos={precos as PrecoRef[]}
    />
  );
}
