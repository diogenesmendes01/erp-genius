import { revalidatePath } from "next/cache";
import { Papel, type Prisma, type StatusIntencao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento, type AgregadoTipo } from "@/server/_shared/evento";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { instanteDaGrade } from "@/server/agenda/grade";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { atendimentoVisivel, garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { exigirAgendamentoNaJanela } from "@/server/whatsapp/janela-agendamento";
import { destinatarioAtualDoAtendimento } from "@/server/whatsapp/destinatario-atual";
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
  /** Só no agendamento pelo atendimento (#166): a mesma chave até o sucesso; o reenvio devolve a mensagem já agendada. */
  chaveIdempotencia?: string;
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
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
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
    // A marca mora no `MensagemAgendada` do atendimento; o agendamento pelo CRM nem sempre grava esse Evento.
    if (d.chaveIdempotencia && !d.atendimentoId) throw new ErroRegra("Chave de idempotência só no agendamento pelo atendimento.");
    // Idempotência (#166): a chave e o hash da entrada vão no payload do `MensagemAgendada`; o reenvio devolve
    // a mesma intenção em vez de agendar um segundo envio ao contato.
    const marca = d.atendimentoId
      ? marcaIdempotencia(d.chaveIdempotencia, {
        atendimentoId: d.atendimentoId, numeroId: d.numeroId, texto: d.texto,
        agendadaPara: new Date(d.agendadaPara).toISOString(), validaAte: d.validaAte ? new Date(d.validaAte).toISOString() : null,
      })
      : null;
    const alvoRepeticao = marca && {
      tipo: "MensagemAgendada", agregadoTipo: "AtendimentoWhatsApp", autorId: autor.id, marca,
      mensagemConflito: "Esta tentativa já foi usada com outra mensagem ou outro horário. Confira os agendamentos do atendimento antes de repetir.",
    };
    const intencaoDe = (e: { payload: unknown }) => String((e.payload as { intencaoId?: unknown }).intencaoId);
    if (alvoRepeticao) {
      // C3 da R2 do #267: a repetição é procurada antes das validações de horário, janela, encerramento e
      // opt-out. O reenvio tardio da tentativa já gravada devolve a mesma mensagem em vez de um erro. A busca
      // se repete dentro da transação de criação, que é quem serializa os envios simultâneos.
      const repetido = await prisma.$transaction((tx) => repeticaoIdempotente(tx, alvoRepeticao));
      if (repetido) return { id: intencaoDe(repetido) };
    }
    const quando = futuro(d.agendadaPara);
    const validaAte = d.validaAte ? new Date(d.validaAte) : null;
    if (validaAte && validaAte.getTime() <= quando.getTime()) throw new ErroRegra("A validade deve ser depois do horário agendado.");
    // D12 (#202 C4): a mensagem agendada sai como decisão humana e pula a janela do despachante; por isso o
    // horário de silêncio é barrado aqui, no fuso da escola, antes de gravar.
    await exigirAgendamentoNaJanela(quando);

    if (d.atendimentoId) {
      const a = await atendimentoVisivel(autor, d.atendimentoId, true);
      if (!a || a.encerradoEm) throw new ErroRegra("Atendimento não encontrado.");
      if (a.numeroId !== d.numeroId) throw new ErroRegra("Número de envio indisponível.");
      if (a.contato.optOutEm) throw new ErroRegra("Contato pediu para não receber mensagens.");
      const id = await prisma.$transaction(async (tx) => {
        if (alvoRepeticao) {
          const repetido = await repeticaoIdempotente(tx, alvoRepeticao);
          if (repetido) return intencaoDe(repetido);
        }
        const m = await tx.intencaoMensagem.create({
          data: { numeroId: a.numeroId, atendimentoId: a.id, contatoId: a.contatoId, origem: "HUMANO", tipo: "TEXTO", corpoRenderizado: d.texto, agendadaPara: quando, validaAte, autorId: autor.id },
        });
        await registrarEvento(tx, { tipo: "MensagemAgendada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: autor.id, payload: { intencaoId: m.id, agendadaPara: quando.toISOString(), numeroId: a.numeroId, ...marca } });
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

      // D12 (#202 C3): o atendimento só nasce quando a mensagem sai (despachante, `abrirAtendimentoDaAgendada`).
      // Criar aqui punha um atendimento COMERCIAL na inbox dias antes do envio, mesmo que a mensagem fosse cancelada.
      const m = await tx.intencaoMensagem.create({
        data: {
          numeroId: numero.id,
          atendimentoId: null,
          contatoId: contato.id,
          origem: "HUMANO",
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

/** Intenção agendada pelo CRM que ainda espera o atendimento (D12, #202 C3): só a mensagem HUMANO avulsa. */
export type AgendadaSemAtendimento = {
  origem: string; agendadaPara: Date | null; atendimentoId: string | null; numeroId: string; contatoId: string; leadId: string | null;
  cobrancaId: string | null; passoComercial: string | null; avisoAlteracaoAgendaId: string | null;
};

export function esperaAtendimento(it: AgendadaSemAtendimento): boolean {
  return it.origem === "HUMANO" && it.agendadaPara != null && it.atendimentoId == null
    && !it.cobrancaId && !it.passoComercial && !it.avisoAlteracaoAgendaId;
}

/**
 * Na hora do envio, o autor ainda tem o que tinha ao agendar: o número de vendas (sem dono ou dele) e, se houver,
 * a oportunidade na carteira. Sem isso a intenção é cancelada sem abrir atendimento.
 */
export async function autorAindaPodeEnviarAgendada(autor: UsuarioSessao, it: AgendadaSemAtendimento, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<boolean> {
  const numero = await db.numeroWhatsApp.findFirst({ where: { AND: [{ id: it.numeroId }, numeroDoUsuario(autor)] }, select: { id: true } });
  if (!numero) return false;
  if (!it.leadId) return true;
  return !!await db.oportunidade.findFirst({ where: { AND: [{ id: it.leadId }, await escopoComercialAtual(autor, db)] }, select: { id: true } });
}

/**
 * Abre (ou reusa) o atendimento COMERCIAL da mensagem agendada no momento do envio (D12, #202 C3), dentro da
 * transação do claim do despachante, e liga a intenção a ele. Confere aqui, na mesma transação, o que a releitura
 * do despachante conferiria depois (R1 do #254, C3): o destinatário atual do atendimento e o acesso do autor.
 * Devolve o motivo da recusa; o chamador desfaz a transação, e nada fica criado (nem atendimento, nem conversa).
 */
export async function abrirAtendimentoDaAgendada(
  tx: Prisma.TransactionClient, autor: UsuarioSessao, intencaoId: string, it: AgendadaSemAtendimento,
): Promise<{ atendimentoId: string } | { recusa: "atendimento_sem_acesso" | "destinatario_alterado" }> {
  if (!await autorAindaPodeEnviarAgendada(autor, it, tx)) return { recusa: "atendimento_sem_acesso" };
  const atendimento = await garantirAtendimento(tx, { numeroId: it.numeroId, contatoId: it.contatoId, finalidade: "COMERCIAL", leadId: it.leadId });
  const contato = await tx.contatoWhatsApp.findUniqueOrThrow({ where: { id: it.contatoId }, select: { telefoneE164: true, responsavelId: true, alunoId: true } });
  if (!await destinatarioAtualDoAtendimento({ ...atendimento, conversa: { contato } }, tx)) return { recusa: "destinatario_alterado" };
  if (!await atendimentoVisivel(autor, atendimento.id, true, tx)) return { recusa: "atendimento_sem_acesso" };
  const r = await tx.intencaoMensagem.updateMany({ where: { id: intencaoId, atendimentoId: null }, data: { atendimentoId: atendimento.id } });
  return r.count === 1 ? { atendimentoId: atendimento.id } : { recusa: "atendimento_sem_acesso" };
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

type Montagem = { data: Prisma.IntencaoMensagemUpdateManyMutationInput; payload: Prisma.InputJsonValue };

async function alterar(
  id: string,
  tipoEvento: string,
  montar: (m: { validaAte: Date | null }) => Montagem | Promise<Montagem>,
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
      const { data, payload } = await montar(m);
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
  return alterar(id, "MensagemReagendada", async (m) => {
    const quando = futuro(InstanteSchema.parse(agendadaPara));
    dataFutura(m, quando);
    // Mesma trava do agendamento (D12): a nova data não pode cair no horário de silêncio da escola.
    await exigirAgendamentoNaJanela(quando);
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
