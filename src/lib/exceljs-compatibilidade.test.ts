import ExcelJS from "exceljs";
import { expect, it } from "vitest";

it("preserva dados e formatação estendida após atualizar a dependência uuid do ExcelJS", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Conferência");
  sheet.addRow(["João", 120.5, new Date("2026-09-12T12:00:00Z")]);
  sheet.addConditionalFormatting({
    ref: "B1:B3",
    rules: [{ type: "iconSet", iconSet: "3Stars", priority: 1,
      cfvo: [{ type: "percent", value: 0 }, { type: "percent", value: 33 }, { type: "percent", value: 67 }] }],
  });
  const bytes = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  const result = restored.getWorksheet("Conferência")!;
  expect(result.getCell("A1").value).toBe("João");
  expect(result.getCell("B1").value).toBe(120.5);
  expect(result.getCell("C1").value).toEqual(new Date("2026-09-12T12:00:00Z"));
  expect(result).toMatchObject({ conditionalFormattings: [
    { rules: [{ type: "iconSet", iconSet: "3Stars" }] },
  ] });
});
