import { expect, it } from "vitest";
import { CAPACIDADES_LISTA } from "@/lib/capacidades";
import { CriarUsuarioSchema, EditarUsuarioSchema } from "./schema";

const financeiro = { nome: "Operador financeiro", email: "operador@example.test", papeis: ["FINANCEIRO"] };

it("permite conceder execução de devoluções e preservá-la ao editar o usuário", () => {
  const permissoes = ["financeiro.executar_devolucoes"];
  const criado = CriarUsuarioSchema.parse({ ...financeiro, senha: "senha-teste", permissoes });
  // Mesma seleção usada ao carregar o formulário administrativo.
  const selecionadas = CAPACIDADES_LISTA.filter(p => criado.permissoes.includes(p));
  expect(EditarUsuarioSchema.parse({ ...financeiro, permissoes: selecionadas }).permissoes).toEqual(permissoes);
});

it("não concede execução automaticamente nem aceita uma capacidade desconhecida", () => {
  expect(EditarUsuarioSchema.parse(financeiro).permissoes).toEqual([]);
  expect(EditarUsuarioSchema.safeParse({ ...financeiro, permissoes: ["financeiro.devolver_sem_aprovacao"] }).success).toBe(false);
});
