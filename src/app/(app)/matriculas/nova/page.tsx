import {
  obterLeadParaMatricula,
  listarProdutosParaMatricula,
  listarTurmasAbertas,
  listarPrecosAtivos,
} from "@/server/matricula/consultas";
import {
  podeCriarMatricula,
  podeCriarEAtivarMatricula,
} from "@/server/matricula/permissoes";
import { listarNiveis } from "@/server/turmas/consultas";
import { vagasTurma } from "@/server/alunos/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { MatriculaFormulario, type PrecoRef } from "./MatriculaFormulario";
import { exigirSessaoPagina } from "@/server/_shared";

export default async function NovaMatriculaPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  // Criar matrícula (doc 07 / acoes.criarMatricula): Vendedor e Gerente Comercial.
  // Vendedor recebe escopo: só pré-preenche a partir dos próprios leads.
  // Guard de página com papéis FRESCOS do banco (não do JWT) — ver _shared/sessao.
  const usuario = await exigirSessaoPagina();

  const { lead: leadId } = await searchParams;
  // Gating de papéis (issue #8 / #34): "Salvar matrícula" para quem pode CRIAR;
  // "Receber pagamento e ativar" (fluxo atômico) exige os papéis de CRIAR E
  // ATIVAR. Os botões só aparecem para quem passa nas checagens; o backend
  // continua exigindo os papéis (defesa em profundidade). Isto é só UX.
  const podeCriar = podeCriarMatricula(usuario.papeis);
  const podeCriarEAtivar = podeCriarEAtivarMatricula(usuario.papeis);
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
      podeCriar={podeCriar}
      podeCriarEAtivar={podeCriarEAtivar}
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
