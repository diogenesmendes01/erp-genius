import { Papel } from "@prisma/client";
import {
  obterLeadParaMatricula,
  listarProdutosParaMatricula,
  listarTurmasAbertas,
  listarPrecosAtivos,
} from "@/server/matricula/consultas";
import { listarNiveis } from "@/server/turmas/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { MatriculaFormulario, type PrecoRef } from "./MatriculaFormulario";

export default async function NovaMatriculaPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  // Criar matrícula (doc 07 / acoes.criarMatricula): Vendedor e Gerente Comercial.
  // Vendedor recebe escopo: só pré-preenche a partir dos próprios leads.
  const usuario = await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
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
    .filter((t) => t.capacidade - t._count.alocacoes > 0)
    .map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ${t.diasHorario ?? "a definir"} · ${
        t.capacidade - t._count.alocacoes
      } vagas`,
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
