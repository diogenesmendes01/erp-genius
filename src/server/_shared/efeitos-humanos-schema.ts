import { z } from "zod";

export const TituloTarefaHumanaSchema = z.string().trim().min(1, "Informe o título da tarefa.").max(200, "O título deve ter até 200 caracteres.");
export const TextoNotaInternaSchema = z.string().trim().min(1, "Escreva a nota.").max(2000, "A nota pode ter no máximo 2000 caracteres.");