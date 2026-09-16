"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { concluirReposicaoIndividual } from "@/server/diario/reposicao-individual";
import { solicitarCorrecaoEntregaReposicao } from "@/server/diario/reposicao-gravacao-actions";
import { descreverParticipacaoOrigem, type OrigemReposicao } from "./ReposicoesEquipe";
import { RelatarIndisponibilidadeReposicao } from "./RelatarIndisponibilidadeReposicao";

export type EntregaGravadaPendente = { id: string; entregueEm: string; resumo: string; atividade: string; evidencia: string };

const data = (valor: string, fuso: string) => {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor)); }
  catch { return valor.replace("T", " ").replace("Z", " UTC"); }
};

export function ReposicaoDocente({ reposicaoId, versaoAnterior, modalidade, origem, entrega }: {
  reposicaoId: string; versaoAnterior: number; modalidade: "PARTICULAR" | "GRAVACAO"; origem: OrigemReposicao; entrega: EntregaGravadaPendente | null;
}) {
  const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState(""); const router = useRouter();
  const avisoOrigemCorrigida = origem.participacao === "PRESENTE" && <p role="status" className="text-sm text-gray-600">A participação da aula de origem foi corrigida para presença. O pedido continua no histórico; essa correção não registra conclusão.</p>;
  if (modalidade === "PARTICULAR") return <section className="space-y-4 rounded border p-4"><h1 className="text-xl font-medium">Reposição particular autorizada</h1><p>Origem: {descreverParticipacaoOrigem(origem.participacao)}, de {data(origem.inicio, origem.fuso)} a {data(origem.fim, origem.fuso)} ({origem.fuso}).</p>{avisoOrigemCorrigida}<p role="status">A Secretaria precisa vincular o encontro acadêmico próprio a este pedido. Esta tela não escolhe encontros por matrícula, não cria agenda e não cria reserva comercial ou cobrança.</p></section>;
  if (!entrega) return <section className="space-y-3 rounded border p-4"><h1 className="text-xl font-medium">Aguardando entrega gravada</h1><p>A gravação só pode ser validada após o aluno enviar resumo e atividade pela área autenticada própria.</p><p role="status">O portal e a publicação autorizada da gravação ainda são dependências separadas; nenhuma entrega é simulada aqui.</p><RelatarIndisponibilidadeReposicao reposicaoId={reposicaoId} /></section>;
  return <><form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      setErro("");
      try {
        if (dados.get("operacao") === "CORRIGIR") {
          const r = await solicitarCorrecaoEntregaReposicao({ reposicaoId, entregaId: entrega.id, comentario: String(dados.get("comentarioCorrecao") ?? "") });
          if (!r.ok) { setErro(r.erro); return; } router.refresh(); return;
        }
        const instante = new Date(String(dados.get("validadaEm") ?? ""));
        if (!Number.isFinite(instante.getTime())) { setErro("Informe uma data e horário de validação válidos."); return; }
        const r = await concluirReposicaoIndividual({ reposicaoId, versaoAnterior, entregaId: entrega.id, validadaEm: instante.toISOString(), evidencia: String(dados.get("evidencia") ?? "") });
        if (!r.ok) { setErro(r.erro); return; } router.refresh();
      } catch { setErro("A validação não foi confirmada. Consulte a reposição antes de repetir."); }
    });
  }}><fieldset disabled={ocupado} className="space-y-3"><legend className="text-xl font-medium">Validar reposição por gravação</legend>
    <p>Origem: {descreverParticipacaoOrigem(origem.participacao)}, de {data(origem.inicio, origem.fuso)} a {data(origem.fim, origem.fuso)} ({origem.fuso}). A validação regulariza somente esta aula e preserva o registro original.</p>
    {avisoOrigemCorrigida}
    <details><summary>Entrega do aluno em {data(entrega.entregueEm, origem.fuso)} ({origem.fuso})</summary><p className="mt-2 whitespace-pre-wrap">Resumo: {entrega.resumo}</p><p className="mt-2 whitespace-pre-wrap">Atividade: {entrega.atividade}</p><p className="mt-2 whitespace-pre-wrap">Evidência: {entrega.evidencia}</p></details>
    <label className="block">Data e horário da validação<input type="datetime-local" name="validadaEm" required step="1" className="block rounded border p-2" /></label><p className="text-sm">O horário é informado no fuso do dispositivo e será registrado em UTC.</p>
    <label className="block">Evidência da validação<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <button name="operacao" value="VALIDAR" className="rounded border px-4 py-2">{ocupado ? "Validando…" : "Confirmar reposição"}</button>
    <div className="border-t pt-3"><label className="block">Comentário para solicitar correção<textarea name="comentarioCorrecao" minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label><button name="operacao" value="CORRIGIR" formNoValidate className="mt-2 rounded border px-4 py-2">Pedir correção ao aluno</button></div>
  </fieldset>{erro && <p role="alert">{erro}</p>}</form><RelatarIndisponibilidadeReposicao reposicaoId={reposicaoId} /></>;
}
