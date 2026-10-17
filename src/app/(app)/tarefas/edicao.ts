import type { PrioridadeTarefa, TipoTarefa } from "@prisma/client";
import type { TarefaInput } from "@/server/crm/tarefas";

export type CamposFormulario = {
  titulo: string;
  tipo: TipoTarefa;
  descricao: string;
  duracaoMin: 15 | 30 | 45 | 60 | 90;
  prioridade: PrioridadeTarefa;
  dataCivil: string | null;
  hora: string | null;
  lembreteAntecedenciaMin: 0 | 10 | 30 | 60 | null;
};

/**
 * Só o que mudou em relação à tarefa lida. Data, hora e lembrete vão juntos quando qualquer um muda:
 * o servidor recalcula o agendamento com os três (limpar a data exige limpar a hora no mesmo pedido).
 */
export function camposAlterados(antes: CamposFormulario, depois: CamposFormulario): Partial<TarefaInput> {
  const r: Partial<TarefaInput> = {};
  if (depois.titulo !== antes.titulo) r.titulo = depois.titulo;
  if (depois.tipo !== antes.tipo) r.tipo = depois.tipo;
  if (depois.descricao !== antes.descricao) r.descricao = depois.descricao;
  if (depois.duracaoMin !== antes.duracaoMin) r.duracaoMin = depois.duracaoMin;
  if (depois.prioridade !== antes.prioridade) r.prioridade = depois.prioridade;
  if (
    depois.dataCivil !== antes.dataCivil ||
    depois.hora !== antes.hora ||
    depois.lembreteAntecedenciaMin !== antes.lembreteAntecedenciaMin
  ) {
    r.dataCivil = depois.dataCivil;
    r.hora = depois.hora;
    r.lembreteAntecedenciaMin = depois.lembreteAntecedenciaMin;
  }
  return r;
}
