import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { escopoAlunos } from "@/server/alunos/consultas";
import { ErroPermissao, type UsuarioSessao } from "@/server/_shared";
import { PAPEIS_PAUSA } from "./pausa-estado";

const TAMANHO_PAGINA = 50;
const Entrada = z.object({
  alunoId: z.string().trim().min(1).max(100),
  pagina: z.number().int().min(1).max(100000).default(1),
}).strict();

/**
 * Consulta interna da página já guardada. A identidade vem exclusivamente da
 * sessão do servidor; a releitura abaixo também impede usar papéis revogados.
 */
export async function listarPedidosEncerramentoParaUsuario(
  input: z.input<typeof Entrada>,
  usuarioSessao: UsuarioSessao,
) {
  const d = Entrada.parse(input);
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioSessao.id },
    select: { id: true, nome: true, ativo: true, papeis: true },
  });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => PAPEIS_PAUSA.includes(papel))) {
    throw new ErroPermissao("Permissão para consultar pedidos de encerramento foi revogada.");
  }
  if (!await prisma.aluno.count({ where: { id: d.alunoId, ...escopoAlunos(usuario) } })) {
    throw new ErroPermissao("Aluno indisponível para consultar pedidos de encerramento.");
  }

  const registros = await prisma.solicitacaoEncerramentoMatriculas.findMany({
    where: { alunoId: d.alunoId },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (d.pagina - 1) * TAMANHO_PAGINA,
    take: TAMANHO_PAGINA + 1,
    select: {
      id: true, status: true, dataPedido: true, dataSolicitada: true, motivo: true, evidenciaPedido: true,
      motivoRetroatividade: true, evidenciaRetroatividade: true,
      registrador: { select: { nome: true } },
      itens: { select: { matricula: { select: { id: true, codigo: true } } } },
    },
  });

  return { pedidos: registros.slice(0, TAMANHO_PAGINA), pagina: d.pagina, temProxima: registros.length > TAMANHO_PAGINA };
}

export function paginaPedidosEncerramento(valor: string | string[] | undefined): number {
  if (typeof valor !== "string" || !/^[1-9]\d*$/.test(valor)) return 1;
  const pagina = Number(valor);
  return Number.isSafeInteger(pagina) && pagina <= 100000 ? pagina : 1;
}
