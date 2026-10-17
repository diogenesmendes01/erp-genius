import type { AlvoCampoPersonalizado, CorTag, TipoCampoPersonalizado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import type { ValorCampo } from "./campos";
import { capacidadesCrm } from "./permissoes";
import { escopoPessoas } from "./pessoas";
import { sugerirDuplicados } from "./duplicados";

// Leituras auxiliares da tela /contatos (ficha, mesclagem). Só leitura: nenhuma escrita nem Evento.

export type CampoDaFicha = {
  id: string;
  nome: string;
  tipo: TipoCampoPersonalizado;
  opcoes: string[];
  obrigatorio: boolean;
  valor: ValorCampo;
};

/** Campos personalizados de pessoa (não arquivados) com o valor da pessoa. A pessoa já foi checada no escopo por `obterContato`. */
export async function camposDaPessoa(pessoaId: string, usuario: UsuarioSessao): Promise<CampoDaFicha[]> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("contatos.ver")) return [];
  const alvo: AlvoCampoPersonalizado = "PESSOA";
  const campos = await prisma.campoPersonalizado.findMany({
    where: { alvo, arquivadoEm: null },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    select: { id: true, nome: true, tipo: true, opcoes: true, obrigatorio: true, valores: { where: { pessoaId }, select: { valor: true }, take: 1 } },
  });
  return campos.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    opcoes: c.opcoes,
    obrigatorio: c.obrigatorio,
    valor: (c.valores[0]?.valor ?? null) as ValorCampo,
  }));
}

/** Tags ativas para a ficha atribuir. */
export async function tagsAtivas(): Promise<{ id: string; nome: string; cor: CorTag }[]> {
  return prisma.tag.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, cor: true } });
}

export type PessoaMesclavel = { id: string; nome: string; email: string | null; cidade: string | null; cargo: string | null };

/** Dados que o diálogo de mesclagem compara, só das pessoas no escopo do usuário e só para quem pode mesclar. */
export async function pessoasMesclaveis(usuario: UsuarioSessao, ids: string[]): Promise<Map<string, PessoaMesclavel>> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("contatos.mesclar") || ids.length === 0) return new Map();
  const linhas = await prisma.pessoa.findMany({
    where: { AND: [{ id: { in: [...new Set(ids)] } }, await escopoPessoas(usuario)] },
    select: { id: true, nome: true, email: true, cidade: true, cargo: true },
  });
  return new Map(linhas.map((p) => [p.id, p]));
}

export type ParDuplicado = { a: PessoaMesclavel; b: PessoaMesclavel; motivos: string[] };

/** Pares sugeridos como duplicados, já com os dados de cada lado. */
export async function paresDuplicados(usuario: UsuarioSessao, limite = 10): Promise<ParDuplicado[]> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("contatos.mesclar")) return [];
  const pares = await sugerirDuplicados(usuario, limite);
  const dados = await pessoasMesclaveis(usuario, pares.flatMap((p) => [p.a, p.b]));
  return pares.flatMap((p) => {
    const a = dados.get(p.a);
    const b = dados.get(p.b);
    return a && b ? [{ a, b, motivos: p.motivos }] : [];
  });
}
