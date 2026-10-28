export type DecisaoMensagemAgendada = "cancelar" | "manter";
export type MensagemAgendadaDaTarefa = {
  id: string;
  status: "PENDENTE" | "ADIADA";
  agendadaPara: string;
  quando: string;
};
export type JanelaEnvioTarefa = { inicio: number; fim: number; diasSemana: number[] };

export const COMPLEMENTO_FORA_DA_JANELA = ' Ou desmarque "Enviar mensagem nesta data" para criar só a tarefa.';

export function quandoDaMensagemAgendada(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(local);
  if (!m) return null;
  return `${m[3]}/${m[2]} ${m[4]}`;
}

export function textoSeloMensagemAgendada(quando: string): string {
  return `Mensagem agendada · ${quando}`;
}

export const AVISO_REMARCACAO_MENSAGEM = "Remarcar a tarefa move este envio para o novo horário.";
