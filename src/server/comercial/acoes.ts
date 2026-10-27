"use server";

import { revalidatePath } from "next/cache";
import { Papel, EtapaLead, CategoriaDocumento, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apenasPortal } from "@/server/_shared/sessao";
import { prepararMudancaPrevisao } from "./previsao-schema";
import { criarRegistroLeadTx } from "./criar-registro-lead-tx";
import { exigirDestinoComercial } from "./destino-comercial";
import { gerarCodigo } from "@/lib/codigo";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { hashEntrada, marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import {
  exigirSessao,
  exigirSessaoComPapel,
  exigirPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  resolverDonoLead,
  normalizarTelefoneE164,
  podeCheckinExperimental,
  professorNoEscopoExperimental,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import { moverEtapaTx } from "@/server/crm/mover-etapa";
import { escopoPessoas, garantirPessoaTx } from "@/server/crm/pessoas";
import {
  EVENTO_EXPERIMENTAL_ATRIBUIDA,
  professorAtribuido,
} from "./experimental";

async function ddiDoPais(paisId?: string | null, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
  if (!paisId) return "";
  return (await db.pais.findUnique({ where: { id: paisId } }))?.ddi ?? "";
}
import {
  CriarLeadSchema,
  EditarLeadSchema,
  ResumoSchema,
  DatasSchema,
  InteracaoSchema,
  PerdaSchema,
  AgendarExperimentalSchema,
  NotaInternaSchema,
  type CriarLeadInput,
  type EditarLeadInput,
  type ResumoInput,
  type DatasInput,
  type InteracaoInput,
  type PerdaInput,
  type AgendarExperimentalInput,
  type NotaInternaInput,
} from "./schema";
import { Temperatura } from "@prisma/client";
import { analisarComDatasDaEscola } from "@/server/_shared/validacao";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { VALOR_CAMPO_LOCAL } from "@/server/operacao/fuso-entrada";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { marcarPerdidoTx } from "@/server/crm/marcar-perdido";

async function exigirProfessorValido(professorId: string) {
  const professor = await prisma.usuario.findUnique({ where: { id: professorId } });
  if (!professor) throw new ErroRegra("Professor não encontrado.");
  if (!professor.papeis.includes(Papel.PROFESSOR)) {
    throw new ErroRegra("Usuário informado não é professor.");
  }
}

const PAPEIS_COMERCIAL: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];

const DATA_CIVIL_LITERAL = /^(\d{4})-(\d{2})-(\d{2})$/;

function dataCivilOriginal(valor: unknown, normalizada: Date | undefined) {
  if (typeof valor !== "string" || !normalizada) return null;
  const partes = DATA_CIVIL_LITERAL.exec(valor);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  if (calendario.getUTCFullYear() !== ano || calendario.getUTCMonth() !== mes - 1 || calendario.getUTCDate() !== dia) return null;
  return normalizada.getFullYear() === ano && normalizada.getMonth() === mes - 1 && normalizada.getDate() === dia ? valor : null;
}

function revalidarLead() {
  revalidatePath("/funil");
  revalidatePath("/inbox");
}

async function exigirLeadVisivel(id: string, usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  exigirPapel(usuario, ...PAPEIS_COMERCIAL);
  const lead = await tx.oportunidade.findFirst({ where: { AND: [{ id }, await escopoComercialAtual(usuario, tx)] } });
  if (!lead) throw new ErroPermissao("Oportunidade fora da sua carteira.");
  return lead;
}

async function exigirDocumentoPermitido(leadId: string, categoria: CategoriaDocumento, usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!Object.values(CategoriaDocumento).includes(categoria)) throw new ErroRegra("Categoria inválida.");
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return;
  if (categoria === CategoriaDocumento.OUTRO) throw new ErroRegra("Classifique o documento pela finalidade antes de compartilhá-lo.");
  if (usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    const matricula = await tx.matricula.findUnique({ where: { leadId }, select: { secretariaAssumiuEm: true } });
    if (matricula?.secretariaAssumiuEm) return;
    if (!usuario.papeis.some((p) => p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL || p === Papel.PROFESSOR)) throw new ErroPermissao("Assuma a matrícula antes de alterar os documentos administrativos.");
  }
  if (categoria === CategoriaDocumento.TESTE_NIVEL && usuario.papeis.includes(Papel.PROFESSOR)) {
    const experimental = await tx.oportunidade.findFirst({ where: { id: leadId, professorExperimentalId: usuario.id }, select: { id: true } });
    if (experimental) return;
  }
  await exigirLeadVisivel(leadId, usuario, tx);
  const matricula = await tx.matricula.findUnique({ where: { leadId }, select: { secretariaAssumiuEm: true } });
  if (matricula?.secretariaAssumiuEm && categoria !== CategoriaDocumento.PROPOSTA) throw new ErroPermissao("Solicite a correção documental à secretaria.");
}

export async function criarLead(input: CriarLeadInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const { chaveIdempotencia, ...dados } = CriarLeadSchema.parse(input);
    const marca = chaveIdempotencia ? { chaveIdempotencia, entradaHash: hashEntrada(dados) } : null;

    const donoId = resolverDonoLead(autor, dados.vendedorDonoId);
    await exigirDestinoComercial(autor, donoId);
    const ddi = await ddiDoPais(dados.paisId);

    const id = await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "LeadCriado", agregadoTipo: "Lead", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outros dados. Recarregue a página e confira se a oportunidade já aparece antes de repetir.",
        });
        if (repetido) return repetido.agregadoId;
      }
      const codigo = await gerarCodigo("lead");
      const telefoneE164 = normalizarTelefoneE164(dados.telefoneE164, ddi);
      let empresaId = dados.empresaId || null;
      if (dados.criarEmpresa && (empresaId || dados.pessoaId)) {
        throw new ErroRegra("Oportunidade de empresa nova não leva empresa nem contato já existentes.");
      }
      if (empresaId) {
        const empresa = await tx.empresa.findFirst({ where: { id: empresaId, ativo: true }, select: { id: true } });
        if (!empresa) throw new ErroRegra("Empresa não encontrada.");
      } else if (dados.criarEmpresa) {
        const codigoEmpresa = await gerarCodigo("empresa", tx);
        const empresa = await tx.empresa.create({
          data: {
            codigo: codigoEmpresa,
            nome: dados.nome,
            paisId: dados.paisId || null,
            contatoTelefone: telefoneE164,
            contatoEmail: dados.email || null,
            origemCanal: dados.origemCanal ?? null,
          },
        });
        empresaId = empresa.id;
        await registrarEvento(tx, {
          tipo: "EmpresaCriada",
          agregadoTipo: "Empresa",
          agregadoId: empresa.id,
          autorId: autor.id,
          payload: { codigo: codigoEmpresa, nome: empresa.nome, origem: "oportunidade" },
        });
      }
      let pessoaId = dados.pessoaId || null;
      if (pessoaId) {
        const existente = await tx.pessoa.findFirst({
          where: { AND: [{ id: pessoaId }, await escopoPessoas(autor, tx)] },
          select: { id: true },
        });
        if (!existente) throw new ErroRegra("Contato não encontrado.");
      } else if (!dados.criarEmpresa) {
        pessoaId = (
          await garantirPessoaTx(
            tx,
            { nome: dados.nome, telefoneE164, email: dados.email || null, origemCanal: dados.origemCanal },
            autor.id,
          )
        ).pessoaId;
      }
      return criarRegistroLeadTx(tx, { dados, codigo, telefoneE164, pessoaId, empresaId, donoId, autorId: autor.id, marca });
    });

    revalidarLead();
    return { id };
  });
}

export async function registrarNotaInterna(leadId: string, input: NotaInternaInput & { chaveIdempotencia?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    const { nota } = NotaInternaSchema.parse(input);
    const marca = marcaIdempotencia(ChaveIdempotenciaSchema.optional().parse(input.chaveIdempotencia), { leadId, nota });

    await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "NotaInterna", agregadoTipo: "Lead", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra nota. Recarregue a página e confira se a nota já aparece no histórico antes de repetir.",
        });
        if (repetido) return;
      }
      await registrarEvento(tx, {
        tipo: "NotaInterna",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { nota, ...marca },
      });
    });
    revalidarLead();
  });
}

export async function definirTemperatura(leadId: string, temperatura: Temperatura): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(leadId, autor);
    if (!Object.values(Temperatura).includes(temperatura)) throw new ErroRegra("Temperatura inválida.");
    if (lead.temperatura === temperatura) return;

    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({ where: { id: leadId }, data: { temperatura } });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { de: lead.temperatura, temperatura, campo: "temperatura" },
      });
    });
    revalidarLead();
  });
}

export async function editarLead(id: string, input: EditarLeadInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const dados = EditarLeadSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const leadTravado = await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      if (leadTravado.length !== 1) throw new ErroRegra("Oportunidade não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${id} FOR UPDATE`;
      if (dados.paisId) {
        const paisTravado = await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Pais" WHERE id=${dados.paisId} FOR KEY SHARE`;
        if (paisTravado.length !== 1) throw new ErroRegra("País não encontrado.");
      }
      const autorTravado = await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Usuario" WHERE id=${autor.id} FOR KEY SHARE`;
      if (autorTravado.length !== 1) throw new ErroPermissao("Sua sessão não está mais ativa.");
      const fresco = await tx.usuario.findUnique({where:{id:autor.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
      if (!fresco?.ativo || apenasPortal(fresco)) throw new ErroPermissao("Sua sessão não permite editar esta oportunidade.");
      exigirPapel(fresco, ...PAPEIS_COMERCIAL);
      const ddi = await ddiDoPais(dados.paisId, tx);
      const leadAtual = await exigirLeadVisivel(id, fresco, tx);
      const previsao = prepararMudancaPrevisao(leadAtual, {probabilidadePct:dados.probabilidadePct,previsaoFechamento:dados.previsaoFechamento});
      const matricula = await tx.matricula.findUnique({ where: { leadId: id }, select: { secretariaAssumiuEm: true } });
      const alteraCadastro = dados.nome !== leadAtual.nome || normalizarTelefoneE164(dados.telefoneE164, ddi) !== leadAtual.telefoneE164 || (dados.paisId || null) !== leadAtual.paisId;
      if (matricula?.secretariaAssumiuEm && alteraCadastro && !fresco.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA)) throw new ErroPermissao("A secretaria assumiu a matrícula. Solicite a correção cadastral.");
      await tx.oportunidade.update({
        where: { id },
        data: {
          nome: dados.nome,
          telefoneE164: normalizarTelefoneE164(dados.telefoneE164, ddi),
          paisId: dados.paisId || null,
          segmento: dados.segmento,
          temperatura: dados.temperatura,
          b2b: dados.b2b,
          origemCampanha: dados.origemCampanha || null,
          origemConjunto: dados.origemConjunto || null,
          origemAnuncio: dados.origemAnuncio || null,
          origemPalavra: dados.origemPalavra || null,
          valorPrevisto: dados.valorPrevisto ?? null,
          planoPrevisto: dados.planoPrevisto || null,
          comissaoPrevista: dados.comissaoPrevista ?? null,
          ...previsao.dados,
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: fresco.id,
        payload: { nome: dados.nome, temperatura: dados.temperatura, ...(previsao.alterado ? {previsoes:previsao.mudancas} : {}) },
      });
    });
    revalidarLead();
  });
}

export async function atualizarResumo(id: string, input: ResumoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = ResumoSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          interesse: dados.interesse || null,
          objetivo: dados.objetivo || null,
          urgencia: dados.urgencia || null,
          orcamento: dados.orcamento || null,
          objecao: dados.objecao || null,
          proximaAcao: dados.proximaAcao || null,
        },
      });
      await registrarEvento(tx, {
        tipo: "ResumoAtualizado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          interesse: dados.interesse || null,
          objetivo: dados.objetivo || null,
          urgencia: dados.urgencia || null,
          orcamento: dados.orcamento || null,
          objecao: dados.objecao || null,
          proximaAcao: dados.proximaAcao || null,
        },
      });
    });
    revalidarLead();
  });
}

export async function atualizarDatas(id: string, input: DatasInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const { fusoDataExperimental, ...entrada } = input;
    const experimental = typeof entrada.dataExperimental === "string" && VALOR_CAMPO_LOCAL.test(entrada.dataExperimental)
      ? exigirInstanteDoCampoLocal(entrada.dataExperimental, fusoDataExperimental).toISOString()
      : entrada.dataExperimental;
    const dados = analisarComDatasDaEscola(DatasSchema, { ...entrada, dataExperimental: experimental }, await fusoDaEscola());
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          proximoFollowUp: dados.proximoFollowUp ?? null,
          dataExperimental: dados.dataExperimental ?? null,
          dataProposta: dados.dataProposta ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "DatasAtualizadas",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          proximoFollowUp: dados.proximoFollowUp?.toISOString() ?? null,
          proximoFollowUpCivil: dataCivilOriginal(input.proximoFollowUp, dados.proximoFollowUp),
          dataExperimental: dados.dataExperimental?.toISOString() ?? null,
          dataProposta: dados.dataProposta?.toISOString() ?? null,
          dataPropostaCivil: dataCivilOriginal(input.dataProposta, dados.dataProposta),
        },
      });
    });
    revalidarLead();
  });
}

export async function moverEtapa(id: string, etapa: EtapaLead): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await prisma.$transaction((tx) => moverEtapaTx(tx, autor, id, etapa));
    revalidarLead();
  });
}

export async function registrarInteracao(id: string, input: InteracaoInput & { chaveIdempotencia?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = InteracaoSchema.parse(input);
    const payload = { canal: dados.canal || null, nota: dados.nota };
    const marca = marcaIdempotencia(ChaveIdempotenciaSchema.optional().parse(input.chaveIdempotencia), { leadId: id, ...payload });
    await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "InteracaoRegistrada", agregadoTipo: "Lead", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra interação. Recarregue a página e confira o histórico antes de repetir.",
        });
        if (repetido) return;
      }
      await registrarEvento(tx, {
        tipo: "InteracaoRegistrada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { ...payload, ...marca },
      });
    });
    revalidarLead();
  });
}

export async function agendarExperimental(
  id: string,
  input: AgendarExperimentalInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = AgendarExperimentalSchema.parse(input);
    const data = dados.dataLocal ? exigirInstanteDoCampoLocal(dados.dataLocal, dados.fuso) : new Date(dados.dataISO ?? "");
    if (isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    const professorId = dados.professorId ?? null;
    if (professorId) await exigirProfessorValido(professorId);

    const anterior = await professorAtribuido(prisma, id);
    const mudouProfessor = professorId !== anterior;
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          dataExperimental: data,
          professorExperimentalId: professorId,
          experimentalConfirmadaEm: null,
          aguardandoReagendamentoEm: null,
        },
      });
      await registrarEvento(tx, {
        tipo: "ExperimentalAgendada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: data.toISOString() },
      });
      if (mudouProfessor) {
        await registrarEvento(tx, {
          tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
          agregadoTipo: "Lead",
          agregadoId: id,
          autorId: autor.id,
          payload: { de: anterior, professorId },
        });
      }
    });
    revalidarLead();
    revalidatePath("/home");
  });
}

export async function enviarProposta(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    await prisma.$transaction(async (tx) => {
      const agora = new Date();
      await tx.oportunidade.update({
        where: { id },
        data: { etapa: EtapaLead.PROPOSTA, dataProposta: agora },
      });
      await registrarEvento(tx, {
        tipo: "PropostaEnviada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: agora.toISOString() },
      });
    });
    revalidarLead();
  });
}

export async function marcarPerdido(id: string, input: PerdaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = PerdaSchema.parse(input);
    await prisma.$transaction(tx => marcarPerdidoTx(tx, autor, id, dados).then(() => undefined));
    revalidarLead();
  });
}

export async function anexarDocumentoLead(
  leadId: string,
  doc: { categoria: CategoriaDocumento; nome: string; url: string },
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    if (!doc.url) throw new ErroRegra("Faça o upload do arquivo antes de salvar.");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${leadId} FOR UPDATE`;
      await exigirDocumentoPermitido(leadId, doc.categoria, autor, tx);
      await exigirArquivoVinculavel(autor, doc.url, { leadId, categoriaDocumento: doc.categoria }, tx);
      const jaAnexado = await tx.documento.findFirst({ where: { leadId, url: doc.url, arquivado: false }, select: { categoria: true, nome: true } });
      if (jaAnexado) {
        if (jaAnexado.categoria === doc.categoria && jaAnexado.nome === doc.nome) return;
        throw new ErroRegra("Este arquivo já está anexado a esta oportunidade com outro nome. Recarregue a página e confira os documentos.");
      }
      await tx.documento.create({
        data: { leadId, categoria: doc.categoria, nome: doc.nome, url: doc.url },
      });
      await registrarEvento(tx, {
        tipo: "DocumentoAnexado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { categoria: doc.categoria, nome: doc.nome },
      });
    });
    revalidarLead();
  });
}

export async function arquivarDocumentoLead(documentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const doc = await prisma.documento.findUnique({ where: { id: documentoId } });
    if (!doc) throw new ErroRegra("Documento não encontrado.");
    if (!doc.leadId) throw new ErroPermissao("Use a secretaria para alterar o documento da matrícula.");
    const leadId = doc.leadId;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR UPDATE`;
      await exigirDocumentoPermitido(leadId, doc.categoria, autor, tx);
      const atual = await tx.documento.findUnique({ where: { id: documentoId }, select: { arquivado: true } });
      if (atual?.arquivado) return;
      const contratoEmUso = await tx.matricula.findFirst({ where: { contratoDocumentoId: documentoId, contratoOk: true }, select: { id: true } });
      if (contratoEmUso) throw new ErroRegra("Registre a substituição contratual antes de arquivar um contrato confirmado.");
      await tx.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
      await registrarEvento(tx, {
        tipo: "DocumentoArquivado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { documentoId, nome: doc.nome },
      });
    });
    revalidarLead();
  });
}

export async function checkinExperimental(leadId: string, compareceu: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.PROFESSOR);

    const etapa = compareceu ? EtapaLead.EXPERIMENTAL_REALIZADA : EtapaLead.NO_SHOW;
    const proximaAcao = compareceu ? "Comercial: apresentar proposta" : "Remarcar experimental";
    const tipo = compareceu ? "ExperimentalRealizada" : "NoShow";

    const repetido = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.oportunidade.findUnique({ where: { id: leadId } });
      if (!lead) throw new ErroRegra("Lead não encontrado.");

      const ehAdmin = autor.papeis.includes(Papel.ADMINISTRADOR);
      if (!ehAdmin) {
        if (!professorNoEscopoExperimental(lead.professorExperimentalId, autor.id)) {
          throw new ErroPermissao("Esta experimental não está atribuída a você.");
        }
      }

      if (lead.etapa === etapa) {
        const ultimo = await tx.evento.findFirst({
          where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: { in: ["ExperimentalRealizada", "NoShow"] } },
          orderBy: { criadoEm: "desc" }, select: { tipo: true, autorId: true },
        });
        if (ultimo?.tipo === tipo && ultimo.autorId === autor.id) return true;
      }

      if (!podeCheckinExperimental(lead.etapa)) {
        throw new ErroRegra("Não há experimental agendada para check-in neste lead.");
      }

      await tx.oportunidade.update({ where: { id: leadId }, data: { etapa, proximaAcao } });
      await registrarEvento(tx, {
        tipo,
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { data: new Date().toISOString() },
      });
      return false;
    });
    if (repetido) return;
    revalidatePath("/home");
    revalidatePath("/funil");
  });
}

export async function atribuirProfessorExperimental(
  leadId: string,
  professorId: string,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    await exigirProfessorValido(professorId);

    const anterior = await professorAtribuido(prisma, leadId);
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id: leadId },
        data: { professorExperimentalId: professorId },
      });
      await registrarEvento(tx, {
        tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { de: anterior, professorId },
      });
    });
    revalidarLead();
    revalidatePath("/home");
  });
}

export async function atribuirDono(
  id: string,
  vendedorId: string,
  motivo?: string,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const lead = await exigirLeadVisivel(id, autor, tx);
      await exigirDestinoComercial(autor, vendedorId, tx);
      if (lead.vendedorDonoId === vendedorId) return;
      await tx.oportunidade.update({ where: { id }, data: { vendedorDonoId: vendedorId } });
      await tx.atendimentoWhatsApp.updateMany({ where: { leadId: id, finalidade: "COMERCIAL", encerradoEm: null, status: "ABERTO_SEM_RESPONSAVEL" }, data: { responsavelId: vendedorId, status: "EM_ATENDIMENTO" } });
      await tx.atendimentoWhatsApp.updateMany({ where: { leadId: id, finalidade: "COMERCIAL", encerradoEm: null }, data: { responsavelId: vendedorId } });
      if (lead.vendedorDonoId) await tx.intencaoMensagem.updateMany({ where: { OR: [{ leadId: id }, { atendimento: { is: { leadId: id, finalidade: "COMERCIAL" } } }], origem: "HUMANO", autorId: lead.vendedorDonoId, status: { in: ["PENDENTE", "ADIADA"] } }, data: { status: "CANCELADA", motivoFalha: "Carteira transferida; revisar responsável antes de enviar." } });
      await registrarEvento(tx, {
        tipo: "LeadAtribuido",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: lead.vendedorDonoId, para: vendedorId, motivo: motivo || null },
      });
    });
    revalidarLead();
  });
}
