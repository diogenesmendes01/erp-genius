import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ABAS_ARIA, ROTULO_ABA, type AbaAria } from "./abas-aria";

export function Abas({ ativa }: { ativa: AbaAria }) {
  return (
    <nav aria-label="Seções da Aria" className="mt-4 overflow-x-auto">
      <Tabs value={ativa}>
        <TabsList className="h-auto min-w-max justify-start">
          {ABAS_ARIA.map((aba) => (
            <TabsTrigger key={aba} value={aba} asChild>
              <Link href={aba === "visao" ? "/aria" : `/aria?aba=${aba}`}>
                {ROTULO_ABA[aba]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
