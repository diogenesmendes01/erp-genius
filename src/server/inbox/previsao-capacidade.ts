import {Papel} from "@prisma/client";
import {apenasPortal,temPapel,type UsuarioSessao} from "@/server/_shared/sessao";
/** Papel é necessário, mas a carteira atual ainda precisa ser intersectada na Db em uso. */
export function papelEditaPrevisao(u:UsuarioSessao){return !apenasPortal(u)&&temPapel(u,Papel.VENDEDOR,Papel.GERENTE_COMERCIAL);}