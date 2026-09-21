import PDFDocument from "pdfkit";
import { openSync } from "fontkit";
import path from "node:path";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { TextoPreviaSchema } from "./previa-projecao";
import { ErroRegra } from "@/server/_shared/sessao";

const EntradaPdf = z.object({ previaId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), criadaEm: z.date(), conteudoHash: z.string().regex(/^[a-f0-9]{64}$/), snapshot: TextoPreviaSchema });
const EntradaAditivoPdf = z.object({ propostaId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), criadaEm: z.date(),
  propostaHash: z.string().regex(/^[a-f0-9]{64}$/), modeloCodigo: z.string(), modeloVersao: z.number().int().positive(),
  versaoProposta: z.number().int().positive(), ambiente: z.enum(["SANDBOX", "PRODUCAO", "HISTORICO"]), documento: TextoPreviaSchema.shape.documento }).strict();
const EntradaOriginalAditivoPdf = EntradaAditivoPdf.extend({ conferenciaId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), conferenciaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const regular = path.join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"), negrito = path.join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf");

/** PDF da prévia preservada. Não é o documento liberado ao serviço de assinatura. */
export async function gerarPdfPrevia(input: z.input<typeof EntradaPdf>) {
  return renderizar(input, false);
}

/** Consulta da proposta preservada. Não gera o original do aditivo para assinatura. */
export async function gerarPdfPreviaAditivo(input: z.input<typeof EntradaAditivoPdf>) {
  const d = EntradaAditivoPdf.parse(input);
  return renderizarDocumento({ registroId: d.propostaId, criadaEm: d.criadaEm, conteudoHash: d.propostaHash,
    modeloCodigo: d.modeloCodigo, modeloVersao: d.modeloVersao, rotuloVersao: `Proposta de aditivo - versão ${d.versaoProposta}`,
    documento: d.documento, assunto: "Prévia de aditivo sem assinatura", cabecalho: `PRÉVIA DE ADITIVO - SEM ASSINATURA${d.ambiente === "SANDBOX" ? " - AMBIENTE DE TESTE" : d.ambiente === "HISTORICO" ? " - CONTRATO DE ORIGEM HISTÓRICA" : ""}` });
}

/** Original binário do aditivo; ainda depende das assinaturas e da aplicação aprovadas. */
export async function gerarPdfOriginalAditivo(input: z.input<typeof EntradaOriginalAditivoPdf>) {
  const d = EntradaOriginalAditivoPdf.parse(input);
  const pdf = await renderizarDocumento({ registroId: d.conferenciaId, criadaEm: d.criadaEm, conteudoHash: d.conferenciaHash,
    modeloCodigo: d.modeloCodigo, modeloVersao: d.modeloVersao, rotuloVersao: `Aditivo - proposta versão ${d.versaoProposta}\nProposta ${d.propostaId} - SHA-256 ${d.propostaHash}`,
    documento: d.documento, assunto: "Original de aditivo para assinatura", cabecalho: `ADITIVO CONTRATUAL${d.ambiente === "SANDBOX" ? " - AMBIENTE DE TESTE" : d.ambiente === "HISTORICO" ? " - CONTRATO DE ORIGEM HISTÓRICA" : ""}` });
  return { ...pdf, gerador: { ...metadadosGerador(), versao: "aditivo-original-1" } };
}

function metadadosGerador() {
  return { versao: "contrato-original-1", pdfkit: "0.20.2", fontkit: "2.0.4",
    fontes: [
      { nome: "NotoSans-Regular.ttf", sha256: createHash("sha256").update(readFileSync(regular)).digest("hex") },
      { nome: "NotoSans-Bold.ttf", sha256: createHash("sha256").update(readFileSync(negrito)).digest("hex") },
    ] };
}

/** Bytes do original a preservar, antes de qualquer assinatura externa. */
export async function gerarPdfOriginal(input: z.input<typeof EntradaPdf>) {
  const pdf = await renderizar(input, true);
  return { ...pdf, gerador: metadadosGerador() };
}

async function renderizar(input: z.input<typeof EntradaPdf>, original: boolean) {
  const d = EntradaPdf.parse(input);
  return renderizarDocumento({ registroId: d.previaId, criadaEm: d.criadaEm, conteudoHash: d.conteudoHash,
    modeloCodigo: d.snapshot.modeloCodigo, modeloVersao: d.snapshot.modeloVersao,
    rotuloVersao: `Condições de entrada - versão ${d.snapshot.condicoesVersao}`, documento: d.snapshot.documento,
    assunto: original ? "Original contratual" : "Prévia contratual sem assinatura",
    cabecalho: original ? "DOCUMENTO CONTRATUAL" : "PRÉVIA CONTRATUAL - SEM ASSINATURA" });
}

async function renderizarDocumento(d: { registroId: string; criadaEm: Date; conteudoHash: string; modeloCodigo: string;
  modeloVersao: number; rotuloVersao: string; documento: z.infer<typeof TextoPreviaSchema>["documento"]; assunto: string; cabecalho: string }) {
  const texto = d.documento;
  const fontes = [openSync(regular), openSync(negrito)];
  const textos = [texto.titulo, d.modeloCodigo, ...texto.secoes.flatMap((s) => [s.titulo, s.texto])];
  if (textos.reduce((n, t) => n + t.length, 0) > 250000) throw new ErroRegra("Prévia excede o limite de geração. Revise a estrutura do documento.");
  for (const t of textos) for (const char of new Set(t)) {
    if (char === "\n" || char === "\r" || char === "\t") continue;
    if (!fontes.every((f) => "hasGlyphForCodePoint" in f && f.hasGlyphForCodePoint(char.codePointAt(0)!))) throw new ErroRegra(`A fonte do PDF não suporta o caractere ${char}. Providencie uma fonte compatível antes de gerar o documento.`);
  }
  const doc = new PDFDocument({ size: "A4", margins: { top: 62, bottom: 65, left: 54, right: 54 }, bufferPages: true, font: regular,
    info: { Title: texto.titulo, Author: "ERP Genius", Subject: d.assunto, CreationDate: d.criadaEm, ModDate: d.criadaEm } });
  const chunks: Buffer[] = [];
  const fim = new Promise<Buffer>((resolve, reject) => { doc.on("data", (c: Buffer) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  doc.registerFont("Normal", regular); doc.registerFont("Negrito", negrito);
  const largura = doc.page.width - 108;
  doc.font("Negrito").fontSize(18).fillColor("#18202d").text(texto.titulo, { width: largura });
  doc.moveDown(0.5).font("Normal").fontSize(9).fillColor("#475569").text(`Modelo ${d.modeloCodigo} - versão ${d.modeloVersao}\n${d.rotuloVersao}`, { width: largura });
  doc.moveDown(1);
  for (const s of texto.secoes) {
    doc.font("Negrito").fontSize(12);
    const alturaTitulo = doc.heightOfString(s.titulo, { width: largura });
    if (doc.y + alturaTitulo + 42 > doc.page.height - 65) doc.addPage();
    doc.fillColor("#18202d").text(s.titulo, { width: largura });
    doc.moveDown(0.35).font("Normal").fontSize(10.5).fillColor("#18202d").text(s.texto, { width: largura, lineGap: 3, paragraphGap: 5 });
    doc.moveDown(0.8);
  }
  const paginas = doc.bufferedPageRange().count;
  for (let i = 0; i < paginas; i++) {
    doc.switchToPage(i);
    // Rodapé não participa da quebra automática: usa coordenadas e margem local.
    doc.page.margins.bottom = 0;
    doc.font("Negrito").fontSize(8).fillColor("#475569").text(d.cabecalho, 54, 27, { width: largura, lineBreak: false });
    doc.font("Normal").fontSize(7).text(`Registro ${d.registroId} | Página ${i + 1} de ${paginas}`, 54, doc.page.height - 48, { width: largura, lineBreak: false });
    doc.fontSize(6.5).text(`Referência de integridade: ${d.conteudoHash}`, 54, doc.page.height - 35, { width: largura, lineBreak: false });
  }
  doc.end();
  const bytes = await fim;
  return { bytes, paginas, sha256: createHash("sha256").update(bytes).digest("hex") };
}
