import { Papel } from "@prisma/client";
import { listarUsuarios } from "@/server/acesso/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { UsuariosPainel, type UsuarioRow } from "./UsuariosPainel";

export default async function UsuariosPage() {
  // Gestão de usuários é exclusiva do Admin (doc 07 / tabs de Configuração).
  await exigirSessaoPagina(Papel.ADMINISTRADOR);
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
