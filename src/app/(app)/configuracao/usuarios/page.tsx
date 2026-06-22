import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarUsuarios } from "@/server/acesso/consultas";
import { UsuariosPainel, type UsuarioRow } from "./UsuariosPainel";

// Guard server-side por papel ANTES de listar usuários (issue #1).
// Gestão de usuários é exclusiva do Administrador (docs/07 e docs/12 §Configuração).
// exigirPapelLeitura sem outros papéis = só Administrador passa.
export default async function UsuariosPage() {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR);
  if (!papeis) return <AcessoNegado recurso="a gestão de usuários" />;

  const usuarios = await listarUsuarios();
  const rows: UsuarioRow[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papeis: u.papeis,
    ativo: u.ativo,
    limiteDescontoPct: u.limiteDescontoPct,
    ultimoAcesso: u.ultimoAcesso ? u.ultimoAcesso.toISOString() : null,
  }));
  return <UsuariosPainel usuarios={rows} />;
}
