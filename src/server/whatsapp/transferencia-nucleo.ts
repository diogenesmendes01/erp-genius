import type { Papel, Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra, registrarEvento, type UsuarioSessao } from "@/server/_shared";
import { repeticaoIdempotente, type MarcaIdempotencia } from "@/server/_shared/idempotencia";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel, encerrarAtendimentoNaTransacao, garantirAtendimento } from "./atendimentos";
import { escopoAtendimentos } from "./escopo";
import { papeisDoSetor, type Setor } from "./setor";
import { setoresDoNumero } from "./numero-setor";
import { comoErroRegra } from "./erro-regra-atendimento";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
import { ehLinhaComercial } from "./linha-comercial";
import { proximoStatus } from "./status-atendimento";
import { lerResumoDaAriaParaNota } from "../aria/resumo-nota";
type Tx = Prisma.TransactionClient;
const MSG_FORA_DO_ESCOPO = "Atendimento fora do seu escopo.";
const MSG_SEM_ALCADA = "Sua função não autoriza esta ação neste atendimento.";
const MOTIVO_CANCELAMENTO = "Responsável do atendimento mudou; revisar antes de enviar.";
const MSG_RESPONSAVEL_SEM_ACESSO_LINHA = "Nesta linha de vendas o atendimento fica com o dono da linha; ele não pode ser assumido por quem não atende a linha.";
const MSG_RESPONSAVEL_SEM_ACESSO = "Esta pessoa não teria acesso a este atendimento depois da mudança; escolha quem atende o setor e a conversa.";

export async function exigirResponsavelEnxerga(tx: Tx, id: string, alvo: { id: string; papeis: Papel[] }) {
  const n = await tx.atendimentoWhatsApp.count({ where: { AND: [{ id }, await escopoAtendimentos(alvo, { db: tx })] } });
  if (n === 1) return;
  const a = await tx.atendimentoWhatsApp.findUnique({ where: { id }, select: { finalidade: true, conversa: { select: { numero: { select: { finalidade: true } } } } } });
  const linha = a?.finalidade === "COMERCIAL" && !!a.conversa.numero && ehLinhaComercial(a.conversa.numero);
  throw new ErroRegra(linha ? MSG_RESPONSAVEL_SEM_ACESSO_LINHA : MSG_RESPONSAVEL_SEM_ACESSO);
}

export async function cancelarIntencoesDoResponsavel(tx: Tx, atendimentoId: string, responsavelId: string | null) {
  if (!responsavelId) return;
  await tx.intencaoMensagem.updateMany({
    where: { atendimentoId, origem: "HUMANO", autorId: responsavelId, status: { in: ["PENDENTE", "ADIADA"] } },
    data: { status: "CANCELADA", motivoFalha: MOTIVO_CANCELAMENTO },
  });
}

export async function ultimoEventoEhDoAutor(tx: Tx, alvo: { agregadoId: string; tipos: string[]; tipo: string; autorId: string; payload?: Record<string, string | null> }): Promise<boolean> {
  const ultimo = await tx.evento.findFirst({
    where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: alvo.agregadoId, tipo: { in: alvo.tipos } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { tipo: true, autorId: true, payload: true },
  });
  if (!ultimo || ultimo.tipo !== alvo.tipo || ultimo.autorId !== alvo.autorId) return false;
  const payload = (ultimo.payload ?? {}) as Record<string, unknown>;
  return Object.entries(alvo.payload ?? {}).every(([k, v]) => payload[k] === v);
}

async function resolverDestino(tx: Tx, destino: Setor, chave: string | null, telefoneContato: string) {
  if (destino === "FINANCEIRO") {
    const p = chave?.split(":") ?? [];
    if (p[0] !== "FINANCEIRO" || !p[1]) throw new ErroRegra("Escolha a matrícula do atendimento financeiro.");
    const m = await tx.matricula.findUnique({ where: { id: p[1] }, include: INCLUDE_MATRICULA_DESTINO });
    if (!m) throw new ErroRegra("Matrícula do atendimento financeiro não encontrada.");
    const fin = resolverDestinoFinanceiroDaMatricula(m);
    if (!fin) throw new ErroRegra("A matrícula selecionada não possui destinatário válido para cobrança. Confira o pagador e o telefone deste contrato.");
    if (fin.telefoneE164 !== telefoneContato) throw new ErroRegra("O contato desta conversa não é o destinatário de cobrança da matrícula escolhida.");
    return { alunoId: fin.alunoId, matriculaId: fin.matriculaId, turmaId: null, autorizacaoComunicacaoAcademicaId: null };
  }
  if (destino === "PEDAGOGICO") {
    const p = chave?.split(":") ?? [];
    if (p[0] !== "PEDAGOGICO" || p.length < 5 || !p[1] || !p[2] || !p[3]) throw new ErroRegra("Escolha o aluno, a turma e a matrícula do atendimento pedagógico.");
    const autorizacao = p[4] === "AUT" ? p[5] : null;
    if (p[4] === "AUT" && !autorizacao) throw new ErroRegra("Escolha a autorização do atendimento pedagógico.");
    const m = await tx.matricula.findFirst({ where: { id: p[3], alunoId: p[1] }, select: { id: true } });
    if (!m) throw new ErroRegra("Matrícula pedagógica não corresponde ao aluno selecionado.");
    const alocacao = await tx.alocacaoTurma.count({ where: { ativa: true, alunoId: p[1], turmaId: p[2], matriculaId: p[3] } });
    if (alocacao === 0) throw new ErroRegra("A turma escolhida não corresponde a uma alocação ativa desta matrícula.");
    return { alunoId: p[1], matriculaId: p[3], turmaId: p[2], autorizacaoComunicacaoAcademicaId: autorizacao };
  }
  return null;
}

export async function lerAutorTransferencia(tx: Tx, autorId: string): Promise<UsuarioSessao> {
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { id: true, nome: true, ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo) throw new ErroPermissao("Sua sessão não está mais ativa.");
  return u;
}
export async function atribuirAtendimentoTx(tx: Tx, u: UsuarioSessao, id: string, usuarioId: string, inbox?: { contexto: string; marca: MarcaIdempotencia }) {
      const repetido = inbox ? await repeticaoIdempotente(tx, { tipo: "AtendimentoAtribuido", agregadoTipo: "AtendimentoWhatsApp", autorId: u.id, marca: inbox.marca, mensagemConflito: "Esta tentativa já foi usada com outra transferência. Confira a conversa antes de repetir." }) : null;
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const autor = inbox ? await lerAutorTransferencia(tx, u.id) : u;
      const a = await atendimentoVisivel(autor, id, false, tx);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!podeExecutar(autor, "atribuir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      const alvo = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, ativo: true, papeis: true } });
      const doSetor = papeisDoSetor(a.finalidade);
      if (!alvo || !alvo.ativo || !alvo.papeis.some((p) => doSetor.includes(p))) throw new ErroRegra("A pessoa escolhida não atende este setor.");
      const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { status: true, responsavelId: true } });
      const anterior = atual.responsavelId;
      if (repetido) {
        await exigirResponsavelEnxerga(tx, id, alvo);
        if (anterior !== usuarioId || !await ultimoEventoEhDoAutor(tx, { agregadoId: id, tipos: ["AtendimentoAssumido", "AtendimentoDevolvido", "AtendimentoAtribuido", "AriaHandoff", "AtendimentoEncerrado", "AtendimentoTransferido"], tipo: "AtendimentoAtribuido", autorId: autor.id, payload: { para: usuarioId, chaveIdempotencia: inbox!.marca.chaveIdempotencia } })) throw new ErroRegra("O responsável mudou depois desta tentativa. Reabra a transferência.");
        return;
      }
      if (anterior === usuarioId) {
        if (inbox) throw new ErroRegra("Esta pessoa já é responsável pelo atendimento.");
        return;
      }
      await tx.atendimentoWhatsApp.update({ where: { id }, data: { responsavelId: usuarioId, status: proximoStatus(atual.status, "ASSUMIDO", true) } });
      await exigirResponsavelEnxerga(tx, id, alvo);
      await cancelarIntencoesDoResponsavel(tx, id, anterior);
      await registrarEvento(tx, { tipo: "AtendimentoAtribuido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: autor.id, payload: { de: anterior, para: usuarioId, ...(inbox?.marca ?? {}) } });
      if (inbox?.contexto) await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, autorId: autor.id, payload: { nota: inbox.contexto } });
}

export interface DadosTransferirSetor { atendimentoId: string; destino: Setor; destinoChave: string | null; contexto: string }
export async function transferirAtendimentoTx(tx: Tx, u: UsuarioSessao, dados: DadosTransferirSetor, marca: MarcaIdempotencia | null, inbox?: { anexarResumoAria: boolean }) {
      let repetido: Awaited<ReturnType<typeof repeticaoIdempotente>> = null;
      if (marca) {
        repetido = await repeticaoIdempotente(tx, {
          tipo: "AtendimentoTransferido", agregadoTipo: "AtendimentoWhatsApp", autorId: u.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra transferência. Confira os atendimentos da conversa antes de repetir.",
        });
        if (repetido && !inbox) return String((repetido.payload as { novoId?: unknown }).novoId);
      }
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${dados.atendimentoId} FOR UPDATE`;
      const autor = inbox ? await lerAutorTransferencia(tx, u.id) : u;
      const a = await atendimentoVisivel(autor, dados.atendimentoId, false, tx);
      if (!a) throw new ErroRegra(MSG_FORA_DO_ESCOPO);
      if (inbox) {
        if (!podeExecutar(autor, "transferir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
        if (repetido) {
          const payload = repetido.payload as { origemId?: unknown; novoId?: unknown };
          if (payload.origemId !== a.id || typeof payload.novoId !== "string") throw new ErroRegra("Recibo de transferência incompatível com esta conversa.");
          const novo = await tx.atendimentoWhatsApp.findFirst({ where: { id: payload.novoId, atendimentoOrigemId: a.id, conversaId: a.conversaId }, select: { id: true } });
          if (!novo) throw new ErroRegra("O contexto de destino mudou depois desta tentativa. Confira a conversa.");
          return novo.id;
        }
      }
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado.");
      if (!inbox && !podeExecutar(u, "transferir", { setor: a.finalidade, responsavelId: a.responsavelId })) throw new ErroRegra(MSG_SEM_ALCADA);
      if (dados.destino === a.finalidade && !["FINANCEIRO", "PEDAGOGICO"].includes(dados.destino)) throw new ErroRegra("O atendimento já pertence a este setor.");
      const ctx = await resolverDestino(tx, dados.destino, dados.destinoChave, a.contato.telefoneE164);
      if (!(await setoresDoNumero(tx, a.numeroId)).includes(dados.destino)) throw new ErroRegra("O número deste atendimento não atende o setor escolhido.");
      const resumo = inbox?.anexarResumoAria ? await lerResumoDaAriaParaNota(tx, a.id) : null;
      await encerrarAtendimentoNaTransacao(tx, a.id, autor.id);
      const conversaId = a.conversaId;
      const antes = new Set((await tx.atendimentoWhatsApp.findMany({ where: { conversaId, encerradoEm: null }, select: { id: true } })).map((x) => x.id));
      let novo;
      try {
        novo = await garantirAtendimento(tx, {
          numeroId: a.numeroId, contatoId: a.contatoId, finalidade: dados.destino, reabrir: true, atendimentoOrigemId: a.id,
          leadId: dados.destino === "COMERCIAL" ? a.leadId ?? a.contato.leadId : null,
          alunoId: ctx?.alunoId ?? (dados.destino === "SECRETARIA" ? a.alunoId ?? a.contato.alunoId : null),
          matriculaId: ctx?.matriculaId ?? null, turmaId: ctx?.turmaId ?? null,
          autorizacaoComunicacaoAcademicaId: ctx?.autorizacaoComunicacaoAcademicaId ?? null, responsavelId: null,
        });
      } catch (e) { comoErroRegra(e); }
      if (antes.has(novo.id)) throw new ErroRegra("Já existe um atendimento aberto neste setor e contexto para esta conversa.");
      if (!novo.atendimentoOrigemId) novo = await tx.atendimentoWhatsApp.update({ where: { id: novo.id }, data: { atendimentoOrigemId: a.id } });
      const payload = { de: a.finalidade, para: dados.destino, origemId: a.id, novoId: novo.id, contexto: inbox ? dados.contexto || null : dados.contexto, ...marca };
      for (const agregadoId of [a.id, novo.id]) {
        await registrarEvento(tx, { tipo: "AtendimentoTransferido", agregadoTipo: "AtendimentoWhatsApp", agregadoId, autorId: autor.id, payload });
      }
      if (!inbox || dados.contexto) await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: novo.id, autorId: autor.id, payload: { nota: dados.contexto } });
      if (resumo) await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: novo.id, autorId: autor.id, payload: { nota: resumo.nota, origem: "resumoAria", acaoAgenteIAId: resumo.acaoId } });
      return novo.id;
}
