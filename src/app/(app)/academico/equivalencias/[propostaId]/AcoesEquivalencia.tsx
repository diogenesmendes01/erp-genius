"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-decisao";
import { executarEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-execucao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";

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
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");

  function decidir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!estadoHash) {
      setMensagem("A conferência preservada desta proposta não está disponível para decisão.");
      return;
    }
    const dados = new FormData(evento.currentTarget);
    iniciar(async () => {
      setMensagem("");
      try {
        const r = await decidirEquivalenciaTransferencia({
          propostaId,
          estadoHash,
          aprovar: dados.get("decisao") === "APROVAR",
          motivo: String(dados.get("motivo") ?? ""),
        });
        if (!r.ok) setMensagem(r.erro);
        else {
          setMensagem(r.dado?.aprovada ? "Decisão registrada. A execução continua como uma etapa separada." : "Proposta rejeitada e preservada no histórico.");
          router.refresh();
        }
      } catch {
        setMensagem("O resultado não foi confirmado. Tente novamente com os mesmos dados.");
      }
    });
  }

  function executar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!decisaoId) return;
    const dados = new FormData(evento.currentTarget);
    iniciar(async () => {
      setMensagem("");
      try {
        const r = await executarEquivalenciaTransferencia({
          decisaoId,
          motivo: String(dados.get("motivoExecucao") ?? ""),
          horarioCompativel: true,
        });
        if (!r.ok) setMensagem(r.erro);
        else {
          setMensagem("Transferência efetivada. A matrícula agora está vinculada à turma de destino.");
          router.refresh();
        }
      } catch {
        setMensagem("O resultado não foi confirmado. Tente novamente com os mesmos dados.");
      }
    });
  }

  return <section className="space-y-4" aria-label="Ações da proposta">
    {podeDecidir && <form className="space-y-3 rounded border p-4" onSubmit={decidir}>
      <h2 className="text-xl font-medium">Registrar decisão independente</h2>
      <p>A pessoa que preparou a proposta não pode decidir. A ação confere novamente as fontes, regras e vínculo antes de autorizar.</p>
      <label className="block">Decisão
        <select name="decisao" required defaultValue="" disabled={pendente} className="mt-1 block rounded border p-2">
          <option value="" disabled>Selecione</option>
          <option value="APROVAR">Autorizar para execução</option>
          <option value="REJEITAR">Rejeitar proposta</option>
        </select>
      </label>
      <label className="block">Motivo da decisão
        <textarea name="motivo" required minLength={5} maxLength={2000} disabled={pendente} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="block"><input type="checkbox" required disabled={pendente} /> Conferi o mapeamento e seus efeitos antes de registrar a decisão.</label>
      <button disabled={pendente} className={botaoClasses({ tamanho: "lg" })}>{pendente ? "Registrando…" : "Registrar decisão"}</button>
    </form>}

    {podeExecutar && decisaoId && <form className="space-y-3 rounded border p-4" onSubmit={executar}>
      <h2 className="text-xl font-medium">Efetivar transferência autorizada</h2>
      <p>Esta etapa encerra o vínculo na turma de origem e cria o vínculo na turma de destino. O serviço volta a conferir autorização, vaga, regras e fontes antes de efetivar.</p>
      <label className="block">Motivo da execução
        <textarea name="motivoExecucao" required minLength={5} maxLength={4000} disabled={pendente} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="block"><input type="checkbox" required disabled={pendente} /> Confirmei a compatibilidade de horário com o aluno.</label>
      <button disabled={pendente} className={botaoClasses({ tamanho: "lg" })}>{pendente ? "Efetivando…" : "Efetivar transferência"}</button>
    </form>}
    <MensagemStatus texto={mensagem} />
  </section>;
}
