import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { revisarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { ConfirmarFechamento } from "./ConfirmarFechamento";
import { ExcecaoFrequencia } from "./ExcecaoFrequencia";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

const pendencias: Record<string, string> = {
  NOTAS_INCOMPLETAS: "Notas obrigatórias ainda não estão completas e oficializadas",
  RECUPERACAO_PENDENTE: "Há recuperação pendente",
  FREQUENCIA_NAO_APURADA: "A frequência ainda não foi apurada",
  FREQUENCIA_HISTORICA_PENDENTE: "Há registros históricos de frequência a conferir",
  CHAMADA_PENDENTE: "Há chamadas pendentes",
  EQUIVALENCIA_PENDENTE: "Há aproveitamento de transferência pendente",
  CORRECAO_PENDENTE: "Há correções aguardando decisão",
  PLANO_PENDENTE: "Há plano de recuperação pendente",
  TENTATIVA_PENDENTE: "Há tentativa de recuperação pendente",
  OPORTUNIDADE_EXTRA_PENDENTE: "Há oportunidade extra pendente",
  SEGUNDA_CHAMADA_PENDENTE: "Há segunda chamada pendente",
  EXTRA_SEGUNDA_CHAMADA_PENDENTE: "Há oportunidade extra de segunda chamada pendente",
  EXCECAO_FREQUENCIA_PENDENTE: "Há exceção de frequência aguardando decisão",
};
const insuficiencias: Record<string, string> = {
  MINIMO_POR_HABILIDADE: "Há habilidade abaixo do mínimo",
  MINIMO_GERAL: "A média geral está abaixo do mínimo",
  FREQUENCIA_MINIMA: "A frequência está abaixo do mínimo",
};
const nomesHabilidade: Record<string, string> = {
  FALA: "Fala",
  COMPREENSAO_ORAL: "Compreensão oral",
  LEITURA: "Leitura",
  ESCRITA: "Escrita",
};
function razao(valor: { numerador: string; denominador: string } | null) {
  if (!valor) return "Pendente";
  const numerador = BigInt(valor.numerador), denominador = BigInt(valor.denominador);
  if (!denominador) return "Pendente";
  const sinal = numerador < 0n ? "−" : "";
  const absoluto = numerador < 0n ? -numerador : numerador;
  const centesimos = (absoluto * 200n + denominador) / (denominador * 2n);
  return `${sinal}${centesimos / 100n},${String(centesimos % 100n).padStart(2, "0")}`;
}

export default async function FechamentoAcademicoPage({ params }: { params: Promise<{ alocacaoId: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId } = await params;
  const [revisao, preferencia] = await Promise.all([
    revisarFechamentoAcademico({ alocacaoId }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!revisao.ok || !revisao.dado) return <section className="space-y-3"><Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Voltar às avaliações</Link><p role="alert">{revisao.ok ? "A revisão não está disponível." : revisao.erro}</p></section>;

  const estado = revisao.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const resultado = estado.snapshot.consolidado.resultado;
  const frequencia = estado.snapshot.frequencia;
  const elegibilidade = estado.elegibilidade;
  const ultimo = estado.ultimo;
  return <section className="mx-auto max-w-4xl space-y-5">
    <header className="space-y-2">
      <Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Voltar às avaliações</Link>
      <h1 className="text-2xl font-medium">Fechamento acadêmico do nível</h1>
      <p className="text-sm text-gray-700">Esta revisão consolida o vínculo mais recente da matrícula neste nível. Confirmar cria uma nova versão histórica; não aprova nem executa progressão.</p>
    </header>

    {ultimo && <section className={`rounded border p-4 ${ultimo.atual ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
      <h2 className="font-medium">Último fechamento</h2>
      <p className="text-sm">Versão {ultimo.versao}, confirmada em {formatarInstanteExibicao(ultimo.confirmadoEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC): {ultimo.resultadoSuficiente ? "suficiente" : "insuficiente"}.</p>
      <p className="mt-1 text-sm">{ultimo.atual ? "A base acadêmica ainda corresponde à revisão atual." : "A base acadêmica mudou desde esse fechamento; ele permanece no histórico e esta revisão precisa ser confirmada novamente."}</p>
    </section>}

    <section className="rounded border p-4">
      <h2 className="text-lg font-medium">Resultado e frequência revisados</h2>
      <p className="mt-2">Resultado geral: {razao(resultado.geral)}. Mínimo geral: {resultado.minimoGeral}.</p>
      <p className="text-sm">Notas: {resultado.atendeRequisitosNotas === null ? "incompletas" : resultado.atendeRequisitosNotas ? "atingem os mínimos" : "não atingem todos os mínimos"}.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Mínimos e resultados por habilidade</caption><thead><tr><th>Habilidade</th><th>Resultado</th><th>Mínimo</th><th>Situação</th></tr></thead><tbody>{resultado.habilidades.map((habilidade) => <tr key={habilidade.habilidade}><th scope="row">{nomesHabilidade[habilidade.habilidade] ?? habilidade.habilidade}</th><td>{razao(habilidade.resultado)}</td><td>{habilidade.minimo}</td><td>{habilidade.atendeMinimo === null ? "Pendente" : habilidade.atendeMinimo ? "Mínimo atingido" : "Abaixo do mínimo"}</td></tr>)}</tbody></table></div>
      <p className="mt-3">Frequência real: {frequencia.atendeMinimo === null ? "ainda não apurada" : frequencia.atendeMinimo ? "atinge o mínimo" : "abaixo do mínimo"}.</p>
      <p className="text-sm">Percentual: {razao(frequencia.percentual)}%. Mínimo: {frequencia.minimoPercentual}%.</p>
      <p className="text-sm">Base: {frequencia.base} aulas · presenças: {frequencia.presencas} · regularizações: {frequencia.regularizadas} · faltas: {frequencia.faltas} · impedimentos: {frequencia.impedimentos}.</p>
      <p className="text-sm">Pendências de frequência: {frequencia.pendencias.length + frequencia.pendenciasHistoricas.length}.</p>
    </section>

    <ExcecaoFrequencia alocacaoId={alocacaoId} usuarioId={usuario.id} frequencia={frequencia} proposta={estado.snapshot.excecaoFrequencia} />

    <section className="rounded border p-4">
      <h2 className="text-lg font-medium">Situação para fechamento</h2>
      <p className="mt-2 font-medium">{elegibilidade.situacao === "SUFICIENTE" ? "Resultado suficiente na revisão" : elegibilidade.situacao === "INSUFICIENTE" ? "Resultado insuficiente na revisão" : "Há pendências a resolver"}.</p>
      {elegibilidade.pendencias.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">{elegibilidade.pendencias.map((pendencia) => <li key={pendencia}>{pendencias[pendencia] ?? "Pendência acadêmica em conferência"}.</li>)}</ul>}
      {elegibilidade.insuficiencias.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{elegibilidade.insuficiencias.map((insuficiencia) => <li key={insuficiencia}>{insuficiencias[insuficiencia] ?? "Insuficiência acadêmica"}.</li>)}</ul>}
      {!elegibilidade.podeProgredir && elegibilidade.podeFechar && <p className="mt-2 text-sm">A versão pode ser confirmada como insuficiente, mas não libera progressão.</p>}
    </section>

    <ConfirmarFechamento key={estado.estadoHash} alocacaoId={alocacaoId} estadoHash={estado.estadoHash} versaoEsperada={estado.versaoAtual} podeFechar={elegibilidade.podeFechar} resultadoSuficiente={elegibilidade.podeProgredir} />
  </section>;
}
