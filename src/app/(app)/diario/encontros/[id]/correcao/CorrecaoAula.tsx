"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { aprovarCorrecaoAula, consultarHistoricoCorrecaoAula, proporCorrecaoAula, rejeitarCorrecaoAula, revisarImpactosCorrecaoAula } from "@/server/diario/correcao-aula";
import { CorrecaoFonteGravacao } from "./CorrecaoFonteGravacao";

type RespostaHistorico = Awaited<ReturnType<typeof consultarHistoricoCorrecaoAula>>;
type DadosRevisao = NonNullable<Extract<RespostaHistorico, { ok: true }> ["dado"]>;
type RespostaImpactos = Awaited<ReturnType<typeof revisarImpactosCorrecaoAula>>;
type DadosImpactos = NonNullable<Extract<RespostaImpactos, { ok: true }> ["dado"]>;
type Participacao = DadosRevisao["snapshot"]["registros"][number]["participacao"];

const rotuloParticipacao: Record<Participacao, string> = {
  PRESENTE: "Presente",
  FALTA: "Falta",
  IMPEDIDO_POR_RESTRICAO: "Impedido por restrição",
};

const rotulosPendencia: Record<string, string> = {
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

const rotulosInsuficiencia: Record<string, string> = {
  MINIMO_POR_HABILIDADE: "Há habilidade abaixo do mínimo",
  MINIMO_GERAL: "A média geral está abaixo do mínimo",
  FREQUENCIA_MINIMA: "A frequência está abaixo do mínimo",
};

type EdicaoRegistro = { registroId: string; participacao: Participacao; observacao: string };
type PropostaHistorica = DadosRevisao["propostas"][number];

type AvaliacaoReposicoes = {
  afetadas: string[];
  todasAutorizadas: boolean;
  temConcluidasPreservaveis: boolean;
  temContinuaveis: boolean;
};

function avaliarReposicoes(impactos: DadosImpactos): AvaliacaoReposicoes {
  const afetadas = [...new Set(impactos.comparacao.registros.flatMap((registro) => registro.reposicoesParaConferencia.map((reposicao) => reposicao.id)))];
  const preservaveis = new Set(impactos.reposicoesPreservaveisIds);
  const continuaveis = new Set(impactos.reposicoesContinuaveisIds);
  const autorizadas = new Set([...preservaveis, ...continuaveis]);
  return {
    afetadas,
    todasAutorizadas: afetadas.length > 0 && afetadas.every((reposicaoId) => autorizadas.has(reposicaoId)),
    temConcluidasPreservaveis: afetadas.some((reposicaoId) => preservaveis.has(reposicaoId)),
    temContinuaveis: afetadas.some((reposicaoId) => continuaveis.has(reposicaoId)),
  };
}

function textoPreservacaoReposicoes(avaliacao: AvaliacaoReposicoes) {
  if (avaliacao.temConcluidasPreservaveis && avaliacao.temContinuaveis) {
    return "Confirmo a preservação das reposições concluídas e de seus registros, sem duplicar a frequência, e a continuidade do atendimento autorizado das reposições ainda sem conclusão, com agenda, prazo e benefício preservados.";
  }
  if (avaliacao.temContinuaveis) {
    return "Confirmo a continuidade do atendimento autorizado das reposições ainda sem conclusão, com agenda, prazo e benefício preservados.";
  }
  return "Confirmo a preservação das reposições concluídas e de seus registros, sem duplicar a frequência.";
}

function iniciarRegistros(dados: DadosRevisao): EdicaoRegistro[] {
  return dados.snapshot.registros.map((registro) => ({
    registroId: registro.registroId,
    participacao: registro.participacao,
    observacao: registro.observacao ?? "",
  }));
}

function ResumoFrequencia({ titulo, valor }: { titulo: string; valor: { base: number; presencas: number; faltas: number; regularizadas: number; atendeMinimo: boolean | null } | null }) {
  if (!valor) return <p className="text-sm text-gray-600">{titulo}: indisponível para simulação.</p>;
  return <p className="text-sm text-gray-700">{titulo}: {valor.presencas} presença(s), {valor.faltas} falta(s), {valor.regularizadas} regularizada(s), em {valor.base} registro(s). {valor.atendeMinimo === null ? "O mínimo ainda depende de conferência." : valor.atendeMinimo ? "A simulação atende ao mínimo configurado." : "A simulação não atende ao mínimo configurado."}</p>;
}

type Elegibilidade = NonNullable<NonNullable<DadosImpactos["simulacoes"][number]["fechamento"]>["depois"]>["elegibilidade"];

function ElegibilidadeSimulada({ elegibilidade }: { elegibilidade: Elegibilidade }) {
  return <section className="mt-3 rounded border border-gray-200 p-3 text-sm">
    <h5 className="font-medium">Situação acadêmica simulada</h5>
    <p className="mt-1">{elegibilidade.podeFechar ? "A simulação não encontrou pendências que impeçam o fechamento." : "A simulação ainda tem pendências antes de um possível fechamento."}</p>
    <p>{elegibilidade.podeProgredir ? "A simulação reúne os requisitos acadêmicos para progressão." : "A simulação não reúne todos os requisitos acadêmicos para progressão."}</p>
    {elegibilidade.pendencias.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">{elegibilidade.pendencias.map((pendencia) => <li key={pendencia}>{rotulosPendencia[pendencia] ?? "Há uma pendência acadêmica a conferir"}.</li>)}</ul>}
    {elegibilidade.insuficiencias.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{elegibilidade.insuficiencias.map((insuficiencia) => <li key={insuficiencia}>{rotulosInsuficiencia[insuficiencia] ?? "Há um requisito acadêmico ainda não atingido"}.</li>)}</ul>}
    <p className="mt-2 text-gray-600">A simulação não confirma fechamento, publicação da correção ou progressão.</p>
  </section>;
}

function ResumoPropostaHistorica({ proposta }: { proposta: PropostaHistorica }) {
  const novosPorRegistro = new Map(proposta.snapshotNovo.registros.map((registro) => [registro.registroId, registro]));
  const mudancas = proposta.snapshotAnterior.registros.flatMap((anterior) => {
    const novo = novosPorRegistro.get(anterior.registroId);
    if (!novo || (anterior.participacao === novo.participacao && anterior.observacao === novo.observacao)) return [];
    return [{ nome: anterior.nomeAluno, antes: anterior, depois: novo }];
  });
  return <details className="rounded border p-2 text-sm">
    <summary className="cursor-pointer font-medium">Alterações registradas nesta proposta</summary>
    <div className="mt-2 space-y-2">
      {proposta.snapshotAnterior.conteudo !== proposta.snapshotNovo.conteudo && <div><p className="font-medium">Conteúdo ministrado</p><p className="whitespace-pre-wrap text-gray-600">Antes: {proposta.snapshotAnterior.conteudo}</p><p className="whitespace-pre-wrap">Proposto: {proposta.snapshotNovo.conteudo}</p></div>}
      {mudancas.map((mudanca) => <div key={mudanca.antes.registroId}><p className="font-medium">{mudanca.nome}</p>{mudanca.antes.participacao !== mudanca.depois.participacao && <p>Participação: {rotuloParticipacao[mudanca.antes.participacao]} → {rotuloParticipacao[mudanca.depois.participacao]}.</p>}{mudanca.antes.observacao !== mudanca.depois.observacao && <><p className="text-gray-600">Observação anterior: {mudanca.antes.observacao || "Sem observação."}</p><p>Observação proposta: {mudanca.depois.observacao || "Sem observação."}</p></>}</div>)}
      {!mudancas.length && proposta.snapshotAnterior.conteudo === proposta.snapshotNovo.conteudo && <p>Esta proposta não registrou diferenças legíveis.</p>}
    </div>
  </details>;
}

function Impactos({ dados }: { dados: DadosImpactos }) {
  const nomes = new Map(dados.comparacao.registros.map((registro) => [registro.matriculaId, registro.nomeAluno]));
  return <section className="space-y-4 rounded border border-amber-200 bg-amber-50 p-4" aria-live="polite">
    <header className="space-y-1">
      <h2 className="text-lg font-medium">Conferência de impactos</h2>
      <p className="text-sm text-gray-700">Esta é uma conferência da proposta registrada. Ela não publica a correção nem altera os registros atuais.</p>
    </header>

    <section className="space-y-2">
      <h3 className="font-medium">Antes e depois da chamada</h3>
      {dados.comparacao.conteudo.alterado && <div className="rounded border bg-white p-3 text-sm"><p className="font-medium">Conteúdo ministrado</p><p className="mt-1 whitespace-pre-wrap text-gray-700">Antes: {dados.comparacao.conteudo.antes}</p><p className="mt-1 whitespace-pre-wrap text-gray-700">Proposto: {dados.comparacao.conteudo.depois}</p></div>}
      {dados.comparacao.registros.filter((registro) => registro.participacaoAlterada || registro.observacaoAlterada).map((registro) => <article key={registro.registroId} className="rounded border bg-white p-3 text-sm">
        <h4 className="font-medium">{registro.nomeAluno}</h4>
        {registro.participacaoAlterada && <p>Participação: {rotuloParticipacao[registro.antes.participacao]} → {rotuloParticipacao[registro.depois.participacao]}.</p>}
        {registro.observacaoAlterada && <><p className="mt-2 text-gray-600">Observação anterior: {registro.antes.observacao || "Sem observação."}</p><p className="text-gray-700">Observação proposta: {registro.depois.observacao || "Sem observação."}</p></>}
        {registro.reposicoesParaConferencia.length > 0 && <p className="mt-2 text-amber-800">Há reposição(ões) relacionada(s) que exigem conferência da gestão.</p>}
      </article>)}
    </section>

    <section className="space-y-2">
      <h3 className="font-medium">Simulação de frequência</h3>
      {dados.simulacoes.length === 0 && <p className="text-sm text-gray-600">Não há simulações disponíveis para esta proposta.</p>}
      {dados.simulacoes.map((simulacao) => <article key={`${simulacao.matriculaId}:${simulacao.nivelId}`} className="rounded border bg-white p-3">
        <h4 className="font-medium">{nomes.get(simulacao.matriculaId) ?? "Registro da chamada"}</h4>
        {simulacao.pendencia
          ? <p className="mt-1 text-sm text-amber-800">{simulacao.pendencia}</p>
          : <div className="mt-1 space-y-1"><ResumoFrequencia titulo="Antes" valor={simulacao.antes} /><ResumoFrequencia titulo="Simulação proposta" valor={simulacao.depois} />
            {simulacao.fechamento?.pendencia && <p className="text-sm text-amber-800">Fechamento: {simulacao.fechamento.pendencia}</p>}
            {simulacao.fechamento?.depois && <ElegibilidadeSimulada elegibilidade={simulacao.fechamento.depois.elegibilidade} />}
          </div>}
      </article>)}
    </section>

    <section className="space-y-2">
      <h3 className="font-medium">Dependências a conferir</h3>
      {dados.reposicoes.map((reposicao) => <p key={reposicao.id} className="text-sm text-gray-700">Reposição de {nomes.get(reposicao.matriculaId) ?? "aluno da chamada"}: {reposicao.decisao?.aprovada === false ? "pedido rejeitado; decisão preservada no histórico" : reposicao.concluida ? "conclusão registrada" : reposicao.decisao?.aprovada ? "pedido autorizado" : "pedido aguardando decisão"}.</p>)}
      {dados.inventarioReposicoes.map((reposicao) => <div key={reposicao.id} className="rounded border p-2 text-sm text-gray-700">
        <p className="font-medium">Dependências de {nomes.get(reposicao.matriculaId) ?? "aluno da chamada"}</p>
        {reposicao.agendaParticular && <p>Particular vinculada à agenda; {reposicao.agendaParticular.statusBeneficio === "RESERVADA" ? "benefício reservado" : reposicao.agendaParticular.statusBeneficio === "CONSUMIDA" ? "benefício consumido" : reposicao.agendaParticular.statusBeneficio === "ISENTA_EXCECAO" ? "isenção excepcional registrada" : "benefício devolvido"}.</p>}
        {reposicao.materialGravacao && <p>Material registrado: {reposicao.materialGravacao.disponivel ? "disponível" : "indisponível"}.</p>}
        {reposicao.disponibilizacaoEntrega && <p>Prazo de entrega disponibilizado.</p>}
        <p>{reposicao.designacoes.length} designação(ões) no histórico e {reposicao.entregas.length} entrega(s) registrada(s).</p>
        <p>{reposicao.correcoesEntrega.length} pedido(s) de correção da entrega, {reposicao.prorrogacoesPrazo.length} prorrogação(ões) e {reposicao.liberacoesEntrega.length} autorização(ões) específica(s) de envio.</p>
        {!!reposicao.materialGravacao?.indisponibilidades.length && <p>{reposicao.materialGravacao.indisponibilidades.length} interrupção(ões) confirmada(s) do material; {reposicao.materialGravacao.indisponibilidades.filter(i => !i.fim).length} ainda aberta(s).</p>}
      </div>)}
      {dados.financeiro.possuiDependenciasFinanceiras ? <div className="space-y-1 text-sm text-gray-700">
        <p>Há vínculos financeiros associados à aula. Os valores não são exibidos nesta tela.</p>
        {!dados.financeiro.exigeConferenciaFinanceira && <p>A alteração é apenas textual. A publicação preserva as ocorrências, reservas e lançamentos financeiros.</p>}
        {dados.financeiro.ocorrencias.map((ocorrencia) => <p key={ocorrencia.id}>Ocorrência registrada na versão {ocorrencia.versao}: {ocorrencia.conferenciaId ? "conferida" : "ainda sem conferência"}{ocorrencia.itemFaturadoId ? "; incluída em faturamento" : ""}.</p>)}
        {dados.financeiro.reservas.map((reserva) => <p key={reserva.id}>Reserva de horas relacionada: {reserva.consumoId ? "consumo registrado" : "sem consumo registrado"}{reserva.liberacoesAprovadas.length ? "; liberação aprovada" : ""}.</p>)}
      </div> : <p className="text-sm text-gray-700">Nenhuma dependência financeira foi encontrada para esta chamada.</p>}
      {dados.progressao.length > 0 && <p className="text-sm text-gray-700">Há {dados.progressao.length} vínculo(s) acadêmico(s) na conferência. A simulação acima não confirma resultados.</p>}
    </section>
  </section>;
}

export function CorrecaoAula({ encontroId, dados: dadosIniciais, podeConferirImpactos }: { encontroId: string; dados: DadosRevisao; podeConferirImpactos: boolean }) {
  const [dados, setDados] = useState(dadosIniciais);
  const [conteudo, setConteudo] = useState(dadosIniciais.snapshot.conteudo);
  const [registros, setRegistros] = useState<EdicaoRegistro[]>(() => iniciarRegistros(dadosIniciais));
  const [motivo, setMotivo] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [proposta, setProposta] = useState<{ id: string; versao: number } | null>(null);
  const [impactos, setImpactos] = useState<DadosImpactos | null>(null);
  const [propostaParaRejeitar, setPropostaParaRejeitar] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [propostaParaAprovar, setPropostaParaAprovar] = useState<string | null>(null);
  const [motivoAprovacao, setMotivoAprovacao] = useState("");
  const [confirmouPreservacaoReposicoes, setConfirmouPreservacaoReposicoes] = useState(false);
  const [propostas, setPropostas] = useState(() => dadosIniciais.propostas);
  const [proximaVersao, setProximaVersao] = useState(dadosIniciais.proximaVersao);
  const [versaoAtualDaConsulta, setVersaoAtualDaConsulta] = useState(dadosIniciais.versaoAtual);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const idempotencia = useRef<{ assinatura: string; chave: string } | null>(null);

  const alteracao = useMemo(() => ({ conteudo, registros: registros.map((registro) => ({ ...registro, observacao: registro.observacao || null })) }), [conteudo, registros]);
  const assinatura = useMemo(() => JSON.stringify({ encontroId, estadoHash: dados.estadoHash, versaoEsperada: dados.versaoAtual, alteracao, motivo, evidencia }), [alteracao, dados.estadoHash, dados.versaoAtual, encontroId, evidencia, motivo]);
  const houveAlteracao = conteudo.trim() !== dados.snapshot.conteudo || registros.some((registro, indice) => registro.participacao !== dados.snapshot.registros[indice]?.participacao || (registro.observacao || "") !== (dados.snapshot.registros[indice]?.observacao || ""));

  const atualizarRegistro = (registroId: string, atualizacao: Partial<EdicaoRegistro>) => {
    setRegistros((atuais) => atuais.map((registro) => registro.registroId === registroId ? { ...registro, ...atualizacao } : registro));
    idempotencia.current = null;
    setProposta(null);
    setImpactos(null);
  };

  const carregarFonte = async (mensagemSucesso: string) => {
    setErro("");
    try {
      const resultado = await consultarHistoricoCorrecaoAula({ encontroId });
      if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível atualizar a conferência." : resultado.erro); return; }
      setDados(resultado.dado);
      setPropostas(resultado.dado.propostas);
      setProximaVersao(resultado.dado.proximaVersao);
      setVersaoAtualDaConsulta(resultado.dado.versaoAtual);
      setConteudo(resultado.dado.snapshot.conteudo);
      setRegistros(iniciarRegistros(resultado.dado));
      setProposta(null);
      setImpactos(null);
      setPropostaParaRejeitar(null);
      setMotivoRejeicao("");
      setPropostaParaAprovar(null);
      setMotivoAprovacao("");
      setConfirmouPreservacaoReposicoes(false);
      idempotencia.current = null;
      setMensagem(mensagemSucesso);
    } catch {
      setErro("Não foi possível atualizar a conferência. Recarregue a página para verificar a fonte.");
    }
  };

  const recarregar = () => iniciar(() => carregarFonte(dados.podePropor
    ? "Fonte recarregada. Revise a alteração antes de registrar uma proposta."
    : "Fonte e histórico recarregados."));

  const carregarPropostasAnteriores = () => {
    if (proximaVersao === null) return;
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await consultarHistoricoCorrecaoAula({ encontroId, antesDaVersao: proximaVersao });
        if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível carregar propostas anteriores." : resultado.erro); return; }
        const pagina = resultado.dado;
        if (pagina.versaoAtual !== versaoAtualDaConsulta) {
          setVersaoAtualDaConsulta(pagina.versaoAtual);
          setPropostaParaRejeitar(null);
          setPropostaParaAprovar(null);
          setConfirmouPreservacaoReposicoes(false);
          setImpactos(null);
          setMensagem("Há uma proposta mais recente. Recarregue a fonte para conferir a versão atual antes de decidir.");
        }
        setPropostas((atuais) => {
          const porId = new Map(atuais.map((item) => [item.id, item]));
          pagina.propostas.forEach((item) => porId.set(item.id, item));
          return [...porId.values()].sort((a, b) => b.versao - a.versao || b.id.localeCompare(a.id));
        });
        setProximaVersao(pagina.proximaVersao);
      } catch {
        setErro("Não foi possível carregar propostas anteriores. Atualize a página para tentar novamente.");
      }
    });
  };

  const enviarProposta = () => iniciar(async () => {
    setErro("");
    setMensagem("");
    if (!houveAlteracao) { setErro("Informe ao menos uma alteração antes de registrar a proposta."); return; }
    const motivoLimpo = motivo.trim();
    const evidenciaLimpa = evidencia.trim();
    if (motivoLimpo.length < 5 || evidenciaLimpa.length < 5) { setErro("Descreva o motivo e a evidência com pelo menos cinco caracteres."); return; }
    if (!idempotencia.current || idempotencia.current.assinatura !== assinatura) idempotencia.current = { assinatura, chave: crypto.randomUUID() };
    try {
      const resultado = await proporCorrecaoAula({ encontroId, estadoHash: dados.estadoHash, versaoEsperada: dados.versaoAtual,
        alteracao, motivo: motivoLimpo, evidencia: evidenciaLimpa, chaveIdempotencia: idempotencia.current.chave });
      if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível registrar a proposta." : resultado.erro); return; }
      setProposta(resultado.dado);
      setImpactos(null);
      setMensagem(`Proposta registrada na versão ${resultado.dado.versao}. A correção ainda não foi publicada.`);
    } catch {
      setErro("Não foi possível registrar a proposta. Atualize a conferência antes de tentar novamente.");
    }
  });

  const conferirImpactos = (propostaId: string) => {
    iniciar(async () => {
      setErro("");
      setImpactos(null);
      setPropostaParaAprovar(null);
      setMotivoAprovacao("");
      setConfirmouPreservacaoReposicoes(false);
      try {
        const resultado = await revisarImpactosCorrecaoAula({ propostaId });
        if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível conferir os impactos." : resultado.erro); return; }
        setImpactos(resultado.dado);
        setMensagem("Impactos conferidos. A proposta continua sem publicação.");
      } catch {
        setErro("Não foi possível conferir os impactos. Atualize a página antes de tentar novamente.");
      }
    });
  };

  const rejeitarProposta = (item: PropostaHistorica) => iniciar(async () => {
    const motivo = motivoRejeicao.trim();
    setErro("");
    if (motivo.length < 5) { setErro("Informe o motivo da rejeição com pelo menos cinco caracteres."); return; }
    try {
      const resultado = await rejeitarCorrecaoAula({ propostaId: item.id, propostaHash: item.propostaHash, motivo });
      if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível rejeitar a proposta." : resultado.erro); return; }
      await carregarFonte("Proposta rejeitada. A correção continua sem publicação.");
    } catch {
      setErro("Não foi possível registrar a rejeição. Atualize a página para conferir a proposta antes de tentar novamente.");
    }
  });

  const aprovarProposta = (item: PropostaHistorica) => iniciar(async () => {
    const motivo = motivoAprovacao.trim();
    setErro("");
    if (!impactos || impactos.propostaId !== item.id) { setErro("Confira os impactos atuais desta proposta antes de publicá-la."); return; }
    if (impactos.financeiro.exigeConferenciaFinanceira) { setErro("Há dependências financeiras que exigem conferência antes da publicação."); return; }
    const avaliacaoReposicoes = avaliarReposicoes(impactos);
    if (avaliacaoReposicoes.afetadas.length > 0 && !avaliacaoReposicoes.todasAutorizadas) { setErro("Há reposições relacionadas que exigem conferência antes da publicação."); return; }
    if (avaliacaoReposicoes.todasAutorizadas && !confirmouPreservacaoReposicoes) { setErro("Confirme a preservação das reposições relacionadas antes de publicar a correção."); return; }
    if (motivo.length < 5) { setErro("Informe a justificativa da publicação com pelo menos cinco caracteres."); return; }
    try {
      const resultado = await aprovarCorrecaoAula({ propostaId: item.id, propostaHash: item.propostaHash, impactosHash: impactos.impactosHash, motivo, confirmarPreservacaoReposicoes: avaliacaoReposicoes.todasAutorizadas });
      if (!resultado.ok || !resultado.dado) { setErro(resultado.ok ? "Não foi possível publicar a correção." : resultado.erro); return; }
      await carregarFonte("Correção publicada. A fonte e o histórico foram atualizados.");
    } catch {
      setErro("Não foi possível publicar a correção. Atualize a conferência antes de tentar novamente.");
    }
  });

  return <div className="space-y-5">
    <section className="space-y-3 rounded border bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">{dados.podePropor ? "Fonte conferida" : "Fonte registrada"}</h2><button type="button" onClick={recarregar} disabled={ocupado} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Recarregar fonte</button></div>
      <p className="text-sm text-gray-700">Versão atual de propostas: {dados.versaoAtual}. O conteúdo e os registros abaixo representam a fonte consultada neste momento.</p>
      <p className="whitespace-pre-wrap rounded border bg-white p-3 text-sm">{dados.snapshot.conteudo}</p>
      <ul className="space-y-1 text-sm">{dados.snapshot.registros.map((registro) => <li key={registro.registroId}><span className="font-medium">{registro.nomeAluno}</span>: {rotuloParticipacao[registro.participacao]}{registro.observacao ? ` · ${registro.observacao}` : ""}</li>)}</ul>
    </section>

    <CorrecaoFonteGravacao publicacaoId={dados.snapshot.gravacao?.tipo === "OFICIAL" ? dados.snapshot.gravacao.publicacaoId : null} podePropor={dados.podePropor} />

    {dados.podePropor ? <form className="space-y-4 rounded border bg-[var(--surface)] p-4" onSubmit={(evento) => { evento.preventDefault(); enviarProposta(); }}>
      <h2 className="text-lg font-medium">Alteração proposta</h2>
      <fieldset disabled={ocupado} className="space-y-4">
        <label className="block">Conteúdo ministrado<textarea value={conteudo} onChange={(evento) => { setConteudo(evento.target.value); idempotencia.current = null; setProposta(null); setImpactos(null); }} required minLength={1} maxLength={20000} className="mt-1 block w-full rounded border p-2" /></label>
        <div className="space-y-3">{dados.snapshot.registros.map((registro) => {
          const edicao = registros.find((item) => item.registroId === registro.registroId)!;
          return <fieldset key={registro.registroId} className="space-y-2 rounded border p-3"><legend className="px-1 font-medium">{registro.nomeAluno}</legend>
            <label className="block">Participação<select value={edicao.participacao} onChange={(evento) => atualizarRegistro(registro.registroId, { participacao: evento.target.value as Participacao })} className="mt-1 block rounded border p-2"><option value="PRESENTE">Presente</option><option value="FALTA">Falta</option><option value="IMPEDIDO_POR_RESTRICAO">Impedido por restrição</option></select></label>
            <label className="block text-sm">Observação<textarea value={edicao.observacao} onChange={(evento) => atualizarRegistro(registro.registroId, { observacao: evento.target.value })} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>
          </fieldset>;
        })}</div>
        <label className="block">Motivo da correção<textarea value={motivo} onChange={(evento) => { setMotivo(evento.target.value); idempotencia.current = null; setProposta(null); setImpactos(null); }} required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block">Evidência da conferência<textarea value={evidencia} onChange={(evento) => { setEvidencia(evento.target.value); idempotencia.current = null; setProposta(null); setImpactos(null); }} required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>
        <p className="text-sm text-gray-600">A proposta será conferida antes de alterar o diário. Seus dados e sua autorização serão verificados novamente ao registrar.</p>
        <button type="submit" disabled={ocupado || !houveAlteracao || !!proposta} className="rounded bg-brand-700 px-4 py-2 text-white disabled:opacity-50">{ocupado ? "Registrando…" : "Registrar proposta de correção"}</button>
      </fieldset>
    </form> : <section className="rounded border bg-[var(--surface)] p-4"><h2 className="text-lg font-medium">Consulta histórica</h2><p className="mt-1 text-sm text-gray-700">Você pode consultar a fonte e as propostas desta aula, mas não pode preparar nova correção. A autorização é conferida novamente pelo servidor em cada ação.</p></section>}

    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    {mensagem && <p role="status" className="text-green-700">{mensagem}</p>}
    {proposta && <section className="space-y-3 rounded border border-blue-200 bg-blue-50 p-4"><h2 className="text-lg font-medium">Proposta registrada</h2><p>Versão {proposta.versao}. A correção ainda não foi publicada e o diário original permanece vigente.</p>{podeConferirImpactos && <button type="button" disabled={ocupado} onClick={() => conferirImpactos(proposta.id)} className="rounded border border-blue-700 px-3 py-2 text-blue-800 disabled:opacity-50">{ocupado ? "Conferindo…" : "Conferir impactos da proposta"}</button>}{!podeConferirImpactos && <p className="text-sm text-gray-700">A conferência de impactos é feita pela gestão pedagógica.</p>}</section>}
    {propostas.length > 0 && <section className="space-y-3 rounded border bg-[var(--surface)] p-4"><header><h2 className="text-lg font-medium">Histórico de propostas</h2><p className="text-sm text-gray-700">As propostas preservam a fonte registrada. Uma proposta no histórico não altera o diário vigente.</p></header>{propostas.map((item) => <article key={item.id} className="space-y-2 rounded border bg-white p-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-medium">Proposta versão {item.versao}</h3><time className="text-sm text-gray-600" dateTime={item.criadaEm}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(item.criadaEm))} UTC</time></div><p className="text-sm">Preparada por {item.autor.nome}.</p><p className="whitespace-pre-wrap text-sm"><span className="font-medium">Motivo: </span>{item.motivo}</p><p className="whitespace-pre-wrap text-sm"><span className="font-medium">Evidência: </span>{item.evidencia}</p><ResumoPropostaHistorica proposta={item} />
      {item.aprovacao ? <section className="rounded border border-green-200 bg-green-50 p-3 text-sm"><h4 className="font-medium">Correção publicada</h4><p>Decisão de {item.aprovacao.decisor.nome} em <time dateTime={item.aprovacao.criadaEm}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(item.aprovacao.criadaEm))} UTC</time>.</p><p className="mt-1 whitespace-pre-wrap">{item.aprovacao.motivo}</p><p className="mt-1 text-gray-700">A decisão publicada permanece no histórico.</p></section> : item.rejeicao ? <section className="rounded border border-rose-200 bg-rose-50 p-3 text-sm"><h4 className="font-medium">Proposta rejeitada</h4><p>Decisão de {item.rejeicao.decisor.nome} em <time dateTime={item.rejeicao.criadaEm}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(item.rejeicao.criadaEm))} UTC</time>.</p><p className="mt-1 whitespace-pre-wrap">{item.rejeicao.motivo}</p><p className="mt-1 text-gray-700">A rejeição não publica nem altera o diário.</p></section> : <>
        {podeConferirImpactos && <button type="button" disabled={ocupado} onClick={() => { conferirImpactos(item.id); }} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{ocupado ? "Conferindo…" : "Conferir impactos desta proposta"}</button>}
        {podeConferirImpactos && item.versao === versaoAtualDaConsulta && item.podeRejeitar && impactos?.propostaId === item.id && <section className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><h4 className="font-medium">Decisão de publicação</h4>{(() => {
          const avaliacaoReposicoes = avaliarReposicoes(impactos);
          return impactos.financeiro.exigeConferenciaFinanceira ? <p className="text-amber-900">Há dependências financeiras a conferir antes da publicação. Os valores não são exibidos nesta tela.</p> : avaliacaoReposicoes.afetadas.length > 0 && !avaliacaoReposicoes.todasAutorizadas ? <p className="text-amber-900">Há reposições relacionadas que precisam de conferência antes da publicação.</p> : propostaParaAprovar !== item.id ? <><p className="text-gray-700">{avaliacaoReposicoes.todasAutorizadas ? avaliacaoReposicoes.temContinuaveis ? `${avaliacaoReposicoes.temConcluidasPreservaveis ? "As reposições concluídas podem ser preservadas sem duplicar a frequência. " : ""}O atendimento autorizado das reposições ainda sem conclusão continua, com agenda, prazo e benefício preservados. Registre a justificativa e confirme essa preservação para publicar a correção.` : "As reposições concluídas podem ser preservadas sem duplicar a frequência. Registre a justificativa e confirme essa preservação para publicar a correção." : "A conferência atual não encontrou dependências que bloqueiem esta decisão. Registre uma justificativa para publicar a correção."}</p><button type="button" disabled={ocupado} onClick={() => { setPropostaParaAprovar(item.id); setMotivoAprovacao(""); setConfirmouPreservacaoReposicoes(false); setErro(""); }} className="rounded border border-green-700 px-3 py-2 text-green-800 disabled:opacity-50">Publicar correção</button></> : <form className="space-y-2" onSubmit={(evento) => { evento.preventDefault(); aprovarProposta(item); }}><p className="text-gray-700">A publicação aplica a proposta conferida ao diário e registra esta decisão no histórico.</p><label className="block">Justificativa da publicação<textarea value={motivoAprovacao} onChange={(evento) => setMotivoAprovacao(evento.target.value)} required minLength={5} maxLength={3000} disabled={ocupado} className="mt-1 block w-full rounded border p-2" /></label>{avaliacaoReposicoes.todasAutorizadas && <label className="flex items-start gap-2 text-gray-700"><input type="checkbox" checked={confirmouPreservacaoReposicoes} onChange={(evento) => setConfirmouPreservacaoReposicoes(evento.target.checked)} disabled={ocupado} /><span>{textoPreservacaoReposicoes(avaliacaoReposicoes)}</span></label>}<div className="flex gap-2"><button type="submit" disabled={ocupado || (avaliacaoReposicoes.todasAutorizadas && !confirmouPreservacaoReposicoes)} className="rounded border border-green-700 px-3 py-2 text-green-800 disabled:opacity-50">{ocupado ? "Publicando…" : "Confirmar publicação"}</button><button type="button" disabled={ocupado} onClick={() => { setPropostaParaAprovar(null); setMotivoAprovacao(""); setConfirmouPreservacaoReposicoes(false); }} className="rounded border px-3 py-2 disabled:opacity-50">Cancelar</button></div></form>;
        })()}</section>}
        {podeConferirImpactos && item.versao === versaoAtualDaConsulta && item.podeRejeitar && propostaParaRejeitar !== item.id && <button type="button" disabled={ocupado} onClick={() => { setPropostaParaRejeitar(item.id); setMotivoRejeicao(""); setPropostaParaAprovar(null); setMotivoAprovacao(""); setErro(""); }} className="rounded border border-rose-700 px-3 py-2 text-sm text-rose-800 disabled:opacity-50">Rejeitar proposta</button>}
        {podeConferirImpactos && item.versao === versaoAtualDaConsulta && item.podeRejeitar && propostaParaRejeitar === item.id && <form className="space-y-2 rounded border border-rose-200 bg-rose-50 p-3" onSubmit={(evento) => { evento.preventDefault(); rejeitarProposta(item); }}><h4 className="font-medium">Registrar rejeição</h4><p className="text-sm text-gray-700">A rejeição encerra esta proposta sem publicar nenhuma alteração no diário.</p><label className="block text-sm">Motivo da rejeição<textarea value={motivoRejeicao} onChange={(evento) => setMotivoRejeicao(evento.target.value)} required minLength={5} maxLength={3000} disabled={ocupado} className="mt-1 block w-full rounded border p-2" /></label><div className="flex gap-2"><button type="submit" disabled={ocupado} className="rounded border border-rose-700 px-3 py-2 text-rose-800 disabled:opacity-50">{ocupado ? "Registrando…" : "Confirmar rejeição"}</button><button type="button" disabled={ocupado} onClick={() => { setPropostaParaRejeitar(null); setMotivoRejeicao(""); }} className="rounded border px-3 py-2 disabled:opacity-50">Cancelar</button></div></form>}
        {!podeConferirImpactos && <p className="text-sm text-gray-600">A gestão pedagógica pode conferir e decidir esta proposta.</p>}
      </>}
    </article>)}{proximaVersao !== null && <button type="button" disabled={ocupado} onClick={carregarPropostasAnteriores} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{ocupado ? "Carregando…" : "Carregar propostas anteriores"}</button>}</section>}
    {impactos && <Impactos dados={impactos} />}
  </div>;
}
