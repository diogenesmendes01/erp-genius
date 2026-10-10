import { instanteDaGrade } from "@/server/agenda/grade";
import { fusoIanaValido } from "@/server/operacao/fuso";

// Prévia de conversão (docs/43 §6 item 6; docs/42 L1540, L1590, L1786): quando a pessoa digita data e hora num
// fuso diferente daquele em que a tela exibe os horários, mostra antes do envio em que horário aquilo vai
// aparecer — "Isso será 22/09/2026, 14:00 em America/Sao_Paulo". O fuso sai como o identificador completo, do
// mesmo jeito que as outras telas o mostram ("horário exibido em America/Sao_Paulo; origem UTC"). Mesmo fuso,
// horário incompleto, fuso não reconhecido (o próprio CampoFuso acusa) ou data impossível: nada a mostrar. A
// conversão é a do servidor (instanteDaGrade), que recusa horário inexistente ou repetido na mudança de horário
// de verão em vez de escolher um em silêncio.

/**
 * Texto da prévia, ou null quando não há o que mostrar. `local` é o valor de um `datetime-local`
 * ("2026-09-22T14:00", com segundos opcionais — a prévia vai até o minuto).
 */
export function textoPreviaConversao(local: string, fuso: string, fusoExibicao: string): string | null {
  const origem: string = fuso.trim(), destino: string = fusoExibicao.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local) || !fusoIanaValido(origem) || !fusoIanaValido(destino) || origem === destino) return null;
  let instante: Date;
  try {
    instante = instanteDaGrade(local.slice(0, 10), local.slice(11, 16), origem);
  } catch (e: unknown) {
    // Data impossível (31/02) não é conversão: o próprio campo de data recusa. Dobra de horário de verão é.
    return e instanceof Error && /amb[ií]guo|inexistente/.test(e.message)
      ? `Esse horário não existe ou se repete em ${origem} por causa da mudança de horário; escolha outro antes de enviar.`
      : null;
  }
  const texto: string = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: destino }).format(instante);
  return `Isso será ${texto} em ${destino}, o fuso em que a tela exibe os horários.`;
}

export function PreviaConversao({ local, fuso, fusoExibicao, className = "text-sm text-gray-600" }: { local: string; fuso: string; fusoExibicao: string; className?: string }) {
  const texto: string | null = textoPreviaConversao(local, fuso, fusoExibicao);
  return texto ? <p className={className}>{texto}</p> : null;
}
