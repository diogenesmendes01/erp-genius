"use server";

import { revalidatePath } from "next/cache";
import { Papel, EtapaLead, CategoriaDocumento, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import {
  exigirSessao,
  exigirSessaoComPapel,
  exigirPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  ehEtapaManual,
  transicaoManualPermitida,
  resolverDonoLead,
  normalizarTelefoneE164,
  podeCheckinExperimental,
  professorNoEscopoExperimental,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import {
  EVENTO_EXPERIMENTAL_ATRIBUIDA,
  professorAtribuido,
} from "./experimental";
import { dispararCopilotoMudancaEtapa } from "@/server/ia/copiloto";

/** DDI do país do lead (para normalizar o telefone); "" se sem país. */
async function ddiDoPais(paisId?: string | null): Promise<string> {
  if (!paisId) return "";
  return (await prisma.pais.findUnique({ where: { id: paisId } }))?.ddi ?? "";
}
import {
  LeadSchema,
  ResumoSchema,
  DatasSchema,
  InteracaoSchema,
  PerdaSchema,
  AgendarExperimentalSchema,
  ConfigComercialSchema,
  ReguaComercialSchema,
  NotaInternaSchema,
  type LeadInput,
  type ResumoInput,
  type DatasInput,
  type InteracaoInput,
  type PerdaInput,
  type AgendarExperimentalInput,
  type ConfigComercialInput,
  type ReguaComercialInput,
  type NotaInternaInput,
} from "./schema";
import { Temperatura } from "@prisma/client";
import { CADENCIAS_COMERCIAIS } from "./regua-fabrica";

/** Valida que `professorId` aponta para um usuário com papel PROFESSOR. */
async function exigirProfessorValido(professorId: string) {
  const professor = await prisma.usuario.findUnique({ where: { id: professorId } });
  if (!professor) throw new ErroRegra("Professor não encontrado.");
  if (!professor.papeis.includes(Papel.PROFESSOR)) {
    throw new ErroRegra("Usuário informado não é professor.");
  }
}

const PAPEIS_COMERCIAL: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];

const DATA_CIVIL_LITERAL = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * O banco mantém datas como instantes. No evento, porém, conservamos também a
 * data civil que a pessoa informou quando ela estava explícita e válida. Isso
 * evita que uma leitura histórica escolha retroativamente um fuso inexistente.
 */
function dataCivilOriginal(valor: unknown, normalizada: Date | undefined) {
  if (typeof valor !== "string" || !normalizada) return null;
  const partes = DATA_CIVIL_LITERAL.exec(valor);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  if (calendario.getUTCFullYear() !== ano || calendario.getUTCMonth() !== mes - 1 || calendario.getUTCDate() !== dia) return null;
  return normalizada.getFullYear() === ano && normalizada.getMonth() === mes - 1 && normalizada.getDate() === dia ? valor : null;
}

function revalidarLead(id?: string) {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  // A inbox mostra o funil do lead no cockpit da thread — mudou o lead, a thread reflete.
  revalidatePath("/inbox");
  if (id) revalidatePath(`/leads/${id}`);
}

/** Carrega o lead garantindo que o usuário pode vê-lo (vendedor só os próprios). */
async function exigirLeadVisivel(id: string, usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  exigirPapel(usuario, ...PAPEIS_COMERCIAL);
  const lead = await tx.lead.findFirst({ where: { AND: [{ id }, await escopoComercialAtual(usuario, tx)] } });
  if (!lead) throw new ErroPermissao("Lead fora da sua carteira autorizada.");
  return lead;
}

async function exigirDestinoComercial(usuario: UsuarioSessao, id: string | null, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!id) {
    if (!usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroRegra("Selecione um vendedor da sua equipe.");
    return;
  }
  const destino = await tx.usuario.findFirst({ where: { id, ativo: true, papeis: { has: Papel.VENDEDOR } }, select: { id: true, gerenteComercialId: true } });
  if (!destino) throw new ErroRegra("Selecione um vendedor ativo.");
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && destino.id !== usuario.id &&
    !(usuario.papeis.includes(Papel.GERENTE_COMERCIAL) && destino.gerenteComercialId === usuario.id)) {
    throw new ErroPermissao("O vendedor não pertence à sua equipe.");
  }
}

async function exigirDocumentoPermitido(leadId: string, categoria: CategoriaDocumento, usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!Object.values(CategoriaDocumento).includes(categoria)) throw new ErroRegra("Categoria inválida.");
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return;
  if (categoria === CategoriaDocumento.OUTRO) throw new ErroRegra("Classifique o documento pela finalidade antes de compartilhá-lo.");
  if (usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    const matricula = await tx.matricula.findUnique({ where: { leadId }, select: { secretariaAssumiuEm: true } });
    if (matricula?.secretariaAssumiuEm) return;
    // Acumular secretaria não revoga a coleta inicial já autorizada pela carteira.
    if (!usuario.papeis.some((p) => p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL || p === Papel.PROFESSOR)) throw new ErroPermissao("Assuma a matrícula antes de alterar os documentos administrativos.");
  }
  if (categoria === CategoriaDocumento.TESTE_NIVEL && usuario.papeis.includes(Papel.PROFESSOR)) {
    const experimental = await tx.lead.findFirst({ where: { id: leadId, professorExperimentalId: usuario.id }, select: { id: true } });
    if (experimental) return;
  }
  await exigirLeadVisivel(leadId, usuario, tx);
  const matricula = await tx.matricula.findUnique({ where: { leadId }, select: { secretariaAssumiuEm: true } });
  if (matricula?.secretariaAssumiuEm && categoria !== CategoriaDocumento.PROPOSTA) throw new ErroPermissao("Solicite a correção documental à secretaria.");
}

export async function criarLead(input: LeadInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const dados = LeadSchema.parse(input);

    // Vendedor vira dono por padrão; só gerente/admin podem atribuir a outro vendedor.
    // O servidor ignora qualquer vendedorDonoId enviado por um vendedor (doc 09).
    const donoId = resolverDonoLead(autor, dados.vendedorDonoId);
    await exigirDestinoComercial(autor, donoId);
    const ddi = await ddiDoPais(dados.paisId);

    const id = await prisma.$transaction(async (tx) => {
      const codigo = await gerarCodigo("lead");
      const lead = await tx.lead.create({
        data: {
          codigo,
          nome: dados.nome,
          telefoneE164: normalizarTelefoneE164(dados.telefoneE164, ddi),
          paisId: dados.paisId || null,
          segmento: dados.segmento,
          temperatura: dados.temperatura,
          b2b: dados.b2b,
          vendedorDonoId: donoId,
          origemCampanha: dados.origemCampanha || null,
          origemConjunto: dados.origemConjunto || null,
          origemAnuncio: dados.origemAnuncio || null,
          origemPalavra: dados.origemPalavra || null,
          valorPrevisto: dados.valorPrevisto ?? null,
          planoPrevisto: dados.planoPrevisto || null,
          comissaoPrevista: dados.comissaoPrevista ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadCriado",
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        autorId: autor.id,
        payload: { codigo, nome: lead.nome, segmento: lead.segmento, b2b: lead.b2b },
      });
      if (donoId) {
        await registrarEvento(tx, {
          tipo: "LeadAtribuido",
          agregadoTipo: "Lead",
          agregadoId: lead.id,
          autorId: autor.id,
          payload: { de: null, para: donoId },
        });
      }
      return lead.id;
    });

    revalidarLead(id);
    return { id };
  });
}

// ── Cockpit do vendedor na inbox (doc 08 §CRM alimentado pela conversa) ──────
// Ações pequenas para o vendedor operar o funil SEM sair da conversa. Reusam as mesmas
// garantias das telas: papel comercial, escopo row-level do lead e evento auditável.

/**
 * NOTA INTERNA sobre o lead: comentário da equipe, **nunca enviado ao contato**.
 * Distinta de `registrarInteracao` (que registra um contato REAL — ligação/presencial).
 */
export async function registrarNotaInterna(leadId: string, input: NotaInternaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    const { nota } = NotaInternaSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "NotaInterna",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { nota },
      });
    });
    revalidarLead(leadId);
  });
}

/** Temperatura do lead em 1 clique (Quente/Morno/Frio) — sem abrir o formulário inteiro. */
export async function definirTemperatura(leadId: string, temperatura: Temperatura): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(leadId, autor);
    if (!Object.values(Temperatura).includes(temperatura)) throw new ErroRegra("Temperatura inválida.");
    if (lead.temperatura === temperatura) return;

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data: { temperatura } });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { de: lead.temperatura, temperatura, campo: "temperatura" },
      });
    });
    revalidarLead(leadId);
  });
}

export async function editarLead(id: string, input: LeadInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const dados = LeadSchema.parse(input);
    const ddi = await ddiDoPais(dados.paisId);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${id} FOR UPDATE`;
      const leadAtual = await exigirLeadVisivel(id, autor, tx);
      const matricula = await tx.matricula.findUnique({ where: { leadId: id }, select: { secretariaAssumiuEm: true } });
      const alteraCadastro = dados.nome !== leadAtual.nome || normalizarTelefoneE164(dados.telefoneE164, ddi) !== leadAtual.telefoneE164 || (dados.paisId || null) !== leadAtual.paisId;
      if (matricula?.secretariaAssumiuEm && alteraCadastro && !autor.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA)) throw new ErroPermissao("A secretaria assumiu a matrícula. Solicite a correção cadastral.");
      await tx.lead.update({
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
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { nome: dados.nome, temperatura: dados.temperatura },
      });
    });
    revalidarLead(id);
  });
}

export async function atualizarResumo(id: string, input: ResumoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = ResumoSchema.parse(input);
    // Evento na MESMA transação da mutação (issue #1: resumo alterava sem auditoria).
    // Tipo específico ResumoAtualizado com payload completo, consumido pela linha
    // do tempo da ficha do lead (issue #43).
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
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
    revalidarLead(id);
  });
}

export async function atualizarDatas(id: string, input: DatasInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = DatasSchema.parse(input);
    // Evento na MESMA transação da mutação (issue #1: datas alteravam sem auditoria).
    // Tipo específico DatasAtualizadas com payload completo, consumido pela linha
    // do tempo da ficha do lead (issue #43).
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
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
    revalidarLead(id);
  });
}

export async function moverEtapa(id: string, etapa: EtapaLead): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(id, autor);
    if (lead.etapa === etapa) return;

    // Etapas geradas por evento (Exp. Realizada, Proposta, Aguardando Matrícula…)
    // e saídas paralelas (Perdido/Matriculado) NÃO se movem por arraste.
    if (!ehEtapaManual(etapa)) {
      throw new ErroRegra(
        "Esta etapa é definida por uma ação específica (agendar/realizar experimental, " +
          "enviar proposta, marcar perdido ou converter em matrícula), não pelo arraste.",
      );
    }
    // Valida a máquina de estados origem→destino — bloqueia saltos inválidos no
    // backend mesmo que o client envie um destino fora da sequência (doc 10 §1).
    if (!transicaoManualPermitida(lead.etapa, etapa)) {
      throw new ErroRegra(
        `Transição inválida: não é possível mover de "${lead.etapa}" para "${etapa}".`,
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { etapa } });
      await registrarEvento(tx, {
        tipo: "EtapaAlterada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: lead.etapa, para: etapa, origem: "manual" },
      });
    });
    // C3 (doc 27): mudança de etapa é gatilho do copiloto — pós-commit, nunca derruba a
    // ação (erro só loga) e é no-op com o copiloto desligado.
    await dispararCopilotoMudancaEtapa(id);
    revalidarLead(id);
  });
}

export async function registrarInteracao(id: string, input: InteracaoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = InteracaoSchema.parse(input);
    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "InteracaoRegistrada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { canal: dados.canal || null, nota: dados.nota },
      });
    });
    revalidarLead(id);
  });
}

/** Agenda a experimental e (opcionalmente) grava o professor responsável na FK
 * `professorExperimentalId` — escopo que a Home do professor e o check-in usam
 * (Issue #13). O vínculo também é auditado no event log. */
export async function agendarExperimental(
  id: string,
  input: AgendarExperimentalInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = AgendarExperimentalSchema.parse(input);
    const data = new Date(dados.dataISO);
    if (isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    // Schema normaliza "" → null; `?? null` cobre o campo ausente. Sempre
    // persistimos a FK para que "Definir depois" limpe o responsável anterior.
    const professorId = dados.professorId ?? null;
    if (professorId) await exigirProfessorValido(professorId);

    // Estado atual da FK para auditar só quando o responsável mudar (incl. remoção).
    const anterior = await professorAtribuido(prisma, id);
    const mudouProfessor = professorId !== anterior;
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          dataExperimental: data,
          professorExperimentalId: professorId,
          // (Re)agendar abre uma OCORRÊNCIA nova: a confirmação do compromisso ANTERIOR não
          // vale para o novo horário (review PR #56). Sem este reset o lead ficaria
          // "confirmado" para sempre e a resposta ao novo lembrete nem gravaria evento.
          experimentalConfirmadaEm: null,
          // B8 (doc 32): remarcar É a ação humana que o pedido de REAGENDAR esperava —
          // libera a cadência pré-experimental para a ocorrência nova.
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
      // Auditoria do vínculo: mesmo evento para atribuição/remanejamento e
      // remoção (professorId null). Só registra quando houve mudança.
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
    revalidarLead(id);
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
      await tx.lead.update({
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
    revalidarLead(id);
  });
}

export async function marcarPerdido(id: string, input: PerdaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = PerdaSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { etapa: EtapaLead.PERDIDO, motivoPerda: dados.motivoPerda },
      });
      await registrarEvento(tx, {
        tipo: "LeadPerdido",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { motivoPerda: dados.motivoPerda, observacao: dados.observacao || null },
      });
    });
    revalidarLead(id);
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
    revalidarLead(leadId);
  });
}

/** Arquiva o documento (soft-delete — doc 10 §6: ninguém apaga nada). */
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
    revalidarLead(leadId);
  });
}

/** Check-in da experimental (professor): Compareceu → Experimental Realizada · Faltou → No-show.
 * Devolve o lead à fila do comercial (doc 09 §Visão do Professor).
 *
 * Escopo do professor (Issue #13): valida papel, etapa atual (precisa haver uma
 * experimental AGENDADA) e a associação professor↔experimental (FK
 * `professorExperimentalId`). Fora do escopo → ErroPermissao; etapa errada →
 * ErroRegra. */
export async function checkinExperimental(leadId: string, compareceu: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    // 1) papel: só professor (Admin passa em exigirPapel)
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.PROFESSOR);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new ErroRegra("Lead não encontrado.");

    // 2) etapa/agendamento: só vale enquanto há uma experimental agendada
    if (!podeCheckinExperimental(lead.etapa)) {
      throw new ErroRegra("Não há experimental agendada para check-in neste lead.");
    }

    // 3) escopo: o professor precisa estar atribuído a esta experimental (FK).
    //    Admin (passa em temPapel mas não é professor literal) ignora o vínculo.
    const ehAdmin = autor.papeis.includes(Papel.ADMINISTRADOR);
    if (!ehAdmin) {
      if (!professorNoEscopoExperimental(lead.professorExperimentalId, autor.id)) {
        throw new ErroPermissao("Esta experimental não está atribuída a você.");
      }
    }

    const etapa = compareceu ? EtapaLead.EXPERIMENTAL_REALIZADA : EtapaLead.NO_SHOW;
    const proximaAcao = compareceu ? "Comercial: apresentar proposta" : "Remarcar experimental";

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data: { etapa, proximaAcao } });
      await registrarEvento(tx, {
        tipo: compareceu ? "ExperimentalRealizada" : "NoShow",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { data: new Date().toISOString() },
      });
    });
    revalidatePath("/home");
    revalidatePath("/leads");
    revalidatePath("/pipeline");
  });
}

/** Atribui (ou remaneja) o professor responsável por uma experimental — define o
 * escopo que a Home do professor e o check-in usam (Issue #13). Comercial/Admin.
 * Grava a FK `professorExperimentalId` (fonte de verdade) e audita no event log. */
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
      await tx.lead.update({
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
    revalidarLead(leadId);
    revalidatePath("/home");
  });
}

// Config comercial C1 (doc 27): auto-lead + saudação. Alçada = Gerente Comercial (dono da
// automação comercial) + Admin. Evento auditável (antes→depois) — mudar quem o robô fala
// em nome da escola é uma ação sensível.
export async function salvarConfigComercial(input: ConfigComercialInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const dados = ConfigComercialSchema.parse(input);

    // C5: armar a gestão exige número remetente EXISTENTE e ativo (prontidão, como nas réguas).
    if (dados.gestaoEstado !== "DESLIGADA" && dados.gestaoNumeroId) {
      const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: dados.gestaoNumeroId } });
      if (!numero || !numero.ativo) throw new ErroRegra("Número remetente da gestão inexistente ou inativo.");
    }

    await prisma.$transaction(async (tx) => {
      const antes = await tx.configComercial.findUnique({ where: { id: "comercial" } });
      await tx.configComercial.upsert({
        where: { id: "comercial" },
        create: { id: "comercial", ...dados },
        update: dados,
      });
      await registrarEvento(tx, {
        tipo: "ConfigComercialAlterada",
        agregadoTipo: "ConfigComercial",
        agregadoId: "comercial",
        autorId: autor.id,
        payload: {
          antes: antes
            ? {
                autoLeadAtivo: antes.autoLeadAtivo,
                saudacaoEstado: antes.saudacaoEstado,
                saudacaoTexto: antes.saudacaoTexto,
                copilotoAtivo: antes.copilotoAtivo,
                copilotoQuietudeMinutos: antes.copilotoQuietudeMinutos,
                matriculaAutomaticaAtiva: antes.matriculaAutomaticaAtiva,
                gestaoEstado: antes.gestaoEstado,
                gestaoTelefoneE164: antes.gestaoTelefoneE164,
              }
            : null,
          depois: dados,
        },
      });
    });
    revalidatePath("/configuracao/whatsapp");
  });
}

// Régua comercial "lead novo sem resposta" (doc 27 C1). Gerente Comercial/Admin. A ORDEM
// dos passos é lei de código (regua-fabrica) — a UI só edita offset/ativo/template + estado.
export async function salvarReguaComercial(input: ReguaComercialInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const dados = ReguaComercialSchema.parse(input);
    if (dados.janelaFim <= dados.janelaInicio) throw new ErroRegra("A janela precisa terminar depois de começar.");

    // Só passos da cadência CANÔNICA daquele cenário entram (ordem imutável — review PR #54).
    const cadencia = CADENCIAS_COMERCIAIS.find((c) => c.chave === dados.chave);
    if (!cadencia) throw new ErroRegra(`Cenário de régua desconhecido: ${dados.chave}.`);
    const rotuloPorPasso = new Map(cadencia.degraus.map((d) => [d.passo, d.rotulo]));
    for (const d of dados.degraus) {
      if (!rotuloPorPasso.has(d.passo)) throw new ErroRegra(`Passo desconhecido na cadência: ${d.passo}.`);
    }

    // A ORDEM CANÔNICA é lei (review PR #55 P2). O motor corta o progresso pela ordem de
    // fábrica, mas o loader ordena os degraus por OFFSET: se a UI gravasse +4h antes de
    // +30min, o +4h sairia primeiro e o +30min ficaria eliminado para sempre (forward-only).
    // Exige-se, então: todos os passos, uma única vez, com offsets ESTRITAMENTE CRESCENTES
    // na ordem de fábrica. Vale para as três cadências — inclusive a pré-experimental, cujos
    // offsets são NEGATIVOS (-24h antes de -2h continua sendo "estritamente crescente").
    const ordemFabrica = cadencia.degraus.map((d) => d.passo);
    const offsetPorPasso = new Map(dados.degraus.map((d) => [d.passo, d.offsetMinutos]));
    if (offsetPorPasso.size !== dados.degraus.length) {
      throw new ErroRegra("Cada passo da cadência pode aparecer uma única vez.");
    }
    const faltando = ordemFabrica.filter((p) => !offsetPorPasso.has(p));
    if (faltando.length > 0) {
      throw new ErroRegra(`A cadência precisa trazer todos os passos. Faltam: ${faltando.join(", ")}.`);
    }
    let offsetAnterior: number | null = null;
    let passoAnterior: string | null = null;
    for (const passo of ordemFabrica) {
      const offset = offsetPorPasso.get(passo)!;
      if (offsetAnterior !== null && offset <= offsetAnterior) {
        throw new ErroRegra(
          `A ordem da cadência é fixa: o intervalo de ${passo} precisa ser maior que o de ${passoAnterior}.`,
        );
      }
      offsetAnterior = offset;
      passoAnterior = passo;
    }

    // Prontidão (como na cobrança): armar (SHADOW/ATIVA) exige número remetente ativo.
    if (dados.estado !== "DESLIGADA") {
      if (!dados.numeroRemetenteId) throw new ErroRegra("Defina o número remetente antes de armar a régua.");
      const remetente = await prisma.numeroWhatsApp.findUnique({ where: { id: dados.numeroRemetenteId } });
      if (!remetente || !remetente.ativo) throw new ErroRegra("Número remetente inexistente ou inativo.");
      // Remetente OFICIAL: TODO degrau ativo precisa de template APROVADO na Meta (review
      // PR #55 P1). +3d/+7d caem fora da janela de 24h — sem template aprovado o envio falha
      // na API. A régua não pode ser armada num estado que só quebra na hora do disparo.
      if (remetente.driver === "META_CLOUD") {
        const ativos = dados.degraus.filter((d) => d.ativo);
        const ids = ativos.map((d) => d.templateId).filter((id): id is string => !!id);
        const templates = ids.length
          ? await prisma.templateWhatsApp.findMany({ where: { id: { in: ids } }, select: { id: true, statusMeta: true } })
          : [];
        const statusPorId = new Map(templates.map((t) => [t.id, t.statusMeta]));
        const semAprovacao = ativos.filter((d) => !d.templateId || statusPorId.get(d.templateId) !== "APROVADO");
        if (semAprovacao.length > 0) {
          throw new ErroRegra(
            `No número oficial, todo degrau ativo precisa de template aprovado na Meta. Pendentes: ${semAprovacao
              .map((d) => d.passo)
              .join(", ")}.`,
          );
        }
      }
    }

    // B1: allowlist só com leads que EXISTEM (id colado errado não vira lead fantasma que
    // "some" do piloto em silêncio) — e sem duplicatas.
    const idsUnicos = [...new Set(dados.pilotoLeadIds)];
    const leadsExistentes = idsUnicos.length
      ? await prisma.lead.findMany({ where: { id: { in: idsUnicos } }, select: { id: true } })
      : [];
    if (leadsExistentes.length !== idsUnicos.length) {
      throw new ErroRegra("A allowlist do piloto contém leads inexistentes.");
    }
    const leadIdsValidos = leadsExistentes.map((l) => l.id);

    await prisma.$transaction(async (tx) => {
      const existente = await tx.politicaComercial.findUnique({
        where: { chave: dados.chave },
        include: { degraus: true },
      });
      const politicaId = existente
        ? existente.id
        : (await tx.politicaComercial.create({ data: { chave: cadencia.chave, nome: cadencia.nome } })).id;

      await tx.politicaComercial.update({
        where: { id: politicaId },
        data: {
          estado: dados.estado,
          numeroRemetenteId: dados.numeroRemetenteId,
          janelaInicio: dados.janelaInicio,
          janelaFim: dados.janelaFim,
          tetoPorContatoDia: dados.tetoPorContatoDia,
          // B1 (doc 32): cohort do piloto — allowlist explícita; ids inexistentes caem fora.
          modoPiloto: dados.modoPiloto,
          pilotoLeadIds: leadIdsValidos,
        },
      });
      for (const d of dados.degraus) {
        await tx.degrauComercial.upsert({
          where: { politicaId_passo: { politicaId, passo: d.passo } },
          create: {
            politicaId,
            passo: d.passo,
            offsetMinutos: d.offsetMinutos,
            rotulo: rotuloPorPasso.get(d.passo)!,
            ativo: d.ativo,
            templateId: d.templateId,
          },
          update: { offsetMinutos: d.offsetMinutos, ativo: d.ativo, templateId: d.templateId },
        });
      }
      await registrarEvento(tx, {
        tipo: "PoliticaComercialAlterada",
        agregadoTipo: "PoliticaComercial",
        agregadoId: politicaId,
        autorId: autor.id,
        payload: {
          antes: existente
            ? { estado: existente.estado, numeroRemetenteId: existente.numeroRemetenteId }
            : null,
          depois: { estado: dados.estado, numeroRemetenteId: dados.numeroRemetenteId, degraus: dados.degraus },
        },
      });
    });
    revalidatePath("/configuracao/whatsapp");
  });
}

/** Redistribui a carteira; beneficiários de comissões anteriores permanecem intactos. */
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
      await tx.lead.update({ where: { id }, data: { vendedorDonoId: vendedorId } });
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
    revalidarLead(id);
  });
}
