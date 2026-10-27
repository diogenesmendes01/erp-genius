import { describe, expect, it } from "vitest";
import { lerCoordenadas } from "./coordenadas";

describe("lerCoordenadas", () => {
  it("coordenadas: par, link com @, ?q= e query=", () => {
    expect(lerCoordenadas("-23.5614, -46.6559")).toEqual({ latitude: -23.5614, longitude: -46.6559 });
    expect(lerCoordenadas("https://www.google.com/maps/place/X/@-23.5614,-46.6559,17z")).toEqual({ latitude: -23.5614, longitude: -46.6559 });
    expect(lerCoordenadas("https://maps.google.com/?q=-23.5,-46.6")).toEqual({ latitude: -23.5, longitude: -46.6 });
    expect(lerCoordenadas("https://www.google.com/maps/search/?api=1&query=-23.5614,-46.6559")).toEqual({ latitude: -23.5614, longitude: -46.6559 });
  });

  it("aceita espaços, sinal explícito, vírgula codificada e o formato !3d!4d", () => {
    expect(lerCoordenadas("  9.93   -84.08 ")).toEqual({ latitude: 9.93, longitude: -84.08 });
    expect(lerCoordenadas("+9.93,+84.08")).toEqual({ latitude: 9.93, longitude: 84.08 });
    expect(lerCoordenadas("https://maps.google.com/?q=-23.5%2C-46.6")).toEqual({ latitude: -23.5, longitude: -46.6 });
    expect(lerCoordenadas("https://www.google.com/maps/place/X/data=!3m1!4b1!4m6!3m5!3d-23.5614!4d-46.6559")).toEqual({ latitude: -23.5614, longitude: -46.6559 });
  });

  it("coordenadas fora do intervalo ou texto solto: null", () => {
    expect(lerCoordenadas("91, 10")).toBeNull();
    expect(lerCoordenadas("10, 181")).toBeNull();
    expect(lerCoordenadas("https://maps.google.com/?q=-95,10")).toBeNull();
    expect(lerCoordenadas("Av. Paulista")).toBeNull();
    expect(lerCoordenadas("")).toBeNull();
    expect(lerCoordenadas("https://maps.app.goo.gl/abc123")).toBeNull();
  });

  it("limites do intervalo valem", () => {
    expect(lerCoordenadas("-90, 180")).toEqual({ latitude: -90, longitude: 180 });
    expect(lerCoordenadas("90,-180")).toEqual({ latitude: 90, longitude: -180 });
  });
});
