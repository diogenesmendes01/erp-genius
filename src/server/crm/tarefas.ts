import { RecorrenciaTarefaSchema } from "./tarefa-recorrencia-configuracao";
import type { RecorrenciaTarefa } from "@prisma/client";
import {erroContencaoNotificadosTarefaD10} from "./tarefa-notificados";
import {CamposAdicionaisTarefaD10Schema,LembreteTarefaD10Schema,PrioridadeTarefaD10Schema} from "./tarefa-d10-schema";
import { TituloTarefaHumanaSchema } from "../_shared/efeitos-humanos-schema";
import { criarTarefaTx, editarTarefaTx, agendamentoTarefa } from "./tarefas-escrita";
import { concluirTarefaTx, reabrirTarefaTx, reagendarTarefaTx, cancelarTarefaTx } from "./tarefas-transicoes";
import type { DecisaoMensagemAgendada } from "@/lib/selo-mensagem-agendada";
import { revalidatePath } from "next/cache";
import { Papel, type Prisma, type PrioridadeTarefa, type TipoTarefa } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";

import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { ErroRegra, exigirSessao, apenasPortal, type UsuarioSessao } from "@/server/_shared/sessao";

import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { capacidadesCrm, exigirCapacidadeCrm, setoresDoUsuario } from "./permissoes";


export type TarefaInput = {
  titulo: string;
  tipo: TipoTarefa;
  descricao?: string;
  dataCivil?: string | null;
  hora?: string | null;
  duracaoMin?: 15 | 30 | 45 | 60 | 90;
  prioridade?: PrioridadeTarefa;
  lembreteAntecedenciaMin?: 0 | 10 | 15 | 30 | 60 | 1440 | null;
  notificarUsuarioIds?: string[];
  recorrencia?: RecorrenciaTarefa;
  responsavelId?: string | null;
  leadId?: string;
  pessoaId?: string;
  alunoId?: string;
  matriculaId?: string;
  atendimentoId?: string;
  chaveIdempotencia?: string;
};



const MSG_NAO_ENCONTRADA = "Tarefa não encontrada.";

const DataCivilSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, "Informe uma data válida.");
const HoraSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido (HH:MM).");

export const CamposTarefaSchema = z.object({
  titulo: TituloTarefaHumanaSchema,
  tipo: z.enum(["WHATSAPP", "LIGACAO", "EMAIL", "REUNIAO", "OUTRO"], { errorMap: () => ({ message: "Escolha o tipo da tarefa." }) }),
  descricao: z.string().trim().max(2000, "A descrição deve ter até 2000 caracteres.").optional(),
  dataCivil: DataCivilSchema.nullish(),
  hora: HoraSchema.nullish(),
  duracaoMin: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)], { errorMap: () => ({ message: "Escolha uma duração válida." }) }).optional(),
  prioridade: PrioridadeTarefaD10Schema.optional(),
  lembreteAntecedenciaMin: LembreteTarefaD10Schema.nullish(),
  notificarUsuarioIds: CamposAdicionaisTarefaD10Schema.shape.notificarUsuarioIds,
  recorrencia: RecorrenciaTarefaSchema.optional(),
  responsavelId: z.string().min(1).nullish(),
  leadId: z.string().min(1).optional(),
  pessoaId: z.string().min(1).optional(),
  alunoId: z.string().min(1).optional(),
  matriculaId: z.string().min(1).optional(),
});
const CriarTarefaSchema = CamposTarefaSchema.extend({
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
  atendimentoId: z.string().min(1).optional(),
});


export async function escopoTarefas(usuario: UsuarioSessao, equipe: boolean): Promise<Prisma.TarefaWhereInput> {
  if (!usuario?.id) return { id: "__sem_acesso__" };
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  const ou: Prisma.TarefaWhereInput[] = [{ responsavelId: usuario.id }];
  const setores = setoresDoUsuario(usuario.papeis);
  if (setores.length) ou.push({ responsavelId: null, setor: { in: setores } });
  if (equipe && capacidadesCrm(usuario.papeis).has("tarefas.equipe")) {
    ou.push({ responsavel: { is: { gerenteComercialId: usuario.id } } });
  }
  return { OR: ou };
}

function revalidar() {
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}


async function carregarVisivel(tx: Prisma.TransactionClient, autor: UsuarioSessao, id: string) {
  const equipe = capacidadesCrm(autor.papeis).has("tarefas.equipe");
  const t = await tx.tarefa.findFirst({ where: { AND: [{ id }, await escopoTarefas(autor, equipe)] } });
  if (!t) throw new ErroRegra(MSG_NAO_ENCONTRADA);
  return t;
}

export async function criarTarefa(i: TarefaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const { chaveIdempotencia, ...d } = CriarTarefaSchema.parse(i);
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    const id = await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "TarefaCriada", agregadoTipo: "Tarefa", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outros dados. Recarregue a página e confira se a tarefa já aparece antes de repetir.",
        });
        if (repetido){
          if(d.recorrencia!==undefined||d.notificarUsuarioIds!==undefined||d.prioridade==="BAIXA"||d.lembreteAntecedenciaMin===15||d.lembreteAntecedenciaMin===1440){
            const atual=await tx.usuario.findUnique({where:{id:autor.id}});
            if(!atual?.ativo||apenasPortal(atual))throw new ErroRegra("Sua sessão não está mais ativa.");
            exigirCapacidadeCrm(atual,"tarefas.ver");
            await carregarVisivel(tx,atual,repetido.agregadoId);
          }
          return repetido.agregadoId;
        }
      }
      const fuso = await carregarFusoInstitucionalTx(tx);
      if (!fuso) throw new ErroRegra("Configure o fuso institucional da escola antes de criar tarefas.");
      return (await criarTarefaTx(tx, autor, d, fuso, marca)).id;
    }).catch(erroContencaoNotificadosTarefaD10);
    revalidar();
    return { id };
  });
}

export async function editarTarefa(id: string, versao: number, i: Partial<TarefaInput>): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const d = CamposTarefaSchema.partial().parse(i);
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      await editarTarefaTx(tx, autor, t, versao, d);
    }).catch(erroContencaoNotificadosTarefaD10);
    revalidar();
  });
}

const DecisaoMensagem = z.enum(["cancelar", "manter"]).optional();
export async function concluirTarefa(id: string, versao: number, resultado?: string, mensagemAgendada?: DecisaoMensagemAgendada): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const texto = z.string().trim().max(2000, "O resultado deve ter até 2000 caracteres.").optional().parse(resultado) || null;
    const decisao = DecisaoMensagem.parse(mensagemAgendada);
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      await concluirTarefaTx({ tx, autor, tarefa: t, versao }, texto, decisao);
    });
    revalidar();
  });
}

export async function reabrirTarefa(id: string, versao: number): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      await reabrirTarefaTx({ tx, autor, tarefa: t, versao });
    });
    revalidar();
  });
}

export async function reagendarTarefa(id: string, versao: number, q: { dataCivil: string | null; hora: string | null }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const dados = z.object({ dataCivil: DataCivilSchema.nullable(), hora: HoraSchema.nullable() }).parse(q);
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ser reagendadas.");
      const antecedencia = dados.dataCivil && dados.hora ? t.lembreteAntecedenciaMin : null;
      const novo = agendamentoTarefa(dados.dataCivil, dados.hora, t.fusoOrigem, antecedencia);
      await reagendarTarefaTx({ tx, autor, tarefa: t, versao }, { ...novo, lembreteAntecedenciaMin: antecedencia });
    });
    revalidar();
  });
}

export async function cancelarTarefa(id: string, versao: number, motivo: string, mensagemAgendada?: DecisaoMensagemAgendada): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const m = z.string().trim().min(1, "Informe o motivo do cancelamento.").max(500, "O motivo deve ter até 500 caracteres.").parse(motivo);
    const decisao = DecisaoMensagem.parse(mensagemAgendada);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id = ${id} FOR UPDATE`;
      const t = await carregarVisivel(tx, autor, id);
      await cancelarTarefaTx({ tx, autor, tarefa: t, versao }, m, decisao);
    });
    revalidar();
  });
}

export async function assumirTarefa(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ser assumidas.");
      if (t.responsavelId) throw new ErroRegra("Esta tarefa já tem responsável.");
      const r = await tx.tarefa.updateMany({
        where: { id, responsavelId: null, status: "ABERTA" },
        data: { responsavelId: autor.id, versao: { increment: 1 } },
      });
      if (r.count === 0) throw new ErroRegra("Esta tarefa já foi assumida por outra pessoa.");
      await registrarEvento(tx, { tipo: "TarefaAssumida", agregadoTipo: "Tarefa", agregadoId: id, autorId: autor.id, payload: { responsavelId: autor.id } });
    });
    revalidar();
  });
}
