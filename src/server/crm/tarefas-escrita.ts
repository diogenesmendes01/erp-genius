import { Papel, type FinalidadeAtendimentoWhatsApp, type Prisma, type Tarefa } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared/sessao";
import type { MarcaIdempotencia } from "@/server/_shared/idempotencia";
import { instanteDaGrade } from "@/server/agenda/grade";
import { capacidadesCrm, setoresDoUsuario } from "./permissoes";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import type { TarefaInput } from "./tarefas";
const MSG_VERSAO="Esta tarefa foi alterada por outra pessoa. Recarregue.";
const MSG_FORA_CARTEIRA="Oportunidade fora da sua carteira.";
function ehAdmin(u: UsuarioSessao) {
  return u.papeis.includes(Papel.ADMINISTRADOR);
}

export function agendamentoTarefa(dataCivil: string | null, hora: string | null, fuso: string, antecedencia: number | null) {
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

/** Escrita com versão otimista: 0 linhas = alguém alterou antes; senão incrementa a versão. */
async function gravar(tx: Prisma.TransactionClient, t: Tarefa, versao: number, status: "ABERTA" | "CONCLUIDA", data: Prisma.TarefaUncheckedUpdateManyInput, filtro?:Prisma.TarefaWhereInput) {
  const r = await tx.tarefa.updateMany({ where: filtro ? {AND:[{id:t.id,versao,status},filtro]} : { id: t.id, versao, status }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroRegra(MSG_VERSAO);
}

async function espelharNoLead(tx: Prisma.TransactionClient, t: { id: string; leadId: string | null }, tipo: string, autorId: string, payload: Prisma.InputJsonValue) {
  if (!t.leadId) return;
  await registrarEvento(tx, { tipo, agregadoTipo: "Lead", agregadoId: t.leadId, autorId, payload });
}


export async function criarTarefaTx(tx:Prisma.TransactionClient,autor:UsuarioSessao,d:Omit<TarefaInput,'chaveIdempotencia'>,fuso:string,marca:MarcaIdempotencia|null):Promise<Tarefa>{
      const dataCivil = d.dataCivil ?? null;
      const hora = d.hora ?? null;
      const antecedencia = d.lembreteAntecedenciaMin ?? null;
      if (antecedencia !== null && !(dataCivil && hora)) throw new ErroRegra("O lembrete exige data e horário.");
      const quando = agendamentoTarefa(dataCivil, hora, fuso, antecedencia);
      if (d.atendimentoId && !(await atendimentoVisivel(autor, d.atendimentoId, false, tx))) {
        throw new ErroRegra("Atendimento não encontrado.");
      }
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
          atendimentoId: d.atendimentoId ?? null,
        },
      });
      const payload = { titulo: t.titulo, tipo: t.tipo, setor: t.setor, responsavelId: t.responsavelId, dataCivil: t.dataCivil, hora, atendimentoId: t.atendimentoId };
      await registrarEvento(tx, { tipo: "TarefaCriada", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: autor.id, payload: { ...payload, ...marca } });
      await espelharNoLead(tx, t, "TarefaCriada", autor.id, { tarefaId: t.id, ...payload });
      return t;
}
export type OpcoesEdicaoTarefaTx={filtro?:Prisma.TarefaWhereInput;vinculo?:{leadId:string|null;pessoaId:string|null};agendamento?:{dataCivil:string|null;inicioEm:Date|null;lembrarEm:Date|null;lembreteAntecedenciaMin:number|null}};
export async function editarTarefaTx(tx:Prisma.TransactionClient,autor:UsuarioSessao,t:Tarefa,versao:number,d:Partial<TarefaInput>,opcoes:OpcoesEdicaoTarefaTx={}):Promise<void>{
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ser editadas.");
      if (t.versao !== versao) throw new ErroRegra(MSG_VERSAO);
      await validarVinculos(tx, autor, d);
      const data: Prisma.TarefaUncheckedUpdateManyInput = {};
      const mudou: Record<string, unknown> = {};
      const set = <K extends keyof Prisma.TarefaUncheckedUpdateManyInput>(k: K, v: Prisma.TarefaUncheckedUpdateManyInput[K], antes: unknown) => {
        data[k] = v;
        mudou[k] = { de: antes ?? null, para: (v as unknown) ?? null };
      };
      if(opcoes.vinculo){await validarVinculos(tx,autor,{leadId:opcoes.vinculo.leadId??undefined,pessoaId:opcoes.vinculo.pessoaId??undefined});set("leadId",opcoes.vinculo.leadId,t.leadId);set("pessoaId",opcoes.vinculo.pessoaId,t.pessoaId);}
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
      if (opcoes.agendamento || d.dataCivil !== undefined || d.hora !== undefined || d.lembreteAntecedenciaMin !== undefined) {
        const dataCivil = d.dataCivil !== undefined ? d.dataCivil : t.dataCivil;
        const hora = d.hora !== undefined ? d.hora : t.inicioEm ? horaLocal(t.inicioEm, t.fusoOrigem) : null;
        const antecedencia = opcoes.agendamento ? opcoes.agendamento.lembreteAntecedenciaMin : d.lembreteAntecedenciaMin !== undefined ? d.lembreteAntecedenciaMin : t.lembreteAntecedenciaMin;
        // No Inbox, a agenda já foi resolvida pelo wrapper; a anterior não decide sua validade.
        const temHorario = opcoes.agendamento ? !!(opcoes.agendamento.dataCivil && opcoes.agendamento.inicioEm) : !!(dataCivil && hora);
        if (antecedencia !== null && !temHorario) throw new ErroRegra("O lembrete exige data e horário.");
        const q = opcoes.agendamento ?? agendamentoTarefa(dataCivil, hora, t.fusoOrigem, antecedencia);
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
      await gravar(tx, t, versao, "ABERTA", data, opcoes.filtro);
      await registrarEvento(tx, { tipo: "TarefaEditada", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: autor.id, payload: { campos: mudou as Prisma.InputJsonObject, versao: versao + 1 } });

}
function horaLocal(inicio: Date, fuso: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(inicio);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("hour")}:${g("minute")}`;
}
