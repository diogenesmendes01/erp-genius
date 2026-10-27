import ts from "typescript";

export function literaisDeString(fonte: string): string[] {
  const arquivo = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const literais: string[] = [];
  const visitar = (no: ts.Node): void => {
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no) || ts.isTemplateExpression(no)) {
      literais.push(no.getText(arquivo));
      return;
    }
    ts.forEachChild(no, visitar);
  };
  visitar(arquivo);
  return literais;
}
