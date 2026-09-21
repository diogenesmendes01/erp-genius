"use server";
import { consultarCadastroContratualVigenteTx } from "./cadastro-contratual";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { prepararAditivoContratualTx, decidirAditivoContratualTx } from "./aditivo-tx";
import { PrepararAditivoContratualSchema, DecidirAditivoContratualSchema } from "./aditivo-schema";
import { TextoPreviaSchema } from "./previa-projecao";
import { ConteudoModeloSchema } from "./modelo-schema";
import { ROTULOS_ORIGEM } from "./campos";
import { hashSubstituicao } from "./substituicao-estado";
import { ProjecaoAditivoSchema } from "./aditivo-projecao";
import { classificarAlteracoesAditivo } from "./aditivo-impactos";
import { carregarCadeiaAditivoTx } from "./aditivo-cadeia";
import { representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";

const id = z.string().trim().min(1).max(100);
const pagina = z.number().int().min(1).max(100000).default(1);

export async function prepararAditivoContratual(input: z.input<typeof PrepararAditivoContratualSchema>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    return prisma.$transaction(tx => prepararAditivoContratualTx(tx, ator.id, input), { timeout: 20000 });
  });
}
export async function decidirAditivoContratual(input: z.input<typeof DecidirAditivoContratualSchema>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    return prisma.$transaction(tx => decidirAditivoContratualTx(tx, ator.id, input), { timeout: 20000 });
  });
}

export async function consultarAditivosContratuais(input: { matriculaId: string; pagina?: number; paginaModelos?: number }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: id, pagina, paginaModelos: pagina }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, codigo: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } }, preparacaoComercial: { select: { regime: true } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const conclusoes = await tx.conclusaoAssinaturaContratual.findMany({ where: { processo: { matriculaId: d.matriculaId } }, take: 2,
        select: { id: true, entradaHash: true, processo: { select: { estado: true, ambiente: true, artefato: { select: { id: true, previa: { select: { snapshot: true } } } } } } } });
      const fonte = conclusoes.length === 1 && conclusoes[0].processo.estado === "ENVIADO" ? conclusoes[0] : null;
      const campos = fonte ? TextoPreviaSchema.parse(fonte.processo.artefato.previa.snapshot).documento.campos : [];
      const origens = [...new Set(campos.map(c => c.origem))].filter(o => !o.startsWith("ADITIVO_"));
      const cadeia = fonte ? await carregarCadeiaAditivoTx(tx, { matriculaId: d.matriculaId }) : null;
      const condicoes = cadeia?.condicoes ?? {};
      const modelos = await tx.versaoModeloContratual.findMany({ where: { decisao: { aprovada: true },
        AND: [{ conteudo: { path: ["finalidade"], equals: "ADITIVO" } }, ...(m.preparacaoComercial ? [{ conteudo: { path: ["regimes"], array_contains: [m.preparacaoComercial.regime] } }] : [])] },
        orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.paginaModelos - 1) * 20, take: 21,
        select: { id: true, codigo: true, versao: true, conteudoHash: true, conteudo: true } });
      const propostas = await tx.propostaAditivoContratual.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ versao: "desc" }],
        skip: (d.pagina - 1) * 20, take: 21, select: { id: true, versao: true, motivo: true, criadaEm: true,
          preparadaPor: { select: { nome: true } }, decisao: { select: { aprovada: true, decisor: { select: { nome: true } } } } } });
      const cadastroContratual = await consultarCadastroContratualVigenteTx(tx, m.id, new Date());
      return { cadastroContratual, matricula: { id: m.id, codigo: m.codigo, aluno: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" ") },
        fonte: fonte ? { conclusaoId: fonte.id, conclusaoHash: fonte.entradaHash, artefatoId: fonte.processo.artefato.id, ambiente: fonte.processo.ambiente,
          campos: origens.map(origem => { const estruturado = condicoes[origem]; let anterior = campos.find(c => c.origem === origem)!.valor;
            if (estruturado !== undefined) anterior = representarValorAlteracaoAditivo(validarValorAlteracaoAditivo(origem, estruturado));
            return { origem, rotulo: ROTULOS_ORIGEM[origem], anterior }; }) } : null,
        impedimento: fonte ? null : conclusoes.length > 1 ? "Há mais de um original assinado. A fonte contratual precisa de conferência." : "A preparação exige um original com todas as assinaturas concluídas e envio confirmado.",
        modelos: modelos.slice(0, 20).map(m => { const c = ConteudoModeloSchema.parse(m.conteudo); return { id: m.id, codigo: m.codigo, versao: m.versao, modeloHash: m.conteudoHash, titulo: c.titulo, aplicacao: c.aplicacao }; }),
        paginaModelos: d.paginaModelos, maisModelos: modelos.length > 20,
        propostas: propostas.slice(0, 20), pagina: d.pagina, maisPropostas: propostas.length > 20 };
    }, { isolationLevel: "RepeatableRead" });
  });
}

export async function consultarPropostaAditivo(input: { matriculaId: string; propostaId: string }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: id, propostaId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      const p = await tx.propostaAditivoContratual.findFirst({ where: { id: d.propostaId, matriculaId: d.matriculaId }, select: {
        id: true, conclusaoOriginalId: true, versao: true, vigenciaInicio: true, motivo: true, criadaEm: true, preparadaPorId: true, preparadaPor: { select: { nome: true } },
        entradaHash: true, snapshot: true, decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } },
      } });
      if (!p) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      if (hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("A proposta preservada exige conferência de integridade.");
      const s = ProjecaoAditivoSchema.parse(p.snapshot);
      const superada = await tx.propostaAditivoContratual.count({ where: { matriculaId: d.matriculaId, versao: { gt: p.versao } } }) > 0;
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: ator.id }, select: { ativo: true, papeis: true } });
      return { id: p.id, conclusaoOriginalId: p.conclusaoOriginalId, versao: p.versao, vigenciaInicio: p.vigenciaInicio, motivo: p.motivo, criadaEm: p.criadaEm,
        preparadaPor: p.preparadaPor.nome, propostaHash: p.entradaHash, ambiente: s.base.ambiente, artefatoOriginalId: s.base.artefatoOriginalId,
        modeloCodigo: s.base.modeloCodigo, modeloVersao: s.base.modeloVersao, cicloCoberturaFutura: s.cicloCoberturaFutura ?? null, alteracoes: s.alteracoes, documento: s.documento,
        impactos: classificarAlteracoesAditivo(s.alteracoes),
        decisao: p.decisao, superada, podeDecidir: !p.decisao && usuario.ativo && usuario.papeis.includes(Papel.ADMINISTRADOR) && p.preparadaPorId !== ator.id };
    }, { isolationLevel: "RepeatableRead" });
  });
}
