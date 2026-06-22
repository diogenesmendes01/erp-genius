import { z } from "zod";
import { Papel } from "@prisma/client";

// Usuário & papéis (ver docs/07). Multi-papel; limiteDescontoPct null = sem limite (Admin).
const limite = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().min(0).max(100, "Limite em % (0–100)").nullable(),
);

const base = {
  nome: z.string().min(1, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  papeis: z.array(z.nativeEnum(Papel)).min(1, "Selecione ao menos um papel"),
  limiteDescontoPct: limite,
};

export const CriarUsuarioSchema = z.object({
  ...base,
  senha: z.string().min(6, "Senha de no mínimo 6 caracteres"),
});
export type CriarUsuarioInput = z.input<typeof CriarUsuarioSchema>;

export const EditarUsuarioSchema = z.object({
  ...base,
  // vazio = mantém a senha atual
  senha: z.union([z.string().min(6, "Senha de no mínimo 6 caracteres"), z.literal("")]).optional(),
});
export type EditarUsuarioInput = z.input<typeof EditarUsuarioSchema>;
