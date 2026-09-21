"""Consolida evidências da auditoria609; não calcula entrega global da SPEC."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs/planejamento"
PARTES = ("financeiro", "academico", "comercial", "operacao")
STATUS = {"verificado", "parcial", "nao_implementado", "nao_auditado"}

def consolidar():
    linhas = []
    identificadores = set()
    for parte in PARTES:
        arquivo = BASE / f"auditoria-609-{parte}.json"
        for original in json.loads(arquivo.read_text(encoding="utf-8-sig")):
            item = dict(original)
            texto = item.pop("textoexato", None)
            item["texto"] = item.get("texto") or texto
            if not item["texto"] or not item.get("criterio") or item["status"] not in STATUS:
                raise ValueError(f"Critério inválido em {arquivo}: {item.get('criterio')}")
            if item["criterio"] in identificadores:
                raise ValueError(f"Critério duplicado: {item['criterio']}")
            identificadores.add(item["criterio"])
            for campo in ("codigo", "testes"):
                for ref in item[campo]:
                    # Algumas referências incluem nome de cenário após o caminho.
                    if not (ROOT / ref).exists():
                        raise ValueError(f"Referência não encontrada: {ref}")
            linhas.append(item)
    (BASE / "auditoria-609-consolidada.json").write_text(
        json.dumps(linhas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    contagem = collections.Counter(x["status"] for x in linhas)
    saida = ["# Matriz preliminar de aceite — auditoria 609", "",
        "Inventário dos critérios originais dos corpos de entrega e ACA. Ainda exige reconciliação com ampliações e requisitos transversais; não é o denominador final da SPEC.", "",
        "`verificado` significa inspeção de código e asserções pertinentes; não substitui execução atual nem homologação real. `nao_auditado` não significa código ausente. Critérios parciais não recebem crédito percentual arbitrário.", "",
        f"Critérios inventariados: {len(linhas)}. Contagem de classificações: {dict(contagem)}.", "",
        "Evidências completas: [JSON consolidado](auditoria-609-consolidada.json). Classificações são preliminares e sujeitas à revisão da evidência.", "",
        "| Corpo | Critério | Situação | Pendência |", "|---|---|---|---|"]
    for item in linhas:
        campos = [item["corpo"], item["criterio"], item["status"], item.get("pendencia") or "—"]
        saida.append("| " + " | ".join(str(x).replace("|", "/").replace("\n", " ") for x in campos) + " |")
    (BASE / "auditoria-609-matriz.md").write_text("\n".join(saida) + "\n", encoding="utf-8")
    print(json.dumps({"criterios": len(linhas), "classificacoes": dict(contagem)}, ensure_ascii=False))

if __name__ == "__main__":
    consolidar()
