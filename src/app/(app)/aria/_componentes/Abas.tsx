import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import { ABAS_ARIA, ROTULO_ABA, type AbaAria } from "./abas-aria";

/** Abas da Aria: links reais (`?aba=`), uma ativa por vez; rolam na horizontal no celular. */
export function Abas({ ativa }: { ativa: AbaAria }) {
  return (
    <nav aria-label="Seções da Aria" className="mt-4 overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {ABAS_ARIA.map((aba) => {
          const ehAtiva = aba === ativa;
          return (
            <li key={aba}>
              <Link
                href={aba === "visao" ? "/aria" : `/aria?aba=${aba}`}
                aria-current={ehAtiva ? "page" : undefined}
                className={botaoClasses({ variante: ehAtiva ? "primario" : "fantasma" })}
              >
                {ROTULO_ABA[aba]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
