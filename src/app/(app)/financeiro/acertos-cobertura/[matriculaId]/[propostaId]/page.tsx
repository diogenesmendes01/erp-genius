import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarImpactosCoberturaAditivo, consultarPreparoCoberturaAditivo } from "@/server/contratos/aditivo-cobertura-consulta";
import { ImpactosCoberturaFormulario } from "../../ImpactosCoberturaFormulario";
import { ImpactosCoberturaOperacao } from "../../ImpactosCoberturaOperacao";
import { VoltarPara } from "@/components/VoltarPara";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";

export default async function AcertoCoberturaDetalhe({ params }: { params: Promise<{ matriculaId: string; propostaId: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const d = await params, [preparo, impactos, cabecalho] = await Promise.all([consultarPreparoCoberturaAditivo(d), consultarImpactosCoberturaAditivo(d), consultarCabecalhoMatricula(usuario, d.matriculaId)]);
  const conjuntoAtivo = impactos.ok && impactos.dado && ["PENDENTE", "APROVADO", "COMPLETO"].includes(impactos.dado.status);
  const podePreparar = impactos.ok && (!impactos.dado || ["REJEITADO", "OBSOLETO"].includes(impactos.dado.status));
  return <main className="space-y-5"><VoltarPara href="/financeiro/acertos-cobertura" /><h1 className="text-2xl">Correção de cobertura</h1>
    {/* De quem é a correção: aluno e matrícula pelo código, não o id da URL (docs/43 §6 item 7). */}
    {cabecalho && <IdentificacaoRegistro rotulo="Aluno e matrícula desta correção" dados={{ aluno: cabecalho.aluno, alunoHref: `/alunos/${encodeURIComponent(cabecalho.alunoId)}`, matriculaCodigo: cabecalho.codigo, matriculaComplemento: cabecalho.produto }} />}
    {!impactos.ok ? <p role="alert">Não foi possível consultar o conjunto de cobertura: {impactos.erro}</p> : !preparo.ok ? <p role="alert">{preparo.erro}</p> : preparo.dado?.estado === "PRONTA" && podePreparar ? <ImpactosCoberturaFormulario matriculaId={d.matriculaId} propostaId={d.propostaId} conclusaoId={preparo.dado.conclusaoId} revisaoHash={preparo.dado.revisaoHash} politica={preparo.dado.politica} cobrancas={preparo.dado.cobrancas} /> : conjuntoAtivo ? <p role="status">Há um conjunto de cobertura ativo. Revise-o abaixo antes de preparar outro.</p> : <p role="status">{preparo.dado?.mensagem}</p>}
    {!impactos.ok ? null : <ImpactosCoberturaOperacao conjunto={impactos.dado ?? null} reprepararHref={`/financeiro/acertos-cobertura/${encodeURIComponent(d.matriculaId)}/${encodeURIComponent(d.propostaId)}`} />}
  </main>;
}
