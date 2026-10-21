import { revalidatePath } from "next/cache";
import { Papel, type FinalidadeAtendimentoWhatsApp, type Prisma, type PrioridadeTarefa, type TipoTarefa } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { instanteDaGrade } from "@/server/agenda/grade";
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
  lembreteAntecedenciaMin?: 0 | 10 | 30 | 60 | null;
  responsavelId?: string | null;
  leadId?: string;
  pessoaId?: string;
  alunoId?: string;
  matriculaId?: string;
  /** Só na criação pela tela (#166): a mesma chave até o sucesso; o reenvio devolve a tarefa já criada. */
  chaveIdempotencia?: string;
};

const MSG_VERSAO = "Esta tarefa foi alterada por outra pessoa. Recarregue.";
const MSG_FORA_CARTEIRA = "Oportunidade fora da sua carteira.";
const MSG_NAO_ENCONTRADA = "Tarefa não encontrada.";

const DataCivilSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, "Informe uma data válida.");
const HoraSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido (HH:MM).");

const CamposSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título da tarefa.").max(200, "O título deve ter até 200 caracteres."),
  tipo: z.enum(["WHATSAPP", "LIGACAO", "EMAIL", "REUNIAO", "OUTRO"], { errorMap: () => ({ message: "Escolha o tipo da tarefa." }) }),
  descricao: z.string().trim().max(2000, "A descrição deve ter até 2000 caracteres.").optional(),
  dataCivil: DataCivilSchema.nullish(),
  hora: HoraSchema.nullish(),
  duracaoMin: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)], { errorMap: () => ({ message: "Escolha uma duração válida." }) }).optional(),
  prioridade: z.enum(["NORMAL", "ALTA"]).optional(),
  lembreteAntecedenciaMin: z.union([z.literal(0), z.literal(10), z.literal(30), z.literal(60)], { errorMap: () => ({ message: "Escolha um lembrete válido." }) }).nullish(),
  responsavelId: z.string().min(1).nullish(),
  leadId: z.string().min(1).optional(),
  pessoaId: z.string().min(1).optional(),
  alunoId: z.string().min(1).optional(),
  matriculaId: z.string().min(1).optional(),
});
// A chave só existe na criação: `editarTarefa` continua com `CamposSchema.partial()`, sem ela.
const CriarTarefaSchema = CamposSchema.extend({ chaveIdempotencia: ChaveIdempotenciaSchema.optional() });

const CANAL_POR_TIPO: Partial<Record<TipoTarefa, string>> = {
  WHATSAPP: "WHATSAPP",
  LIGACAO: "LIGACAO",
  EMAIL: "EMAIL",
  REUNIAO: "PRESENCIAL",
};

/**
 * Escopo de leitura das tarefas: as minhas, mais a fila (sem responsável) dos meus setores.
 * Com `equipe` e a capacidade `tarefas.equipe`, entram as dos responsáveis cujo `gerenteComercialId` sou eu.
 * Administrador vê tudo.
 */
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

function ehAdmin(u: UsuarioSessao) {
  return u.papeis.includes(Papel.ADMINISTRADOR);
}

function agendamento(dataCivil: string | null, hora: string | null, fuso: string, antecedencia: number | null) {
  if (!dataCivil && hora) throw new ErroRegra("Informe a data para definir o horário.");
  if (!dataCivil) return { dataCivil: null, inicioEm: null, lembrarEm: null };
  if (!hora) return { dataCivil, inicioEm: null, lembrarEm: null };
  let inicioEm: Date;
  try {
    inicioEm = instanteDaGrade(dataCivil, hora, fuso);
  } catch {
    throw new ErroRegra("Esse horário não existe no fuso da escola. Escolha outro.");
  }
  const lembrarEm = antecedencia === null ? null : new Date(inicioEm.getTime() - antecedencia * 60000);
  return { dataCivil, inicioEm, lembrarEm };
}

async function validarVinculos(tx: Prisma.TransactionClient, autor: UsuarioSessao, i: { leadId?: string; pessoaId?: string; alunoId?: string; matriculaId?: string }) {
  if (i.leadId) {
    const ok = await tx.oportunidade.findFirst({ where: { AND: [{ id: i.leadId }, await escopoComercialAtual(autor, tx)] }, select: { id: true } });
    if (!ok) throw new ErroRegra(MSG_FORA_CARTEIRA);
  }
  if (i.pessoaId && !(await tx.pessoa.findUnique({ where: { id: i.pessoaId }, select: { id: true } }))) throw new ErroRegra("Pessoa não encontrada.");
  if (i.alunoId && !(await tx.aluno.findUnique({ where: { id: i.alunoId }, select: { id: true } }))) throw new ErroRegra("Aluno não encontrado.");
  if (i.matriculaId && !(await tx.matricula.findUnique({ where: { id: i.matriculaId }, select: { id: true } }))) throw new ErroRegra("Matrícula não encontrada.");
}

/** Define quem fica com a tarefa e o setor. Sem `tarefas.equipe`, é sempre o próprio usuário. */
async function resolverResponsavel(
  tx: Prisma.TransactionClient,
  autor: UsuarioSessao,
  pedido: string | null | undefined,
): Promise<{ responsavelId: string | null; setor: FinalidadeAtendimentoWhatsApp }> {
  const setoresAutor = setoresDoUsuario(autor.papeis);
  const equipe = capacidadesCrm(autor.papeis).has("tarefas.equipe");
  if (!equipe || pedido === undefined || pedido === autor.id) {
    if (!setoresAutor.length) throw new ErroRegra("Seu perfil não tem setor para criar tarefas.");
    return { responsavelId: autor.id, setor: setoresAutor[0] };
  }
  if (pedido === null) {
    if (!setoresAutor.length) throw new ErroRegra("Seu perfil não tem setor para criar tarefas.");
    return { responsavelId: null, setor: setoresAutor[0] };
  }
  const alvo = await tx.usuario.findUnique({ where: { id: pedido }, select: { id: true, ativo: true, papeis: true, gerenteComercialId: true } });
  if (!alvo || !alvo.ativo) throw new ErroRegra("Responsável não encontrado.");
  if (!ehAdmin(autor) && alvo.gerenteComercialId !== autor.id) throw new ErroRegra("Você só pode atribuir tarefas à sua equipe.");
  const setoresAlvo = setoresDoUsuario(alvo.papeis);
  if (!setoresAlvo.length) throw new ErroRegra("Esse responsável não tem setor para receber tarefas.");
  return { responsavelId: alvo.id, setor: setoresAlvo[0] };
}

function revalidar() {
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}

type TarefaAtual = Awaited<ReturnType<typeof carregarVisivel>>;
async function carregarVisivel(tx: Prisma.TransactionClient, autor: UsuarioSessao, id: string) {
  const equipe = capacidadesCrm(autor.papeis).has("tarefas.equipe");
  const t = await tx.tarefa.findFirst({ where: { AND: [{ id }, await escopoTarefas(autor, equipe)] } });
  if (!t) throw new ErroRegra(MSG_NAO_ENCONTRADA);
  return t;
}

/** Escrita com versão otimista: 0 linhas = alguém alterou antes; senão incrementa a versão. */
async function gravar(tx: Prisma.TransactionClient, t: TarefaAtual, versao: number, status: "ABERTA" | "CONCLUIDA", data: Prisma.TarefaUncheckedUpdateManyInput) {
  const r = await tx.tarefa.updateMany({ where: { id: t.id, versao, status }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroRegra(MSG_VERSAO);
}

async function espelharNoLead(tx: Prisma.TransactionClient, t: { id: string; leadId: string | null }, tipo: string, autorId: string, payload: Prisma.InputJsonValue) {
  if (!t.leadId) return;
  await registrarEvento(tx, { tipo, agregadoTipo: "Lead", agregadoId: t.leadId, autorId, payload });
}

export async function criarTarefa(i: TarefaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const { chaveIdempotencia, ...d } = CriarTarefaSchema.parse(i);
    // Idempotência (#166): a chave e o hash da entrada vão no payload do `TarefaCriada` da tarefa. O lembrete
    // mora na própria tarefa (`lembrarEm`), então o reenvio não agenda um segundo aviso.
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    const id = await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "TarefaCriada", agregadoTipo: "Tarefa", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outros dados. Recarregue a página e confira se a tarefa já aparece antes de repetir.",
        });
        if (repetido) return repetido.agregadoId;
      }
      const fuso = await carregarFusoInstitucionalTx(tx);
      if (!fuso) throw new ErroRegra("Configure o fuso institucional da escola antes de criar tarefas.");
      const dataCivil = d.dataCivil ?? null;
      const hora = d.hora ?? null;
      const antecedencia = d.lembreteAntecedenciaMin ?? null;
      if (antecedencia !== null && !(dataCivil && hora)) throw new ErroRegra("O lembrete exige data e horário.");
      const quando = agendamento(dataCivil, hora, fuso, antecedencia);
      await validarVinculos(tx, autor, d);
      const dono = await resolverResponsavel(tx, autor, d.responsavelId);
      const t = await tx.tarefa.create({
        data: {
          titulo: d.titulo,
          descricao: d.descricao || null,
          tipo: d.tipo,
          setor: dono.setor,
          prioridade: d.prioridade ?? "NORMAL",
          dataCivil: quando.dataCivil,
          inicioEm: quando.inicioEm,
          duracaoMin: d.duracaoMin ?? 30,
          fusoOrigem: fuso,
          lembreteAntecedenciaMin: antecedencia,
          lembrarEm: quando.lembrarEm,
          responsavelId: dono.responsavelId,
          criadorId: autor.id,
          leadId: d.leadId ?? null,
          pessoaId: d.pessoaId ?? null,
          alunoId: d.alunoId ?? null,
          matriculaId: d.matriculaId ?? null,
        },
      });
      const payload = { titulo: t.titulo, tipo: t.tipo, setor: t.setor, responsavelId: t.responsavelId, dataCivil: t.dataCivil, hora };
      await registrarEvento(tx, { tipo: "TarefaCriada", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: autor.id, payload: { ...payload, ...marca } });
      await espelharNoLead(tx, t, "TarefaCriada", autor.id, { tarefaId: t.id, ...payload });
      return t.id;
    });
    revalidar();
    return { id };
  });
}

export async function editarTarefa(id: string, versao: number, i: Partial<TarefaInput>): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const d = CamposSchema.partial().parse(i);
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ser editadas.");
      if (t.versao !== versao) throw new ErroRegra(MSG_VERSAO);
      await validarVinculos(tx, autor, d);
      const data: Prisma.TarefaUncheckedUpdateManyInput = {};
      const mudou: Record<string, unknown> = {};
      const set = <K extends keyof Prisma.TarefaUncheckedUpdateManyInput>(k: K, v: Prisma.TarefaUncheckedUpdateManyInput[K], antes: unknown) => {
        data[k] = v;
        mudou[k] = { de: antes ?? null, para: (v as unknown) ?? null };
      };
      if (d.titulo !== undefined) set("titulo", d.titulo, t.titulo);
      if (d.tipo !== undefined) set("tipo", d.tipo, t.tipo);
      if (d.descricao !== undefined) set("descricao", d.descricao || null, t.descricao);
      if (d.prioridade !== undefined) set("prioridade", d.prioridade, t.prioridade);
      if (d.duracaoMin !== undefined) set("duracaoMin", d.duracaoMin, t.duracaoMin);
      if (d.leadId !== undefined) set("leadId", d.leadId, t.leadId);
      if (d.pessoaId !== undefined) set("pessoaId", d.pessoaId, t.pessoaId);
      if (d.alunoId !== undefined) set("alunoId", d.alunoId, t.alunoId);
      if (d.matriculaId !== undefined) set("matriculaId", d.matriculaId, t.matriculaId);
      if (d.responsavelId !== undefined) {
        const dono = await resolverResponsavel(tx, autor, d.responsavelId);
        set("responsavelId", dono.responsavelId, t.responsavelId);
        set("setor", dono.setor, t.setor);
      }
      if (d.dataCivil !== undefined || d.hora !== undefined || d.lembreteAntecedenciaMin !== undefined) {
        const dataCivil = d.dataCivil !== undefined ? d.dataCivil : t.dataCivil;
        const hora = d.hora !== undefined ? d.hora : t.inicioEm ? horaLocal(t.inicioEm, t.fusoOrigem) : null;
        const antecedencia = d.lembreteAntecedenciaMin !== undefined ? d.lembreteAntecedenciaMin : t.lembreteAntecedenciaMin;
        if (antecedencia !== null && !(dataCivil && hora)) throw new ErroRegra("O lembrete exige data e horário.");
        const q = agendamento(dataCivil, hora, t.fusoOrigem, antecedencia);
        const mesmoInstante = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
        if (q.dataCivil !== t.dataCivil) set("dataCivil", q.dataCivil, t.dataCivil);
        if (!mesmoInstante(q.inicioEm, t.inicioEm)) set("inicioEm", q.inicioEm, t.inicioEm);
        if (antecedencia !== t.lembreteAntecedenciaMin) set("lembreteAntecedenciaMin", antecedencia, t.lembreteAntecedenciaMin);
        // Só um lembrete novo rearma o disparo: reenviar o mesmo agendamento não notifica de novo.
        if (!mesmoInstante(q.lembrarEm, t.lembrarEm)) {
          set("lembrarEm", q.lembrarEm, t.lembrarEm);
          data.lembreteDisparadoEm = null;
        }
      }
      await gravar(tx, t, versao, "ABERTA", data);
      await registrarEvento(tx, { tipo: "TarefaEditada", agregadoTipo: "Tarefa", agregadoId: id, autorId: autor.id, payload: { campos: mudou as Prisma.InputJsonObject, versao: versao + 1 } });
    });
    revalidar();
  });
}

function horaLocal(inicio: Date, fuso: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(inicio);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("hour")}:${g("minute")}`;
}

export async function concluirTarefa(id: string, versao: number, resultado?: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const texto = z.string().trim().max(2000, "O resultado deve ter até 2000 caracteres.").optional().parse(resultado) || null;
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ser concluídas.");
      await gravar(tx, t, versao, "ABERTA", { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorId: autor.id, resultado: texto });
      await registrarEvento(tx, { tipo: "TarefaConcluida", agregadoTipo: "Tarefa", agregadoId: id, autorId: autor.id, payload: { resultado: texto } });
      await espelharNoLead(tx, t, "TarefaConcluida", autor.id, { tarefaId: id, titulo: t.titulo, resultado: texto });
      const canal = CANAL_POR_TIPO[t.tipo];
      if (t.leadId && texto && canal) {
        // Contato real com o cliente: entra no histórico da oportunidade como interação.
        await registrarEvento(tx, {
          tipo: "InteracaoRegistrada",
          agregadoTipo: "Lead",
          agregadoId: t.leadId,
          autorId: autor.id,
          payload: { canal, nota: texto, resultado: texto, tarefaId: id },
        });
      }
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
      if (t.status !== "CONCLUIDA") throw new ErroRegra("Só tarefas concluídas podem ser reabertas.");
      await gravar(tx, t, versao, "CONCLUIDA", { status: "ABERTA", concluidaEm: null, concluidaPorId: null, resultado: null });
      await registrarEvento(tx, { tipo: "TarefaReaberta", agregadoTipo: "Tarefa", agregadoId: id, autorId: autor.id, payload: { resultadoAnterior: t.resultado } });
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
      const novo = agendamento(dados.dataCivil, dados.hora, t.fusoOrigem, antecedencia);
      await gravar(tx, t, versao, "ABERTA", {
        dataCivil: novo.dataCivil,
        inicioEm: novo.inicioEm,
        lembrarEm: novo.lembrarEm,
        lembreteAntecedenciaMin: antecedencia,
        lembreteDisparadoEm: null,
      });
      await registrarEvento(tx, {
        tipo: "TarefaReagendada",
        agregadoTipo: "Tarefa",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: { dataCivil: t.dataCivil, inicioEm: t.inicioEm?.toISOString() ?? null }, para: { dataCivil: novo.dataCivil, inicioEm: novo.inicioEm?.toISOString() ?? null } },
      });
    });
    revalidar();
  });
}

export async function cancelarTarefa(id: string, versao: number, motivo: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    const m = z.string().trim().min(1, "Informe o motivo do cancelamento.").max(500, "O motivo deve ter até 500 caracteres.").parse(motivo);
    await prisma.$transaction(async (tx) => {
      const t = await carregarVisivel(tx, autor, id);
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ser canceladas.");
      await gravar(tx, t, versao, "ABERTA", { status: "CANCELADA", canceladaEm: new Date(), motivoCancelamento: m, lembrarEm: null });
      await registrarEvento(tx, { tipo: "TarefaCancelada", agregadoTipo: "Tarefa", agregadoId: id, autorId: autor.id, payload: { motivo: m } });
    });
    revalidar();
  });
}

/** Pega para si uma tarefa da fila do setor (sem responsável). Dois cliques simultâneos: só um vence. */
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
