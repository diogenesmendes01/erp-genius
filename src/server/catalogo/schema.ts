import { z } from "zod";
import { Segmento, TipoCobranca } from "@prisma/client";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";

// Schemas compartilhados do Catálogo (form ↔ ação). Ver docs/06 e docs/11.

// Criações pela tela (#166): a mesma chave até o sucesso; o reenvio devolve o registro já criado. Opcional:
// sem ela, cria como antes. Fica fora de `ModalidadeSchema`, que também serve a `editarModalidade`.
const comChave = { chaveIdempotencia: ChaveIdempotenciaSchema.optional() };

export const IdiomaSchema = z.object({
  nome: z.string().min(1, "Informe o nome do idioma"),
  ...comChave,
});
export type IdiomaInput = z.input<typeof IdiomaSchema>;

const numeroOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().positive().nullable(),
);

export const ModalidadeSchema = z.object({
  nome: z.string().min(1, "Informe o nome da modalidade"),
  segmento: z.nativeEnum(Segmento).default(Segmento.ADULTO),
  frequencia: z.string().min(1, "Informe a frequência (ex.: 1x/semana)"),
  horasAula: z.coerce.number().positive("Horas/aula deve ser maior que zero").default(2),
  duracaoPorNivel: z.string().min(1, "Informe a duração por nível (ex.: 3 meses)"),
  aulasPorNivel: numeroOpcional,
  minimoAbrir: z.coerce.number().int().positive("Mínimo deve ser ≥ 1").default(1),
});
export type ModalidadeInput = z.input<typeof ModalidadeSchema>;
export const CriarModalidadeSchema = ModalidadeSchema.extend(comChave);
export type CriarModalidadeInput = z.input<typeof CriarModalidadeSchema>;

export const NivelSchema = z.object({
  idiomaId: z.string().min(1, "Selecione o idioma"),
  codigo: z.string().min(1, "Informe o código (ex.: A1)"),
  ordem: z.coerce.number().int().min(0, "Ordem deve ser ≥ 0"),
  ...comChave,
});
export type NivelInput = z.input<typeof NivelSchema>;

export const ProdutoSchema = z.object({
  idiomaId: z.string().min(1, "Selecione o idioma"),
  modalidadeId: z.string().min(1, "Selecione a modalidade"),
  ...comChave,
});
export type ProdutoInput = z.input<typeof ProdutoSchema>;

// Preço: a modalidade vem do produto e a moeda vem do país (derivadas no servidor).
export const PrecoSchema = z.object({
  paisId: z.string().min(1, "Selecione o país"),
  produtoId: z.string().min(1, "Selecione o produto"),
  tipoCobranca: z.nativeEnum(TipoCobranca).refine(t => t !== TipoCobranca.MULTA_ENCERRAMENTO, "Multa é definida no acerto contratual, não no catálogo."),
  valor: z.coerce.number().positive("Valor deve ser maior que zero"),
  versaoEstudo: z.string().optional(),
  ...comChave,
});
export type PrecoInput = z.input<typeof PrecoSchema>;
