"use client";

import { useRouter } from "next/navigation";
import { decidirEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-decisao";
import { executarEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-execucao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoSelect, Caixa, SelectItem } from "@/app/(app)/academico/controles";

export function AcoesEquivalencia({
  propostaId,
  estadoHash,
  podeDecidir,
  decisaoId,
  podeExecutar,
}: {
  propostaId: string;
  estadoHash: string | null;
  podeDecidir: boolean;
  decisaoId: string | null;
  podeExecutar: boolean;
}) {
  const router = useRouter();
  const decisao = useAcaoCliente({ idempotente: false });
  const execucao = useAcaoCliente({ idempotente: false });
  const pendente = decisao.ocupado || execucao.ocupado;

  async function decidir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!estadoHash) {
      decisao.setErro("A conferência preservada desta proposta não está disponível para decisão.");
      return;
    }
    const dados = new FormData(evento.currentTarget);
    const d = await decisao.executar(() => decidirEquivalenciaTransferencia({
      propostaId,
      estadoHash,
      aprovar: dados.get("decisao") === "APROVAR",
      motivo: String(dados.get("motivo") ?? ""),
    }), (dado) => dado?.aprovada ? "Decisão registrada. A execução continua como uma etapa separada." : "Proposta rejeitada e preservada no histórico.");
    if (d?.tipo === "incerto") decisao.setErro(MSG_DECISAO_INCERTA);
    else if (d?.tipo === "ok") router.refresh();
  }

  async function executar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!decisaoId) return;
    const dados = new FormData(evento.currentTarget);
    const d = await execucao.executar(() => executarEquivalenciaTransferencia({
      decisaoId,
      motivo: String(dados.get("motivoExecucao") ?? ""),
      horarioCompativel: true,
    }), "Transferência efetivada. A matrícula agora está vinculada à turma de destino.");
    if (d?.tipo === "ok") router.refresh();
  }

  return <section className="space-y-4" aria-label="Ações da proposta">
    {podeDecidir && <form className="space-y-3 rounded border p-4" onSubmit={decidir}>
      <h2 className="text-xl font-medium">Registrar decisão independente</h2>
      <p>A pessoa que preparou a proposta não pode decidir. A ação confere novamente as fontes, regras e vínculo antes de autorizar.</p>
      <label className="block">Decisão
        <CampoSelect name="decisao" required defaultValue="" disabled={pendente} className="mt-1 block rounded border p-2" placeholder="Selecione"><SelectItem value={"APROVAR"}>Autorizar para execução</SelectItem><SelectItem value={"REJEITAR"}>Rejeitar proposta</SelectItem></CampoSelect>
      </label>
      <label className="block">Motivo da decisão
        <CampoTexto name="motivo" required minLength={5} maxLength={2000} disabled={pendente} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="block"><Caixa required disabled={pendente} /> Conferi o mapeamento e seus efeitos antes de registrar a decisão.</label>
      <button disabled={pendente} className={botaoClasses({ tamanho: "lg" })}>{decisao.ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </form>}
    <FeedbackAcao erro={decisao.erro} sucesso={decisao.sucesso} />

    {podeExecutar && decisaoId && <form className="space-y-3 rounded border p-4" onSubmit={executar}>
      <h2 className="text-xl font-medium">Efetivar transferência autorizada</h2>
      <p>Esta etapa encerra o vínculo na turma de origem e cria o vínculo na turma de destino. O serviço volta a conferir autorização, vaga, regras e fontes antes de efetivar.</p>
      <label className="block">Motivo da execução
        <CampoTexto name="motivoExecucao" required minLength={5} maxLength={4000} disabled={pendente} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="block"><Caixa required disabled={pendente} /> Confirmei a compatibilidade de horário com o aluno.</label>
      <button disabled={pendente} className={botaoClasses({ tamanho: "lg" })}>{execucao.ocupado ? "Efetivando…" : "Efetivar transferência"}</button>
    </form>}
    <FeedbackAcao erro={execucao.erro} sucesso={execucao.sucesso} />
  </section>;
}
