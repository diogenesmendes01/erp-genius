import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StatusFonteConhecimento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverCaminhoUpload } from "@/lib/uploads";
import { uploadLivreDoAutor } from "@/server/uploads/autorizacao";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirSessao,
  registrarEvento,
  type Resultado,
} from "../../_shared";
import { capacidadesAria } from "../permissoes-tela";
import { escolherProvedor, type ProvedorIA } from "../provedor";
import { registrarChamadaIA } from "../uso";
import { dividirEmTrechos, EXTENSOES_ACEITAS } from "./trechos";

// Base de conhecimento da Aria: fontes (texto digitado ou arquivo enviado) divididas em trechos
// pesquisáveis por busca textual (tsvector 'portuguese'). Arquivar não apaga (arquivadaEm).

const PREFIXO_UPLOAD = "/api/files/";
const MAX_TOKENS_EXTRACAO = 16000;
// Tetos (C6): texto da fonte, PDF enviado ao provedor e trechos gravados por fonte. Com 200 mil
// caracteres o divisor gera no máximo ~340 trechos; o teto de trechos é a defesa final.
export const MAX_CARACTERES_FONTE = 200_000;
export const MAX_BYTES_PDF = 10 * 1024 * 1024;
export const MAX_TRECHOS_FONTE = 400;
const MSG_TEXTO_GRANDE = "O texto da fonte aceita até 200 mil caracteres.";
const MSG_VALIDADE = "A validade da fonte precisa ser uma data futura.";
const SISTEMA_EXTRACAO =
  "Extraia todo o texto legível do documento PDF, preservando a ordem e os parágrafos. " +
  "Responda somente com o JSON do esquema, sem comentários.";
const ESQUEMA_EXTRACAO = {
  type: "object",
  properties: { texto: { type: "string" } },
  required: ["texto"],
  additionalProperties: false,
} as const;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function exigirEdicao() {
  const u = await exigirSessao();
  if (!capacidadesAria(u).has("editarComportamento")) {
    throw new ErroPermissao("Sem permissão para editar a base de conhecimento da Aria.");
  }
  return u;
}

interface Gravacao {
  tipo: "TEXTO" | "ARQUIVO";
  nome: string;
  registroUploadId?: string;
  status: StatusFonteConhecimento;
  erro?: string;
  texto: string;
  enviavelAoLead: boolean;
  validoAte?: Date;
  criadoPorId: string;
}

function exigirValidadeFutura(validoAte: Date | undefined): void {
  if (validoAte === undefined || validoAte === null) return;
  if (!(validoAte instanceof Date) || Number.isNaN(validoAte.getTime()) || validoAte.getTime() <= Date.now()) {
    throw new ErroRegra(MSG_VALIDADE);
  }
}

async function gravarFonte(g: Gravacao): Promise<{ id: string }> {
  const trechos = g.status === "PRONTA" ? dividirEmTrechos(g.texto) : [];
  if (trechos.length > MAX_TRECHOS_FONTE) {
    throw new ErroRegra(`A fonte gera mais de ${MAX_TRECHOS_FONTE} trechos. Divida o conteúdo em fontes menores.`);
  }
  return prisma.$transaction(async (tx) => {
    const fonte = await tx.fonteConhecimento.create({
      data: {
        tipo: g.tipo,
        nome: g.nome,
        registroUploadId: g.registroUploadId ?? null,
        status: g.status,
        erro: g.erro ?? null,
        hashConteudo: sha256(g.texto),
        validoAte: g.validoAte ?? null,
        enviavelAoLead: g.enviavelAoLead,
        criadoPorId: g.criadoPorId,
      },
    });
    if (trechos.length > 0) {
      await tx.trechoConhecimento.createMany({
        data: trechos.map((texto, ordem) => ({ fonteId: fonte.id, ordem, texto })),
      });
    }
    await registrarEvento(tx, {
      tipo: "FonteConhecimentoCriada",
      agregadoTipo: "FonteConhecimento",
      agregadoId: fonte.id,
      autorId: g.criadoPorId,
      payload: {
        tipo: g.tipo,
        nome: g.nome,
        status: g.status,
        trechos: trechos.length,
        enviavelAoLead: g.enviavelAoLead,
        registroUploadId: g.registroUploadId ?? null,
      },
    });
    return { id: fonte.id };
  });
}

export async function criarFonteTexto(input: {
  nome: string;
  texto: string;
  enviavelAoLead: boolean;
  validoAte?: Date;
}): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirEdicao();
    const nome = input.nome?.trim() ?? "";
    if (!nome) throw new ErroRegra("Informe o nome da fonte.");
    if (nome.length > 120) throw new ErroRegra("O nome da fonte aceita até 120 caracteres.");
    if (!input.texto?.trim()) throw new ErroRegra("Informe o texto da fonte.");
    if (input.texto.length > MAX_CARACTERES_FONTE) throw new ErroRegra(MSG_TEXTO_GRANDE);
    exigirValidadeFutura(input.validoAte);
    return gravarFonte({
      tipo: "TEXTO",
      nome,
      status: "PRONTA",
      texto: input.texto,
      enviavelAoLead: input.enviavelAoLead,
      validoAte: input.validoAte,
      criadoPorId: u.id,
    });
  });
}

type Extracao = { texto: string } | { erro: string };

async function extrairPdf(buffer: Buffer, provedorInjetado?: ProvedorIA): Promise<Extracao> {
  let provedor = provedorInjetado;
  if (!provedor) {
    const cfg = await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia" }, update: {} });
    provedor = escolherProvedor({ conversa: cfg.modeloConversa, classificacao: cfg.modeloClassificacao });
  }
  const inicio = Date.now();
  let resposta;
  try {
    resposta = await provedor.gerar({
      tarefa: "extracao",
      sistema: SISTEMA_EXTRACAO,
      mensagens: [{ papel: "usuario", texto: "Extraia o texto deste documento." }],
      maxTokens: MAX_TOKENS_EXTRACAO,
      esquemaSaida: ESQUEMA_EXTRACAO as unknown as Record<string, unknown>,
      pdfBase64: buffer.toString("base64"),
    });
  } catch (e) {
    await registrarChamadaIA("INDEXACAO", {
      erro: e instanceof Error ? e.message : "falha",
      modelo: provedor.nome === "simulado" ? "simulado" : "desconhecido",
      latenciaMs: Date.now() - inicio,
    });
    return { erro: "Não foi possível extrair o texto do PDF agora. Tente novamente mais tarde." };
  }
  await registrarChamadaIA("INDEXACAO", resposta);
  if (resposta.recusa) return { erro: "O provedor de IA recusou ler este PDF." };
  let texto = "";
  try {
    const bruto = JSON.parse(resposta.texto) as { texto?: unknown };
    if (typeof bruto.texto === "string") texto = bruto.texto;
  } catch {
    return { erro: "A resposta de extração do PDF veio em formato inválido." };
  }
  if (!texto.trim()) return { erro: "Não foi possível extrair texto deste PDF (documento vazio ou apenas imagem)." };
  if (texto.length > MAX_CARACTERES_FONTE) {
    return { erro: "O texto extraído do PDF passa de 200 mil caracteres. Divida o documento em partes menores." };
  }
  return { texto };
}

export async function criarFonteArquivo(
  input: { registroUploadId: string; enviavelAoLead: boolean; validoAte?: Date },
  deps?: { provedor?: ProvedorIA },
): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirEdicao();
    exigirValidadeFutura(input.validoAte);
    // Autorização por objeto (B1): o texto vira trecho (até enviável ao lead), então só serve upload do
    // próprio autor, sem vínculo nem finalidade. Arquivo de outro objeto responde como inexistente.
    const upload = await uploadLivreDoAutor({ id: u.id, papeis: u.papeis }, input.registroUploadId);
    if (!upload) throw new ErroRegra("Arquivo não encontrado.");
    const ext = path.extname(upload.nome).toLowerCase();
    if (!(EXTENSOES_ACEITAS as readonly string[]).includes(ext)) {
      throw new ErroRegra(`Formato não aceito. Envie ${EXTENSOES_ACEITAS.join(", ")}.`);
    }
    const base = {
      tipo: "ARQUIVO" as const,
      nome: upload.nome,
      registroUploadId: upload.id,
      enviavelAoLead: input.enviavelAoLead,
      validoAte: input.validoAte,
      criadoPorId: u.id,
    };
    const caminho = upload.url.startsWith(PREFIXO_UPLOAD)
      ? resolverCaminhoUpload(upload.url.slice(PREFIXO_UPLOAD.length).split("/").filter(Boolean))
      : null;
    let buffer: Buffer | null = null;
    if (caminho) buffer = await readFile(caminho).catch(() => null);
    if (!buffer) {
      return gravarFonte({ ...base, status: "ERRO", erro: "Arquivo não encontrado no armazenamento.", texto: "" });
    }

    let extracao: Extracao;
    if (ext === ".pdf") {
      if (buffer.length > MAX_BYTES_PDF) throw new ErroRegra("O PDF aceita até 10 MB.");
      extracao = await extrairPdf(buffer, deps?.provedor);
    } else {
      const texto = buffer.toString("utf8").replace(/^\uFEFF/, "");
      if (texto.length > MAX_CARACTERES_FONTE) throw new ErroRegra(MSG_TEXTO_GRANDE);
      extracao = texto.trim() ? { texto } : { erro: "O arquivo está vazio." };
    }
    if ("erro" in extracao) {
      return gravarFonte({ ...base, status: "ERRO", erro: extracao.erro, texto: "" });
    }
    return gravarFonte({ ...base, status: "PRONTA", texto: extracao.texto });
  });
}

export async function arquivarFonte(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirEdicao();
    await prisma.$transaction(async (tx) => {
      const fonte = await tx.fonteConhecimento.findUnique({ where: { id } });
      if (!fonte) throw new ErroRegra("Fonte não encontrada.");
      if (fonte.arquivadaEm) throw new ErroRegra("A fonte já está arquivada.");
      await tx.fonteConhecimento.update({ where: { id }, data: { arquivadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "FonteConhecimentoArquivada",
        agregadoTipo: "FonteConhecimento",
        agregadoId: id,
        autorId: u.id,
        payload: { nome: fonte.nome },
      });
    });
  });
}
