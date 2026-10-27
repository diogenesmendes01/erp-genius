"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { podeExecutar, TIPOS_DESVINCULAVEIS, type TipoVinculoContato } from "@/server/inbox/permissoes";
import { conversaVisivel } from "./consultas-inbox";
import { CHAVE_LINHA } from "./linha-comercial";
import { DesvincularContatoSchema, type DesvincularContatoInput } from "./schema";

const CAMPO: Record<TipoVinculoContato, "alunoId" | "responsavelId" | "leadId"> = {
  aluno: "alunoId", responsavel: "responsavelId", lead: "leadId",
};

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
      const revalidarLead = async () => {
        if (alvo.tipo !== "lead") return;
        const fresco = await tx.usuario.findUnique({ where: { id: autor.id }, select: { nome: true, papeis: true, permissoes: true, ativo: true } });
        if (!fresco?.ativo) throw new ErroRegra("Sua sessão não está mais ativa.");
        const usuario = { id: autor.id, nome: fresco.nome, papeis: fresco.papeis, permissoes: fresco.permissoes };
        const atual = await conversaVisivel(usuario, atendimentoId, false, tx);
        if (!atual || atual.contatoId !== alcance.contatoId || atual.finalidade !== "COMERCIAL" ||
            !TIPOS_DESVINCULAVEIS[atual.finalidade].includes(alvo.tipo) ||
            !podeExecutar(usuario, "desvincular", { setor: atual.finalidade, responsavelId: atual.responsavelId })) {
          throw new ErroRegra("Atendimento fora do seu escopo para desvincular.");
        }
      };
      if (alvo.tipo === "lead") {
        await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR UPDATE`;
        await revalidarLead();
      }
      await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id = ${alcance.contatoId} FOR UPDATE`;
      await revalidarLead();
      const contato = await tx.contatoWhatsApp.findUniqueOrThrow({
        where: { id: alcance.contatoId }, select: { alunoId: true, responsavelId: true, leadId: true },
      });
      if (contato[campo] !== alvo.id) throw new ErroRegra("Este contato não está mais vinculado a esse cadastro. Recarregue a conversa.");
      await tx.contatoWhatsApp.update({ where: { id: alcance.contatoId }, data: { [campo]: null } });
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
