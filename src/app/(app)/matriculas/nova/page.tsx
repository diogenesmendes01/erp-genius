import {
  obterLeadParaMatricula,
  listarProdutosParaMatricula,
  listarTurmasAbertas,
  listarPrecosAtivos,
} from "@/server/matricula/consultas";
import { podeCriarMatricula } from "@/server/matricula/permissoes";
import { listarNiveis } from "@/server/turmas/consultas";
import { vagasTurma } from "@/server/alunos/consultas";
import { listarPaisesOperacionais } from "@/server/paises/consultas";
import { MatriculaFormulario, type PrecoRef } from "./MatriculaFormulario";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";

export default async function NovaMatriculaPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  // Criar matrícula (doc 07 / acoes.criarMatricula): Vendedor e Gerente Comercial.
  // Vendedor recebe escopo: só pré-preenche a partir dos próprios leads.
  // Guard de página com papéis FRESCOS do banco (não do JWT) — ver _shared/sessao.
  const usuario = await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);

  const { lead: leadId } = await searchParams;
  // O aceite do contrato é registrado após a criação, no atendimento da secretaria.
  const podeCriar = podeCriarMatricula(usuario.papeis);
  const [leadRaw, produtos, turmas, precos, paises, niveis] = await Promise.all([
    leadId ? obterLeadParaMatricula(leadId, usuario) : Promise.resolve(null),
    listarProdutosParaMatricula(),
    listarTurmasAbertas(),
    listarPrecosAtivos(),
    listarPaisesOperacionais(),
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
    .filter((t) => vagasTurma(t.capacidade, (t._count.alocacoes + t._count.reservasMatricula)) > 0)
    .map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ${t.diasHorario ?? "a definir"} · ${vagasTurma(
        t.capacidade,
        (t._count.alocacoes + t._count.reservasMatricula),
      )} vagas`,
    }));

  return (
    <MatriculaFormulario
      podeCriar={podeCriar}
      lead={lead}
      paises={paises.map((p) => ({
        id: p.id,
        nome: p.nome,
        moedaLocal: p.moedaLocal,
        codigoISO: p.codigoISO,
        tiposDocumento: p.tiposDocumento.map((t) => ({ id: t.id, nome: t.nome })),
      }))}
      produtos={produtos.map((p) => ({ id: p.id, label: `${p.idioma.nome} · ${p.modalidade.nome}` }))}
      turmas={turmasComVaga}
      niveis={niveis.map((n) => ({ id: n.id, label: `${n.idioma.nome} ${n.codigo}` }))}
      precos={precos as PrecoRef[]}
    />
  );
}
