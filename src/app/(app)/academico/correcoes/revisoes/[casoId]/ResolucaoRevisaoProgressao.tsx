"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decidirResolucaoRevisaoProgressao,
  proporResolucaoRevisaoProgressao,
  revisarResolucaoRevisaoProgressao,
} from "@/server/avaliacoes/resolucao-revisao-progressao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

type Acao = "REGISTRAR_CANCELAMENTO" | "RECONFIRMAR_EXECUTADA" | "ENCAMINHAR_REGULARIZACAO";
type Proposta = {
  id: string;
  versao: number;
  acao: Acao;
  motivo: string;
  estadoHash: string;
  criadaEm: Date | string;
  preparador: { id: string; nome: string };
  casos: { id: string }[];
  decisao: { id: string; aprovada: boolean; motivo: string; decididaEm: Date | string; decisor: { nome: string } } | null;
  podeDecidir: boolean;
  superada: boolean;
};
type Previa = {
  estadoHash: string;
  versaoAtual: number;
  casos: { id: string }[];
  snapshot: { base: { pendencia: string | null } | null };
};

const rotulosAcao: Record<Acao, string> = {
  REGISTRAR_CANCELAMENTO: "Registrar o cancelamento da solicitação",
  RECONFIRMAR_EXECUTADA: "Reconfirmar a execução com novo fechamento suficiente",
  ENCAMINHAR_REGULARIZACAO: "Encaminhar para regularização acadêmica",
};

const efeitoAcao: Record<Acao, string> = {
  REGISTRAR_CANCELAMENTO: "Registra que a solicitação foi cancelada. Não reabre nem executa a mudança.",
  RECONFIRMAR_EXECUTADA: "Registra a reconfirmação somente depois de um novo fechamento suficiente. Não altera a movimentação já registrada.",
  ENCAMINHAR_REGULARIZACAO: "Registra o encaminhamento para regularização. Ele não confirma resultado suficiente nem resolve o caso automaticamente.",
};

function dataAdministrativa(data: Date | string, preferenciaFusoExibicao: string | null | undefined) {
  return formatarInstanteExibicao(data, preferenciaFusoExibicao, "UTC");
}

export function ResolucaoRevisaoProgressao({
  solicitacaoId,
  statusSolicitacao,
  propostas,
  permitirPreparacao,
  preferenciaFusoExibicao = null,
}: {
  solicitacaoId: string;
  statusSolicitacao: string;
  propostas: Proposta[];
  permitirPreparacao: boolean;
  preferenciaFusoExibicao?: string | null;
}) {
  const router = useRouter();
  const acaoInicial: Acao | null = !permitirPreparacao ? null : statusSolicitacao === "CANCELADA" ? "REGISTRAR_CANCELAMENTO"
    : statusSolicitacao === "EXECUTADA" ? "RECONFIRMAR_EXECUTADA" : null;
  const [acao, setAcao] = useState<Acao | null>(acaoInicial);
  const [motivo, setMotivo] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, iniciar] = useTransition();
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const fusoExibicao = resolverFusoExibicao(preferenciaFusoExibicao, "UTC");

  function invalidarPrevia(proximaAcao = acao) {
    setPrevia(null);
    setErro("");
    setAviso("");
    if (proximaAcao !== acao) tentativa.current = null;
  }

  function conferirPrevia() {
    if (!acao) return;
    iniciar(async () => {
      setErro(""); setAviso("");
      try {
        const resposta = await revisarResolucaoRevisaoProgressao({ solicitacaoId, acao });
        if (!resposta.ok || !resposta.dado) { setPrevia(null); setErro(resposta.ok ? "Prévia indisponível." : resposta.erro); return; }
        setPrevia(resposta.dado as Previa);
      } catch {
        setPrevia(null); setErro("Não foi possível conferir o estado atual. Atualize a página e tente novamente.");
      }
    });
  }

  function propor(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!acao || !previa) return;
    const entrada = JSON.stringify({ solicitacaoId, acao, estadoHash: previa.estadoHash, versaoEsperada: previa.versaoAtual, motivo });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    iniciar(async () => {
      setErro(""); setAviso("");
      try {
        const resposta = await proporResolucaoRevisaoProgressao({
          solicitacaoId, acao, estadoHash: previa.estadoHash, versaoEsperada: previa.versaoAtual, motivo,
          chaveIdempotencia: tentativa.current!.chave,
        });
        if (!resposta.ok) { setErro(resposta.erro); return; }
        tentativa.current = null;
        setPrevia(null);
        setAviso("Proposta registrada para decisão independente. Atualizando o histórico.");
        router.refresh();
      } catch {
        setErro("Não foi possível registrar a proposta. Confira a prévia atual e tente novamente.");
      }
    });
  }

  function decidir(evento: React.FormEvent<HTMLFormElement>, proposta: Proposta) {
    evento.preventDefault();
    const submitter = (evento.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const escolha = submitter?.value;
    if (escolha !== "APROVAR" && escolha !== "REJEITAR") { setErro("Escolha aprovar ou rejeitar a proposta."); return; }
    const aprovada = escolha === "APROVAR";
    const motivoDecisao = String(new FormData(evento.currentTarget).get("motivoDecisao") ?? "");
    iniciar(async () => {
      setErro(""); setAviso("");
      try {
        // A decisão usa exclusivamente o hash persistido na proposta; uma
        // prévia atual não pode substituir a proposta que será decidida.
        const resposta = await decidirResolucaoRevisaoProgressao({ propostaId: proposta.id, estadoHash: proposta.estadoHash, aprovada, motivo: motivoDecisao });
        if (!resposta.ok) { setErro(resposta.erro); return; }
        setAviso("Decisão registrada. Atualizando o histórico e a situação do caso.");
        router.refresh();
      } catch {
        setErro("Não foi possível registrar a decisão. Atualize a página e confira a proposta novamente.");
      }
    });
  }

  return <section className="space-y-4 rounded border p-4" aria-label="Resolução da revisão">
    <h2 className="text-xl font-medium">Resolução da revisão</h2>
    {erro && <p role="alert">{erro}</p>}{aviso && <p role="status">{aviso}</p>}
    {!permitirPreparacao && <p role="status">Este caso já possui resultado registrado. O histórico permanece disponível para consulta.</p>}
    {permitirPreparacao && statusSolicitacao === "APROVADA" && <p role="status">Para registrar uma resolução por cancelamento, cancele primeiro a solicitação no fluxo de mudanças acadêmicas. A correção não cancela a solicitação por si só.</p>}
    {permitirPreparacao && !acao && statusSolicitacao !== "APROVADA" && <p role="status">A situação atual da solicitação não permite preparar uma resolução.</p>}

    {permitirPreparacao && acao && <div className="space-y-3">
      {statusSolicitacao === "EXECUTADA" && <label className="block">Ação de revisão<select value={acao} disabled={ocupado} onChange={(evento) => {
        const proxima = evento.target.value as Acao; setAcao(proxima); invalidarPrevia(proxima);
      }} className="mt-1 block w-full rounded border p-2">
        <option value="RECONFIRMAR_EXECUTADA">{rotulosAcao.RECONFIRMAR_EXECUTADA}</option>
        <option value="ENCAMINHAR_REGULARIZACAO">{rotulosAcao.ENCAMINHAR_REGULARIZACAO}</option>
      </select></label>}
      <p>{efeitoAcao[acao]}</p>
      <button type="button" disabled={ocupado} onClick={conferirPrevia} className="rounded border px-3 py-2">Conferir prévia atual</button>

      {previa && <form onSubmit={propor} className="space-y-3 rounded border p-3">
        <h3 className="font-medium">Prévia conferida</h3>
        <p>{previa.casos.length} {previa.casos.length === 1 ? "caso será incluído" : "casos serão incluídos"} na proposta.</p>
        {previa.snapshot.base && (previa.snapshot.base.pendencia
          ? <p role="status">Base acadêmica: {previa.snapshot.base.pendencia}</p>
          : <p role="status">A prévia não aponta pendência acadêmica nesta etapa. A decisão ainda revalida o estado no servidor.</p>)}
        {!previa.snapshot.base && <p role="status">Esta ação registra o cancelamento já realizado e não recalcula notas ou frequência.</p>}
        <p>{efeitoAcao[acao]}</p>
        <label className="block">Motivo da proposta<textarea value={motivo} required minLength={5} maxLength={3000} disabled={ocupado} onChange={(evento) => {
          setMotivo(evento.target.value); tentativa.current = null;
        }} className="mt-1 block w-full rounded border p-2" /></label>
        <p className="text-sm">Confira o motivo antes de enviar. A prévia continua válida apenas enquanto a ação e o estado consultado não mudarem.</p>
        <button disabled={ocupado || !motivo.trim()} className="rounded bg-brand-700 px-3 py-2 text-white">Propor resolução</button>
      </form>}
    </div>}

    <section className="space-y-3" aria-label="Histórico de propostas de resolução">
      <h3 className="text-lg font-medium">Histórico de propostas</h3>
      {!propostas.length && <p>Nenhuma proposta de resolução foi registrada.</p>}
      {propostas.map((proposta) => <article key={proposta.id} className="space-y-2 rounded border p-3">
        <p><strong>Versão {proposta.versao}:</strong> {rotulosAcao[proposta.acao]}.</p>
        <p>{proposta.casos.length} {proposta.casos.length === 1 ? "caso" : "casos"} incluído(s). Proposta de {proposta.preparador.nome} em {dataAdministrativa(proposta.criadaEm, preferenciaFusoExibicao).texto} ({fusoExibicao}; origem UTC).</p>
        <p className="whitespace-pre-wrap">Motivo: {proposta.motivo}</p>
        {proposta.decisao
          ? <p role="status">{proposta.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {proposta.decisao.decisor.nome} em {dataAdministrativa(proposta.decisao.decididaEm, preferenciaFusoExibicao).texto} ({fusoExibicao}; origem UTC). {proposta.decisao.motivo}</p>
          : <p role="status">{proposta.superada ? "Substituída por uma proposta mais recente." : "Aguardando decisão independente."}</p>}
        {proposta.podeDecidir && !proposta.decisao && <form onSubmit={(evento) => decidir(evento, proposta)} className="space-y-2 border-t pt-3">
          <p className="text-sm">A rejeição registra a recusa desta proposta histórica e não atesta o estado atual.</p>
          <label className="block">Motivo da decisão<textarea name="motivoDecisao" required minLength={5} maxLength={3000} disabled={ocupado} className="mt-1 block w-full rounded border p-2" /></label>
          <div className="flex gap-2"><button name="decisao" value="APROVAR" disabled={ocupado} className="rounded bg-brand-700 px-3 py-2 text-white">Aprovar proposta</button><button name="decisao" value="REJEITAR" disabled={ocupado} className="rounded border px-3 py-2">Rejeitar proposta</button></div>
        </form>}
      </article>)}
    </section>
  </section>;
}
