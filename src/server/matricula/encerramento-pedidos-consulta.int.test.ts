import { beforeEach, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { listarPedidosEncerramentoParaUsuario } from "./encerramento-pedidos-consulta";

let alunoId: string;
let outroAlunoId: string;
let secretariaId: string;
let matriculaId: string;

async function criarPedido(aluno: string, matricula: string, numero: number, criadoEm: Date) {
  const pedido = await prisma.solicitacaoEncerramentoMatriculas.create({
    data: {
      alunoId: aluno,
      registradorId: secretariaId,
      chaveIdempotencia: `consulta-paginada-${aluno}-${numero}`,
      entradaHash: `hash-consulta-paginada-${numero}`,
      motivo: `Pedido histórico ${numero}`,
      evidenciaPedido: `Evidência preservada ${numero}`,
      dataPedido: new Date("2099-01-01T00:00:00Z"),
      dataSolicitada: new Date("2099-01-31T00:00:00Z"),
      fusoRegistro: "UTC",
      status: "CANCELADA",
      criadoEm,
    },
  });
  await prisma.itemSolicitacaoEncerramento.create({ data: { solicitacaoId: pedido.id, alunoId: aluno, matriculaId: matricula } });
  return pedido;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  secretariaId = secretaria.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna paginada", paisId: catalogo.pais.id } });
  const outro = await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  outroAlunoId = outro.id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC", status: "ATIVA" } })).id;
  const matriculaOutro = (await prisma.matricula.create({ data: { alunoId: outroAlunoId, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC", status: "ATIVA" } })).id;
  const mesmoInstante = new Date("2099-01-01T12:00:00.000Z");
  for (let numero = 1; numero <= 53; numero += 1) await criarPedido(alunoId, matriculaId, numero, mesmoInstante);
  await criarPedido(outroAlunoId, matriculaOutro, 1, new Date("2100-01-01T12:00:00.000Z"));
});

it("pagina pedidos estáveis sem sobreposição e não mistura outro aluno", async () => {
  const sessao = { id: secretariaId, nome: "Secretaria", papeis: [Papel.SECRETARIA_ACADEMICA] };
  const [primeira, segunda] = await Promise.all([
    listarPedidosEncerramentoParaUsuario({ alunoId, pagina: 1 }, sessao),
    listarPedidosEncerramentoParaUsuario({ alunoId, pagina: 2 }, sessao),
  ]);
  expect(primeira.pedidos).toHaveLength(50);
  expect(primeira.temProxima).toBe(true);
  expect(segunda.pedidos).toHaveLength(3);
  expect(segunda.temProxima).toBe(false);
  const ids = [...primeira.pedidos, ...segunda.pedidos].map((pedido) => pedido.id);
  expect(new Set(ids).size).toBe(53);
  expect(ids).not.toContain((await prisma.solicitacaoEncerramentoMatriculas.findFirstOrThrow({ where: { alunoId: outroAlunoId } })).id);
  const esperado = await prisma.solicitacaoEncerramentoMatriculas.findMany({ where: { alunoId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true } });
  expect(ids).toEqual(esperado.map((pedido) => pedido.id));
  expect(primeira.pedidos.every((pedido) => pedido.itens.every((item) => item.matricula.id === matriculaId))).toBe(true);
});

it("recusa papel revogado e usuário inativo", async () => {
  const sessaoSecretaria = { id: secretariaId, nome: "Secretaria", papeis: [Papel.SECRETARIA_ACADEMICA] };
  const visitante = await criarUsuario(["VENDEDOR"]);
  await expect(listarPedidosEncerramentoParaUsuario({ alunoId, pagina: 1 }, { id: visitante.id, nome: "Vendedor", papeis: [Papel.VENDEDOR] })).rejects.toThrow("Permissão");
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: [Papel.VENDEDOR] } });
  await expect(listarPedidosEncerramentoParaUsuario({ alunoId, pagina: 1 }, sessaoSecretaria)).rejects.toThrow("Permissão");
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: [Papel.SECRETARIA_ACADEMICA], ativo: false } });
  await expect(listarPedidosEncerramentoParaUsuario({ alunoId, pagina: 1 }, sessaoSecretaria)).rejects.toThrow("Permissão");
});
