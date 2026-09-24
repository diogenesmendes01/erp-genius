"use client";

import { useRouter } from "next/navigation";
import { salvarConfiguracaoOperacional } from "@/server/operacao/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function OperacaoFormulario({ exigirPrimeiraMensalidade, prazoConferenciaHoras, fusoInstitucional, prazoReservaMinutos }: { exigirPrimeiraMensalidade: boolean; prazoConferenciaHoras: number | null; fusoInstitucional: string | null; prazoReservaMinutos: number | null }) {
  const router = useRouter();
  // Sem chave de idempotência: cada gravação sobrescreve o singleton e registra um evento de alteração.
  // A falha de rede manda conferir a configuração recarregada antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  async function salvar(form: FormData) {
    const desfecho = await acao.executar(() => salvarConfiguracaoOperacional({ prazoReservaMinutos: String(form.get("reserva") ?? "").trim() ? Number(form.get("reserva")) : null, exigirPrimeiraMensalidade: form.get("primeira") === "on", prazoConferenciaHoras: Number(form.get("prazo")), fusoInstitucional: String(form.get("fuso") ?? "").trim() || undefined }), "Configuração salva.");
    if (desfecho?.tipo === "ok") router.refresh();
  }
  return <form action={salvar} className="space-y-5 rounded border p-5 text-sm">
    <label className="block">Fuso oficial da escola<input name="fuso" defaultValue={fusoInstitucional ?? ""} placeholder="America/Sao_Paulo" maxLength={100} className="mt-1 block w-full rounded border p-2" /></label>
    <p className="text-gray-500">Define as datas institucionais. A preferência de exibição de cada pessoa é independente. Deixar em branco mantém a configuração atual; não escolhe um fuso automaticamente.</p>
    <p>Contrato aceito e taxa de matrícula confirmada são obrigatórios para ativar a matrícula.</p>
    <label className="flex items-center gap-2"><input type="checkbox" name="primeira" defaultChecked={exigirPrimeiraMensalidade} />Exigir também a primeira mensalidade confirmada</label>
    <p className="text-gray-500">Essa exigência vale na próxima ativação. Matrículas já ativas mantêm seu histórico.</p>
    <label className="block">Suspender lembretes durante a conferência por (horas)<input name="prazo" type="number" required min="1" max="720" defaultValue={prazoConferenciaHoras ?? ""} className="mt-1 block w-36 rounded border p-2" /></label>
    <p className="text-gray-500">O prazo é fixado quando a secretaria informa o pagamento. Afeta apenas aquela cobrança. Ao vencer o prazo, a régua pode retomar se ainda houver saldo; rejeitar o comprovante encerra a suspensão. Alterar esta configuração vale para novos informes.</p>
    <label className="block">Prazo inicial de reserva de vaga (minutos)<input name="reserva" type="number" min="1" max="2147483647" step="1" defaultValue={prazoReservaMinutos ?? ""} className="mt-1 block w-36 rounded border p-2" /></label>
    <p className="text-gray-500">Vale para novas reservas. Deixar em branco impede criar novas reservas até configurar o prazo; não libera nem altera reservas existentes. Prorrogações exigem proposta e aprovação próprias.</p>
    <button disabled={acao.ocupado} className="rounded bg-brand-solid px-4 py-2 text-white disabled:opacity-50">{acao.ocupado ? "Salvando…" : "Salvar configuração"}</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
