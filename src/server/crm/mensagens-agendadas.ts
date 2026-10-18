import { revalidatePath } from "next/cache";
import { Papel, type Prisma, type StatusIntencao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento, type AgregadoTipo } from "@/server/_shared/evento";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { instanteDaGrade } from "@/server/agenda/grade";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { atendimentoVisivel, garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { capacidadesCrm, exigirCapacidadeCrm } from "./permissoes";
import { escopoTarefas } from "./tarefas";
import { somarDiasDataCivil } from "./tarefas-regras";

/** Tarefa como a agenda a mostra (linha da tabela com o responsável). */
export type TarefaLista = Prisma.TarefaGetPayload<{ include: { responsavel: { select: { id: true; nome: true } } } }>;

export type ItemAgenda =
  | { tipo: "tarefa"; tarefa: TarefaLista }
  | { tipo: "mensagem"; id: string; texto: string; agendadaPara: Date; status: StatusIntencao; motivoFalha: string | null; nomeContato: string };

export type AgendarMensagemInput = {
  numeroId: string;
  texto: string;
  agendadaPara: string;
  validaAte?: string;
  tarefaId?: string;
  leadId?: string;
  pessoaId?: string;
  /** Agendamento pelo Inbox: o destino é o contato do atendimento e o número é o dele (o acesso vem do atendimento). */
  atendimentoId?: string;
  /** Quem originou o agendamento; a Aria agenda por `executarAcaoCrm`, dentro da transação dela. */
  origem?: "HUMANO" | "IA";
};

const MSG_FUTURO = "Escolha uma data e hora no futuro.";
const MSG_NAO_ENCONTRADA = "Mensagem não encontrada.";

const InstanteSchema = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Informe uma data e hora válidas.");
const AgendarSchema = z.object({
  numeroId: z.string().min(1, "Escolha o número de envio."),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4096, "A mensagem deve ter até 4096 caracteres."),
  agendadaPara: InstanteSchema,
  validaAte: InstanteSchema.optional(),
  tarefaId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  pessoaId: z.string().min(1).optional(),
  atendimentoId: z.string().min(1).optional(),
  origem: z.enum(["HUMANO", "IA"]).default("HUMANO"),
});

const ehAdmin = (u: UsuarioSessao) => u.papeis.includes(Papel.ADMINISTRADOR);

function numeroDoUsuario(usuario: UsuarioSessao): Prisma.NumeroWhatsAppWhereInput {
  return { finalidade: "VENDAS", ativo: true, OR: [{ donoId: null }, { donoId: usuario.id }] };
}

/** Números `VENDAS` sem dono ou do próprio usuário. */
export async function numerosParaAgendar(usuario: UsuarioSessao): Promise<{ id: string; rotulo: string }[]> {
  if (!usuario?.id) return [];
  return prisma.numeroWhatsApp.findMany({ where: numeroDoUsuario(usuario), select: { id: true, rotulo: true }, orderBy: { rotulo: "asc" } });
}

/** Mensagens agendadas pelo atendente: autor no escopo (o próprio; a equipe com `equipe`; admin vê tudo). */
function escopoAutores(usuario: UsuarioSessao, equipe: boolean): Prisma.IntencaoMensagemWhereInput {
  if (!usuario?.id) return { id: "__sem_acesso__" };
  if (ehAdmin(usuario)) return {};
  const ou: Prisma.IntencaoMensagemWhereInput[] = [{ autorId: usuario.id }];
  if (equipe && capacidadesCrm(usuario.papeis).has("tarefas.equipe")) ou.push({ autor: { is: { gerenteComercialId: usuario.id } } });
  return { OR: ou };
}

const baseAgendada: Prisma.IntencaoMensagemWhereInput = {
  origem: "HUMANO",
  agendadaPara: { not: null },
  passo: null,
  passoComercial: null,
};

function futuro(v: string, agora = new Date()): Date {
  const d = new Date(v);
  if (d.getTime() <= agora.getTime()) throw new ErroRegra(MSG_FUTURO);
  return d;
}

function aggregadoDe(m: { tarefaId: string | null; leadId: string | null; atendimentoId?: string | null; contato: { pessoaId: string | null } }): { agregadoTipo: AgregadoTipo; agregadoId: string } | null {
  if (m.tarefaId) return { agregadoTipo: "Tarefa", agregadoId: m.tarefaId };
  if (m.leadId) return { agregadoTipo: "Lead", agregadoId: m.leadId };
  if (m.atendimentoId) return { agregadoTipo: "AtendimentoWhatsApp", agregadoId: m.atendimentoId };
  if (m.contato.pessoaId) return { agregadoTipo: "Pessoa", agregadoId: m.contato.pessoaId };
  return null;
}

export async function agendarMensagem(i: AgendarMensagemInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const d = AgendarSchema.parse(i);
    if (!d.atendimentoId) exigirCapacidadeCrm(autor, "tarefas.ver");
    const quando = futuro(d.agendadaPara);
    const validaAte = d.validaAte ? new Date(d.validaAte) : null;
    if (validaAte && validaAte.getTime() <= quando.getTime()) throw new ErroRegra("A validade deve ser depois do horário agendado.");

    if (d.atendimentoId) {
      const a = await atendimentoVisivel(autor, d.atendimentoId, true);
      if (!a || a.encerradoEm) throw new ErroRegra("Atendimento não encontrado.");
      if (a.numeroId !== d.numeroId) throw new ErroRegra("Número de envio indisponível.");
      if (a.contato.optOutEm) throw new ErroRegra("Contato pediu para não receber mensagens.");
      const id = await prisma.$transaction(async (tx) => {
        const m = await tx.intencaoMensagem.create({
          data: { numeroId: a.numeroId, atendimentoId: a.id, contatoId: a.contatoId, origem: d.origem, tipo: "TEXTO", corpoRenderizado: d.texto, agendadaPara: quando, validaAte, autorId: autor.id },
        });
        await registrarEvento(tx, { tipo: "MensagemAgendada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: autor.id, payload: { intencaoId: m.id, agendadaPara: quando.toISOString(), numeroId: a.numeroId } });
        return m.id;
      });
      revalidar();
      return { id };
    }

    const id = await prisma.$transaction(async (tx) => {
      const numero = await tx.numeroWhatsApp.findFirst({ where: { AND: [{ id: d.numeroId }, numeroDoUsuario(autor)] }, select: { id: true } });
      if (!numero) throw new ErroRegra("Número de envio indisponível.");

      let leadId = d.leadId ?? null;
      let pessoaId = d.pessoaId ?? null;
      if (d.tarefaId) {
        const equipe = capacidadesCrm(autor.papeis).has("tarefas.equipe");
        const t = await tx.tarefa.findFirst({ where: { AND: [{ id: d.tarefaId }, await escopoTarefas(autor, equipe)] }, select: { leadId: true, pessoaId: true } });
        if (!t) throw new ErroRegra("Tarefa não encontrada.");
        leadId = leadId ?? t.leadId;
        pessoaId = pessoaId ?? t.pessoaId;
      }
      let telefoneLead: string | null = null;
      if (leadId) {
        const op = await tx.oportunidade.findFirst({ where: { AND: [{ id: leadId }, await escopoComercialAtual(autor, tx)] }, select: { pessoaId: true, telefoneE164: true } });
        if (!op) throw new ErroRegra("Oportunidade fora da sua carteira.");
        pessoaId = pessoaId ?? op.pessoaId;
        telefoneLead = op.telefoneE164;
      }
      if (!leadId && !pessoaId) throw new ErroRegra("Escolha o contato da mensagem.");
      if (pessoaId && !(await tx.pessoa.findUnique({ where: { id: pessoaId }, select: { id: true } }))) throw new ErroRegra("Pessoa não encontrada.");

      const ou: Prisma.ContatoWhatsAppWhereInput[] = [];
      if (pessoaId) ou.push({ pessoaId });
      if (leadId) ou.push({ leadId });
      if (telefoneLead) ou.push({ telefoneE164: telefoneLead });
      const contatos = await tx.contatoWhatsApp.findMany({ where: { OR: ou }, orderBy: { criadoEm: "asc" } });
      if (contatos.length === 0) throw new ErroRegra("Este contato não tem WhatsApp cadastrado.");
      const contato = contatos.find((c) => !c.optOutEm);
      if (!contato) throw new ErroRegra("Contato pediu para não receber mensagens.");

      const atendimento = await garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId });
      const m = await tx.intencaoMensagem.create({
        data: {
          numeroId: numero.id,
          atendimentoId: atendimento.id,
          contatoId: contato.id,
          origem: d.origem,
          tipo: "TEXTO",
          corpoRenderizado: d.texto,
          agendadaPara: quando,
          validaAte,
          tarefaId: d.tarefaId ?? null,
          leadId,
          autorId: autor.id,
        },
      });
      const alvo = aggregadoDe({ tarefaId: m.tarefaId, leadId: m.leadId, contato: { pessoaId: contato.pessoaId } });
      if (alvo) {
        await registrarEvento(tx, { tipo: "MensagemAgendada", ...alvo, autorId: autor.id, payload: { intencaoId: m.id, agendadaPara: quando.toISOString(), numeroId: numero.id } });
      }
      return m.id;
    });
    revalidar();
    return { id };
  });
}

/** Por que a mensagem não pôde ser alterada (ela não está mais PENDENTE/ADIADA ou não é do escopo). */
function recusa(status: StatusIntencao | undefined): ErroRegra {
  switch (status) {
    case undefined: return new ErroRegra(MSG_NAO_ENCONTRADA);
    case "ENVIANDO": return new ErroRegra("A mensagem já está sendo enviada.");
    case "DESPACHADA":
    case "SIMULADA": return new ErroRegra("A mensagem já foi enviada.");
    case "CANCELADA": return new ErroRegra("A mensagem já foi cancelada.");
    case "FALHOU": return new ErroRegra("O envio da mensagem falhou e ela não pode mais ser alterada.");
    default: return new ErroRegra("A mensagem mudou de situação. Recarregue.");
  }
}

async function alterar(
  id: string,
  tipoEvento: string,
  montar: (m: { validaAte: Date | null }) => { data: Prisma.IntencaoMensagemUpdateManyMutationInput; payload: Prisma.InputJsonValue },
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    await prisma.$transaction(async (tx) => {
      const m = await tx.intencaoMensagem.findFirst({
        where: { AND: [{ id }, baseAgendada, escopoAutores(autor, true)] },
        select: { status: true, tarefaId: true, leadId: true, atendimentoId: true, validaAte: true, contato: { select: { pessoaId: true } } },
      });
      if (!m) throw recusa(undefined);
      if (m.status !== "PENDENTE" && m.status !== "ADIADA") throw recusa(m.status);
      const { data, payload } = montar(m);
      const r = await tx.intencaoMensagem.updateMany({ where: { id, status: { in: ["PENDENTE", "ADIADA"] } }, data });
      if (r.count === 0) {
        const atual = await tx.intencaoMensagem.findUnique({ where: { id }, select: { status: true } });
        throw recusa(atual?.status);
      }
      const alvo = aggregadoDe(m);
      if (alvo) await registrarEvento(tx, { tipo: tipoEvento, ...alvo, autorId: autor.id, payload: { intencaoId: id, ...(payload as object) } });
    });
    revalidar();
  });
}

function dataFutura(m: { validaAte: Date | null }, quando: Date) {
  if (m.validaAte && m.validaAte.getTime() <= quando.getTime()) throw new ErroRegra("A nova data passa da validade da mensagem.");
}

export async function reagendarMensagem(id: string, agendadaPara: string): Promise<Resultado> {
  return alterar(id, "MensagemReagendada", (m) => {
    const quando = futuro(InstanteSchema.parse(agendadaPara));
    dataFutura(m, quando);
    return { data: { agendadaPara: quando, status: "PENDENTE", despacharAposEm: null, motivoFalha: null }, payload: { agendadaPara: quando.toISOString() } };
  });
}

/** Vira `agendadaPara = agora`; o despachante envia no próximo ciclo, com todos os guard-rails. */
export async function enviarAgora(id: string): Promise<Resultado> {
  return alterar(id, "MensagemReagendada", (m) => {
    const agora = new Date();
    dataFutura(m, agora);
    return { data: { agendadaPara: agora, status: "PENDENTE", despacharAposEm: null, motivoFalha: null }, payload: { agendadaPara: agora.toISOString(), enviarAgora: true } };
  });
}

export async function cancelarMensagemAgendada(id: string): Promise<Resultado> {
  return alterar(id, "MensagemAgendadaCancelada", () => ({
    data: { status: "CANCELADA", motivoFalha: "cancelada_pelo_autor" },
    payload: {},
  }));
}

/** Tarefas e mensagens agendadas do intervalo (datas civis, inclusive). Mensagem nunca fica em "Sem data". */
export async function listarItensAgenda(usuario: UsuarioSessao, intervalo: { de: string; ate: string }, equipe: boolean): Promise<ItemAgenda[]> {
  if (!usuario?.id) return [];
  const fuso = await prisma.$transaction((tx) => carregarFusoInstitucionalTx(tx));
  const tarefas = await prisma.tarefa.findMany({
    where: { AND: [await escopoTarefas(usuario, equipe), { dataCivil: { gte: intervalo.de, lte: intervalo.ate } }, { status: { not: "CANCELADA" } }] },
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: [{ dataCivil: "asc" }, { inicioEm: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }],
  });
  const itens: ItemAgenda[] = tarefas.map((tarefa) => ({ tipo: "tarefa", tarefa }));
  if (fuso) {
    const inicio = instanteDaGrade(intervalo.de, "00:00", fuso);
    const fim = instanteDaGrade(somarDiasDataCivil(intervalo.ate, 1), "00:00", fuso);
    const msgs = await prisma.intencaoMensagem.findMany({
      where: { AND: [baseAgendada, escopoAutores(usuario, equipe), { agendadaPara: { gte: inicio, lt: fim } }] },
      include: { contato: { include: { pessoa: { select: { nome: true } } } }, lead: { select: { nome: true } } },
      orderBy: { agendadaPara: "asc" },
    });
    for (const m of msgs) {
      itens.push({
        tipo: "mensagem",
        id: m.id,
        texto: m.corpoRenderizado,
        agendadaPara: m.agendadaPara as Date,
        status: m.status,
        motivoFalha: m.motivoFalha,
        nomeContato: m.contato.nomeExibicao ?? m.contato.pessoa?.nome ?? m.lead?.nome ?? m.contato.nomePerfil ?? m.contato.telefoneE164,
      });
    }
  }
  return itens;
}

function revalidar() {
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}
