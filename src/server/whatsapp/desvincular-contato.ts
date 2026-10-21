"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { ultimoEventoDoAutor } from "@/server/_shared/idempotencia";
import { podeExecutar, TIPOS_DESVINCULAVEIS, type TipoVinculoContato } from "@/server/inbox/permissoes";
import { conversaVisivel } from "./consultas-inbox";
import { CHAVE_LINHA } from "./linha-comercial";
import { DesvincularContatoSchema, type DesvincularContatoInput } from "./schema";

const CAMPO: Record<TipoVinculoContato, "alunoId" | "responsavelId" | "leadId"> = {
  aluno: "alunoId", responsavel: "responsavelId", lead: "leadId",
};

/**
 * "Desvincular contato" no Inbox (decisão D8 do dono; #175, docs/42 L2298). Desfaz o vínculo do contato do WhatsApp
 * com o aluno, o responsável ou a oportunidade, o mesmo que `vincularContatoWhatsApp` faz: as próximas mensagens deste
 * número deixam de aparecer no cadastro. Na linha de vendas, o atendimento único da conversa também solta a
 * oportunidade, para a conversa poder ser ligada à certa. Nada é apagado: cadastro, mensagens, atendimentos e o
 * contexto dos atendimentos de secretaria/financeiro (aluno e matrícula) ficam como estão.
 *
 * Só o Administrador ou o gerente do setor do atendimento (`podeExecutar(…, "desvincular")`), com motivo, e o
 * evento `ContatoDesvinculado` na mesma transação (trava de src/server/crm-config/auditoria.test.ts).
 */
export async function desvincularContatoWhatsApp(input: DesvincularContatoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const atendimentoId = DesvincularContatoSchema.shape.atendimentoId.parse(input.atendimentoId);
    const alcance = await conversaVisivel(autor, atendimentoId);
    if (!alcance || alcance.finalidade === "PEDAGOGICO") throw new ErroRegra("Atendimento fora do seu escopo para desvincular.");
    if (!podeExecutar(autor, "desvincular", { setor: alcance.finalidade, responsavelId: alcance.responsavelId })) {
      throw new ErroRegra("Só a administração ou o gerente do setor desvinculam o contato.");
    }
    const { alvo, motivo } = DesvincularContatoSchema.parse(input);
    if (!TIPOS_DESVINCULAVEIS[alcance.finalidade].includes(alvo.tipo)) {
      throw new ErroRegra(alcance.finalidade === "COMERCIAL"
        ? "Neste atendimento só se desfaz o vínculo com a oportunidade."
        : "Neste atendimento só se desfaz o vínculo com o aluno ou o responsável.");
    }
    const campo = CAMPO[alvo.tipo];

    await prisma.$transaction(async (tx) => {
      // Trava a linha do contato: dois desvínculos (ou um vínculo) concorrentes não se cruzam.
      await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id = ${alcance.contatoId} FOR UPDATE`;
      const contato = await tx.contatoWhatsApp.findUniqueOrThrow({
        where: { id: alcance.contatoId }, select: { alunoId: true, responsavelId: true, leadId: true },
      });
      if (contato[campo] !== alvo.id) {
        // Idempotência por natureza (#166, 7º lote): o mesmo desvínculo, já feito por quem repete e com o mesmo motivo
        // (último `ContatoDesvinculado` do contato), devolve ok sem outro Evento. Outro caso segue recusado.
        const p = await ultimoEventoDoAutor(tx, { tipo: "ContatoDesvinculado", agregadoTipo: "ContatoWhatsApp", agregadoId: alcance.contatoId, autorId: autor.id });
        const desfeito = (p?.alvo ?? {}) as { tipo?: unknown; id?: unknown };
        if (p && desfeito.tipo === alvo.tipo && desfeito.id === alvo.id && p.motivo === motivo) return;
        throw new ErroRegra("Este contato não está mais vinculado a esse cadastro. Recarregue a conversa.");
      }
      await tx.contatoWhatsApp.update({ where: { id: alcance.contatoId }, data: { [campo]: null } });
      // Linha de vendas: o lead do atendimento da linha veio do vínculo; fora dela, o lead é o contexto do atendimento.
      const linha = alvo.tipo === "lead"
        ? await tx.atendimentoWhatsApp.updateMany({
            where: { id: alcance.id, leadId: alvo.id, contextoChave: { startsWith: CHAVE_LINHA } }, data: { leadId: null },
          })
        : { count: 0 };
      await registrarEvento(tx, {
        tipo: "ContatoDesvinculado",
        agregadoTipo: "ContatoWhatsApp",
        agregadoId: alcance.contatoId,
        autorId: autor.id,
        payload: { alvo, motivo, atendimentoId: alcance.id, antes: contato, leadDoAtendimentoRemovido: linha.count > 0 },
      });
    });
    revalidatePath("/inbox");
  });
}
