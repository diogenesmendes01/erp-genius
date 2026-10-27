import {Papel} from "@prisma/client";
import {apenasPortal,temPapel,type UsuarioSessao} from "@/server/_shared/sessao";
export function papelEditaPrevisao(u:UsuarioSessao){return !apenasPortal(u)&&temPapel(u,Papel.VENDEDOR,Papel.GERENTE_COMERCIAL);}