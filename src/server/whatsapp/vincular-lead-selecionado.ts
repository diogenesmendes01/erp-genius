import type { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento, temPapel, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { atendimentoVisivel } from "./atendimentos";
import { CHAVE_LINHA } from "./linha-comercial";

export async function vincularLeadSelecionadoTx(tx: Prisma.TransactionClient, sessao: UsuarioSessao, entrada: { contatoId: string; atendimentoId?: string; leadId: string }) {
  const { atendimentoId, contatoId, leadId } = entrada;
  if (!atendimentoId) throw new ErroRegra("Atendimento fora do seu escopo para vinculação.");
  const autor = { ...sessao };
  async function resolver() {
    const fresco = await tx.usuario.findUnique({ where: { id: autor.id }, select: { nome: true, papeis: true, permissoes: true, ativo: true } });
    if (!fresco?.ativo) throw new ErroRegra("Sua sessão não está mais ativa.");
    Object.assign(autor, { nome: fresco.nome, papeis: fresco.papeis, permissoes: fresco.permissoes });
    if (!temPapel(autor, "VENDEDOR", "GERENTE_COMERCIAL")) throw new ErroRegra("Vínculo de lead exige atendimento comercial.");
    const a = await atendimentoVisivel(autor, atendimentoId!, true, tx);
    if (!a || a.contatoId !== contatoId || a.finalidade !== "COMERCIAL" || a.encerradoEm ||
        a.conversa.grupoId || a.numero.finalidade !== "VENDAS" || !a.numero.ativo) {
      throw new ErroRegra("Este atendimento não permite vincular a oportunidade selecionada.");
    }
    if (a.leadId && a.leadId !== leadId) throw new ErroRegra("A oportunidade do atendimento mudou. Recarregue a conversa.");
    const contato = await tx.contatoWhatsApp.findUnique({ where: { id: contatoId } });
    if (!contato || (contato.leadId && contato.leadId !== leadId)) throw new ErroRegra("Contato já vinculado a outro lead. Preserve o contexto histórico.");
    const lead = await tx.oportunidade.findFirst({
      where: { AND: [{ id: leadId, telefoneE164: contato.telefoneE164 }, await escopoComercialAtual(autor, tx)] },
      select: { id: true, pessoaId: true },
    });
    if (!lead) throw new ErroRegra("Lead não encontrado ou fora do seu escopo.");
    if (contato.pessoaId) {
      if (lead.pessoaId && lead.pessoaId !== contato.pessoaId) throw new ErroRegra("A Pessoa do contato não corresponde à oportunidade.");
      const pessoa = await tx.pessoa.findFirst({ where: { id: contato.pessoaId, mescladaEmId: null, responsavel: null }, select: { id: true } });
      if (!pessoa) throw new ErroRegra("A Pessoa do contato mudou. Recarregue a conversa.");
    }
    const abertos = await tx.atendimentoWhatsApp.findMany({
      where: { conversaId: a.conversaId, finalidade: "COMERCIAL", encerradoEm: null },
      orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
      select: { id: true, leadId: true, contextoChave: true },
    });
    const candidato = abertos.find(outro => outro.leadId === leadId) ?? abertos.find(outro => outro.contextoChave.startsWith(CHAVE_LINHA)) ?? abertos[0];
    if (candidato?.id !== atendimentoId) throw new ErroRegra("O vínculo pertence a outro atendimento. Recarregue a conversa.");
    return { a, contato };
  }
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR UPDATE`;
  await resolver();
  await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id=${contatoId} FOR UPDATE`;
  await resolver();
  await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${leadId} FOR UPDATE`;
  const antes = await resolver();
  const contato = await tx.contatoWhatsApp.updateMany({ where: { id: contatoId, leadId: antes.contato.leadId, pessoaId: antes.contato.pessoaId, telefoneE164: antes.contato.telefoneE164 }, data: { leadId } });
  if (contato.count !== 1) throw new ErroRegra("O contato mudou. Recarregue a conversa.");
  const atendimento = await tx.atendimentoWhatsApp.updateMany({ where: { id: atendimentoId, leadId: antes.a.leadId, encerradoEm: null }, data: { leadId } });
  if (atendimento.count !== 1) throw new ErroRegra("O atendimento mudou. Recarregue a conversa.");
  const depois = await resolver();
  if (depois.a.leadId !== leadId || depois.contato.leadId !== leadId) throw new ErroRegra("Não foi possível confirmar o vínculo neste atendimento.");
  await registrarEvento(tx, { tipo: "ContatoVinculado", agregadoTipo: "ContatoWhatsApp", agregadoId: contatoId, autorId: autor.id,
    payload: { alvo: { tipo: "lead", id: leadId }, antes: { alunoId: antes.contato.alunoId, responsavelId: antes.contato.responsavelId, leadId: antes.contato.leadId } } });
}
