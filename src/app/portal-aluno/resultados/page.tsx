import Link from "next/link";
import { redirect } from "next/navigation";
import { consultarResultadosPortalAluno, type ResultadoPortalAluno } from "@/server/portal-aluno/resultados";
import { consultarFechamentosPortalAluno } from "@/server/portal-aluno/fechamentos";
import { consultarPreferenciaFusoPortalAluno } from "@/server/portal-aluno/preferencia-fuso";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { ErroAutenticacao } from "@/server/_shared";

export const dynamic = "force-dynamic";

const formatadorNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function precisaArredondamento(valor: string) {
  const fracao = valor.trim().replace(",", ".").split(".")[1];
  return !!fracao && (fracao.replace(/0+$/, "").length > 2 || /e/i.test(valor));
}

function numero(valor: string | null) {
  if (valor === null) return "Não informado";
  const convertido = Number(valor);
  if (!Number.isFinite(convertido)) return "Não informado";
  return `${formatadorNumero.format(convertido)}${precisaArredondamento(valor) ? " (aprox.)" : ""}`;
}

function razao(valor: { numerador: string; denominador: string } | null) {
  if (!valor) return "ainda indisponível";
  const denominador = Number(valor.denominador), numerador = Number(valor.numerador);
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador) || denominador === 0) return "ainda indisponível";
  const resultado = numerador / denominador;
  return `${formatadorNumero.format(resultado)}${Math.abs(resultado * 100 - Math.round(resultado * 100)) > 1e-9 ? " (aprox.)" : ""}`;
}

const habilidades: Record<string, string> = {
  FALA: "Comunicação oral",
  COMPREENSAO_ORAL: "Compreensão oral",
  LEITURA: "Leitura",
  ESCRITA: "Escrita",
};

const pendenciasHabilidade: Record<string, string> = {
  NOTA_AUSENTE: "Há uma nota ainda não registrada.",
  AGUARDANDO_OFICIALIZACAO: "Há uma nota aguardando oficialização.",
  RESULTADO_ORIGINAL_PENDENTE: "O resultado original ainda está pendente.",
  FONTE_APROVEITAMENTO_ALTERADA: "Uma nota aproveitada de vínculo anterior mudou na origem e está em nova conferência.",
};

const habilidade = (valor: string) => habilidades[valor] ?? "Habilidade em conferência";

type FechamentoPortalAluno = Awaited<ReturnType<typeof consultarFechamentosPortalAluno>>[number];

function dataLegivel(valor: string | null, fusoExibicao: string) {
  if (!valor) return null;
  return formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto;
}

function ResumoFechamento({ resumo, resultadoSuficiente }: { resumo: NonNullable<FechamentoPortalAluno["resumo"]>; resultadoSuficiente: boolean }) {
  return <section className="mt-4 space-y-3 border-t border-current/20 pt-4" aria-label="Resumo confirmado do fechamento">
    <h4 className="font-medium">Resumo confirmado</h4>
    <p>Resultado geral: {razao(resumo.geral)}. Mínimo de referência: {numero(resumo.minimoGeral)}.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {resumo.habilidades.map((item) => <article key={item.habilidade} className="rounded border border-current/20 bg-surface-muted p-3">
        <p className="font-medium">{habilidade(item.habilidade)}</p>
        <p>Resultado: {razao(item.resultado)}</p>
        <p>Mínimo de referência: {numero(item.minimo)}.</p>
        {item.atendeMinimo !== null && <p className="mt-1 text-xs">{item.atendeMinimo ? "Mínimo atendido." : "Abaixo do mínimo de referência."}</p>}
      </article>)}
    </div>
    <section className="rounded border border-current/20 bg-surface-muted p-3" aria-label="Frequência confirmada">
      <h5 className="font-medium">Frequência</h5>
      <p className="mt-1">Aulas consideradas: {resumo.frequencia.base}. Presenças: {resumo.frequencia.presencas} · regularizadas: {resumo.frequencia.regularizadas} · faltas: {resumo.frequencia.faltas} · impedimentos: {resumo.frequencia.impedimentos}.</p>
      <p className="mt-1">Percentual registrado: {razao(resumo.frequencia.percentual)}{resumo.frequencia.percentual ? "%" : ""}. Mínimo de referência: {numero(resumo.frequencia.minimoPercentual)}%.</p>
      {resumo.frequencia.atendeMinimo !== null && <p className="mt-1 text-xs">{resumo.frequencia.atendeMinimo ? "Frequência mínima atendida." : "Frequência abaixo do mínimo de referência."}</p>}
      {resultadoSuficiente && resumo.frequencia.atendeMinimo === false && <p role="status" className="mt-2 text-xs">O fechamento considera a autorização pedagógica aplicável; a frequência real permanece registrada.</p>}
    </section>
  </section>;
}

function FechamentoNivel({ fechamento, nivel, fusoExibicao }: { fechamento: FechamentoPortalAluno; nivel: string; fusoExibicao: string }) {
  const confirmadoEm = dataLegivel(fechamento.confirmadoEm, fusoExibicao);
  const informacoes = [
    fechamento.versao !== null ? `Versão do fechamento ${fechamento.versao}` : null,
    confirmadoEm ? `Última confirmação em ${confirmadoEm} (horário exibido em ${fusoExibicao})` : null,
  ].filter((item): item is string => !!item);
  const conteudo = fechamento.estado === "CONFIRMADO_SUFICIENTE"
    ? { titulo: "Fechamento confirmado: resultado suficiente", classe: "border-green-300 bg-green-50 text-green-950", texto: "Este fechamento confirma o resultado acadêmico deste nível. A continuidade do percurso é informada separadamente pela instituição." }
    : fechamento.estado === "CONFIRMADO_INSUFICIENTE"
      ? { titulo: "Fechamento confirmado: resultado insuficiente", classe: "border-amber-300 bg-amber-50 text-amber-950", texto: "Este fechamento confirma o resultado acadêmico deste nível. Consulte o acompanhamento e as pendências mostradas abaixo." }
      : fechamento.estado === "EM_REVISAO"
        ? { titulo: "Fechamento em revisão", classe: "border-amber-300 bg-amber-50 text-amber-950", texto: confirmadoEm ? "A confirmação anterior está sendo revista. O resultado atualizado será mostrado depois da conferência." : "A conferência deste nível está em andamento. Ainda não há resultado confirmado." }
        : { titulo: "Fechamento ainda não confirmado", classe: "border-gray-300 bg-gray-50 text-gray-800", texto: "O acompanhamento deste nível segue disponível. Ainda não há um resultado acadêmico confirmado." };
  return <article className={`rounded border p-4 text-sm ${conteudo.classe}`}>
    <p className="font-medium">{nivel}</p>
    <h3 className="mt-1 font-medium">{conteudo.titulo}</h3>
    <p className="mt-1">{conteudo.texto}</p>
    {informacoes.length > 0 && <p className="mt-2 text-xs">{informacoes.join(" · ")}</p>}
    {(fechamento.estado === "CONFIRMADO_SUFICIENTE" || fechamento.estado === "CONFIRMADO_INSUFICIENTE") && fechamento.resumo && <ResumoFechamento resumo={fechamento.resumo} resultadoSuficiente={fechamento.estado === "CONFIRMADO_SUFICIENTE"} />}
  </article>;
}

const rotulosPendencia: Record<keyof ResultadoPortalAluno["matriculas"][number]["alocacoes"][number]["pendencias"], string> = {
  frequenciaHistorica: "Registros históricos de frequência a conferir",
  correcoesRegulares: "Correções de avaliação aguardando decisão",
  correcoesRecuperacao: "Correções de recuperação aguardando decisão",
  planosAguardandoDecisao: "Planos de recuperação aguardando decisão",
  planosSemDisponibilizacao: "Planos de recuperação sem disponibilização",
  tentativasAguardandoRealizacao: "Tentativas de recuperação aguardando realização",
  habilidadesSemTentativa: "Habilidades com tentativa de recuperação pendente",
  oportunidadesExtrasAguardandoDecisao: "Oportunidades extras aguardando decisão",
};

export default async function ResultadosPortalAlunoPage() {
  // A projeção acadêmica confirma a sessão e o escopo das matrículas antes de
  // ler a preferência da conta. A preferência muda somente a apresentação.
  // O guard vive dentro de consultarResultadosPortalAluno (compartilhado com outras
  // chamadas) e continua lançando ErroAutenticacao — aqui, numa página, convertemos
  // isso em redirect em vez de deixar estourar como erro 500 (ver
  // docs/42-auditoria-frontend-ux.md, achado N1). Qualquer outro erro sobe normalmente
  // para o error.tsx do portal.
  let resultado: ResultadoPortalAluno;
  try {
    resultado = await consultarResultadosPortalAluno();
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) redirect("/portal-aluno/entrar");
    throw erro;
  }
  const [fechamentos, preferencia] = await Promise.all([
    consultarFechamentosPortalAluno(),
    consultarPreferenciaFusoPortalAluno(),
  ]);
  const fusoExibicao = resolverFusoExibicao(preferencia.fusoExibicao, "UTC");
  return <section className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
    <Link href="/portal-aluno" className="text-sm text-brand-700 underline">Voltar à área do aluno</Link>
    <header><p className="text-sm text-brand-700">Frente acadêmica</p><h1 className="mt-1 text-2xl font-medium">Avaliações, habilidades e frequência</h1><p className="mt-2 text-sm text-gray-600">Mostramos avaliações já oficializadas, o acompanhamento do seu vínculo e, quando houver, a confirmação de fechamento acadêmico.</p></header>
    <p className="text-sm text-gray-600">Valores marcados como “aprox.” foram arredondados somente para esta visualização.</p>
    {!resultado.matriculas.length && <p className="rounded border bg-surface p-4 text-sm text-gray-700">Não há vínculo acadêmico com resultados disponíveis neste acesso.</p>}
    {resultado.matriculas.map((matricula, indiceMatricula) => <section key={matricula.matriculaId} className="space-y-4 rounded-lg border bg-surface p-5" aria-label={`Vínculo acadêmico ${indiceMatricula + 1}`}>
      <h2 className="text-xl font-medium">{matricula.codigo ? `Matrícula ${matricula.codigo}` : `Vínculo acadêmico ${indiceMatricula + 1}`}</h2>
      {(() => {
        const niveis = new Map(matricula.alocacoes.map((alocacao) => [alocacao.nivelId, `${alocacao.idioma} · nível ${alocacao.nivel}`]));
        const destaMatricula = fechamentos.filter((fechamento) => fechamento.matriculaId === matricula.matriculaId);
        return destaMatricula.length > 0 && <section className="space-y-3" aria-label="Fechamento acadêmico por nível">
          <h3 className="font-medium">Fechamento acadêmico</h3>
          {destaMatricula.map((fechamento) => <FechamentoNivel key={`${fechamento.matriculaId}-${fechamento.nivelId}`} fechamento={fechamento} nivel={niveis.get(fechamento.nivelId) ?? "Nível acadêmico"} fusoExibicao={fusoExibicao} />)}
        </section>;
      })()}
      {!matricula.alocacoes.length && <p className="text-sm text-gray-600">Não há alocação acadêmica disponível neste vínculo.</p>}
      {matricula.alocacoes.map((alocacao) => <article key={alocacao.alocacaoId} className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
        <header><h3 className="font-medium">Acompanhamento: {alocacao.idioma} · nível {alocacao.nivel}{alocacao.turma ? ` · turma ${alocacao.turma}` : ""}{alocacao.regraVersao !== null ? ` · regra de avaliação versão ${alocacao.regraVersao}` : ""}</h3>
          {alocacao.situacao === "PENDENTE_REGRA" && <p role="status" className="mt-1 text-sm text-amber-800">A regra de avaliação deste vínculo ainda não está disponível para consolidar notas e frequência.</p>}
        </header>
        {alocacao.avaliacoes.length > 0 && <section className="space-y-3" aria-label="Avaliações oficializadas"><h4 className="font-medium">Avaliações oficializadas</h4>{alocacao.avaliacoes.map((avaliacao) => <article key={avaliacao.codigo} className="rounded border p-3 text-sm"><p className="font-medium">{avaliacao.titulo} · {avaliacao.etapa === "FINAL" ? "etapa final" : "etapa intermediária"}</p><dl className="mt-2 grid gap-2">{avaliacao.notas.map((nota) => <div key={nota.habilidade}><dt className="text-gray-600">{habilidade(nota.habilidade)}</dt><dd>Nota: {numero(nota.nota)}</dd>{nota.comentarioAluno && <dd className="mt-1 whitespace-pre-wrap text-gray-700">Comentário: {nota.comentarioAluno}</dd>}</div>)}</dl></article>)}</section>}
        {alocacao.recuperacoes.length > 0 && <section className="space-y-3" aria-label="Recuperações oficializadas"><h4 className="font-medium">Recuperações oficializadas</h4>{alocacao.recuperacoes.map((recuperacao, indice) => <article key={`${recuperacao.habilidade}-${indice}`} className="rounded border p-3 text-sm"><p className="font-medium">{habilidade(recuperacao.habilidade)}</p><p>Nota: {numero(recuperacao.nota)}</p>{recuperacao.comentarioAluno && <p className="mt-1 whitespace-pre-wrap text-gray-700">Comentário: {recuperacao.comentarioAluno}</p>}</article>)}</section>}
        {alocacao.consolidado && <section className="space-y-3" aria-label="Acompanhamento atual das habilidades"><h4 className="font-medium">Acompanhamento atual das habilidades</h4><p className="text-sm text-gray-700">Referência geral atual: {razao(alocacao.consolidado.geral)}. Mínimo de referência: {numero(alocacao.consolidado.minimoGeral)}.</p><div className="grid gap-2 sm:grid-cols-2">{alocacao.consolidado.habilidades.map((resultadoHabilidade) => <article key={resultadoHabilidade.habilidade} className="rounded border p-3 text-sm"><p className="font-medium">{habilidade(resultadoHabilidade.habilidade)}</p><p>Referência parcial: {razao(resultadoHabilidade.resultado)}</p><p>Mínimo de referência: {numero(resultadoHabilidade.minimo)}</p>{resultadoHabilidade.pendencias.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-800">{resultadoHabilidade.pendencias.map((pendencia) => <li key={pendencia}>{pendenciasHabilidade[pendencia] ?? "Há uma pendência de resultado em conferência."}</li>)}</ul>}</article>)}</div></section>}
        {alocacao.frequencia && <section className="space-y-2" aria-label="Frequência consolidada"><h4 className="font-medium">Frequência consolidada</h4><p className="text-sm">Aulas consideradas: {alocacao.frequencia.base}. Presenças: {alocacao.frequencia.presencas} · regularizadas: {alocacao.frequencia.regularizadas} · faltas: {alocacao.frequencia.faltas} · impedimentos: {alocacao.frequencia.impedimentos}.</p><p className="text-sm">Percentual de referência: {razao(alocacao.frequencia.percentual)}{alocacao.frequencia.percentual ? "%" : ""}. Mínimo de referência: {numero(alocacao.frequencia.minimoPercentual)}%.</p>{alocacao.frequencia.pendencias > 0 && <p className="text-sm text-amber-800">Há {alocacao.frequencia.pendencias} pendência(s) de frequência em conferência.</p>}</section>}
        <Pendencias pendencias={alocacao.pendencias} />
      </article>)}
    </section>)}
  </section>;
}

function Pendencias({ pendencias }: { pendencias: ResultadoPortalAluno["matriculas"][number]["alocacoes"][number]["pendencias"] }) {
  const itens = (Object.entries(pendencias) as Array<[keyof typeof pendencias, number]>).filter(([, quantidade]) => quantidade > 0);
  if (!itens.length) return <p role="status" className="text-sm text-gray-600">Não há pendências operacionais identificadas nesta consulta.</p>;
  return <section aria-label="Pendências acadêmicas"><h4 className="font-medium">Pendências</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{itens.map(([tipo, quantidade]) => <li key={tipo}>{rotulosPendencia[tipo]}: {quantidade}.</li>)}</ul></section>;
}
