import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { docenteAtual } from "@/server/diario/permissoes";
import { bloquearLancamento } from "./lancamento-tx";
import { NotasLancamentoSchema } from "./lancamento-schema";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { notaVigente } from "./nota-vigente";

export const EntradaCorrecaoNotaSchema = z.object({ lancamentoId: z.string().min(1).max(100), origemHash: z.string().regex(/^[a-f0-9]{64}$/),
  notas: NotasLancamentoSchema, motivo: z.string().trim().min(5).max(2000), versaoEsperada: z.number().int().min(0).max(2147483646),
  chaveIdempotencia: z.string().min(8).max(100) }).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

export async function proporCorrecaoNotaTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof EntradaCorrecaoNotaSchema>) {
  const u = { id: autorId }, d = EntradaCorrecaoNotaSchema.parse(input);

      const ref = await tx.versaoLancamentoAvaliacao.findUnique({ where: { id: d.lancamentoId }, select: { registro: { select: { alocacaoId: true } } } });
      if (!ref) throw new ErroRegra("Nota não encontrada.");
      const a = await bloquearLancamento(tx, ref.registro.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      if (!fresco?.ativo || !(fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR) || (fresco.papeis.includes(Papel.PROFESSOR) && docenteAtual(u.id, t)))) throw new ErroPermissao();
      const repetida = await tx.propostaCorrecaoNota.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash(d)) throw new ErroRegra("Chave já utilizada com outra proposta.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const v = await tx.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: d.lancamentoId }, include: { decisao: true, registro: { include: { regra: true } } } });
      if (!v.decisao?.aprovada) throw new ErroRegra("Somente notas oficializadas usam este fluxo. Revise o rascunho ou a submissão pendente.");
      const vigente = await notaVigente(tx, v);
      if (vigente.origemHash !== d.origemHash) throw new ErroRegra("Confira a versão oficial de origem.");
      const regra = ConteudoRegraAvaliacaoSchema.parse(v.registro.regra.conteudo), av = regra.avaliacoes.find(x => x.codigo === v.registro.codigoAvaliacao);
      if (!av || av.habilidades.length !== d.notas.length || d.notas.some(n => !av.habilidades.includes(n.habilidade) || n.nota === null)) throw new ErroRegra("A correção exige notas de todas as habilidades desta avaliação.");
      if (d.notas.some(n => new Prisma.Decimal(n.nota!).lt(regra.escala.minimo) || new Prisma.Decimal(n.nota!).gt(regra.escala.maximo))) throw new ErroRegra("Nota fora da escala da regra aplicada.");
      const originais = vigente.notas;
      if (d.notas.every(n => originais.some(o => o.habilidade === n.habilidade && o.nota !== null && new Prisma.Decimal(o.nota).eq(n.nota!) && o.comentarioAluno === n.comentarioAluno))) throw new ErroRegra("Informe uma alteração em relação às notas ou comentários oficiais.");
      const ultima = await tx.propostaCorrecaoNota.findFirst({ where: { lancamentoId: v.id }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta mais recente. Atualize a revisão.");
      const proposta = await tx.propostaCorrecaoNota.create({ data: { lancamentoId: v.id, autorId: u.id, versao: d.versaoEsperada + 1, notas: d.notas,
        origemHash: vigente.origemHash, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d) } });
      await registrarEvento(tx, { tipo: "CorrecaoNotaProposta", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id,
        payload: { propostaId: proposta.id, lancamentoId: v.id, registroId: v.registroId, versao: proposta.versao, motivo: d.motivo } });
      return { id: proposta.id, versao: proposta.versao };

}
