import postgres from "postgres";
import { requireEnv } from "./_env";

// DADOS DE DEMONSTRAÇÃO — apenas para desenvolvimento e testes.
// Todas as viaturas criadas aqui ficam marcadas como "demonstração" (is_demo = true),
// têm referências começadas por "DEMO-" e mostram um aviso no showroom.
// Não incluem fotografias: o showroom apresenta os marcadores neutros em CSS.
// Remover: npm run db:seed:demo -- --remover   (ou no back office: Viaturas → Remover demonstração)

type Demo = {
  ref: string;
  brand: string;
  model: string;
  version: string;
  category: string;
  year: number;
  km: number;
  fuel: string;
  transmission: string;
  cc: number | null;
  hp: number;
  ext: string;
  int: string;
  doors: number;
  seats: number;
  price: number;
  status?: "disponivel" | "reservado" | "vendido";
  published?: boolean;
  featured?: boolean;
  promo?: { type: "valor" | "percentagem" | "preco_final"; value: number };
  equipment: string[];
};

const DEMOS: Demo[] = [
  { ref: "DEMO-01", brand: "Volkswagen", model: "Golf", version: "1.0 TSI Life", category: "utilitario", year: 2021, km: 48200, fuel: "gasolina", transmission: "manual", cc: 999, hp: 110, ext: "Cinzento", int: "Preto", doors: 5, seats: 5, price: 21900, featured: true, equipment: ["Ar condicionado automático", "Sensores de estacionamento", "Cruise control adaptativo"] },
  { ref: "DEMO-02", brand: "BMW", model: "Série 3", version: "320d Auto", category: "berlina", year: 2020, km: 76500, fuel: "gasoleo", transmission: "automatica", cc: 1995, hp: 190, ext: "Preto", int: "Preto", doors: 4, seats: 5, price: 32900, featured: true, promo: { type: "valor", value: 1500 }, equipment: ["Navegação", "Bancos aquecidos", "Faróis LED"] },
  { ref: "DEMO-03", brand: "Peugeot", model: "3008", version: "1.5 BlueHDi Allure", category: "suv", year: 2022, km: 31000, fuel: "gasoleo", transmission: "automatica", cc: 1499, hp: 130, ext: "Branco", int: "Cinzento", doors: 5, seats: 5, price: 29500, featured: true, equipment: ["Câmara traseira", "Apple CarPlay / Android Auto"] },
  { ref: "DEMO-04", brand: "Renault", model: "Clio", version: "1.0 TCe Evolution", category: "citadino", year: 2023, km: 12500, fuel: "gasolina", transmission: "manual", cc: 999, hp: 90, ext: "Azul", int: "Preto", doors: 5, seats: 5, price: 17400, promo: { type: "percentagem", value: 5 }, equipment: ["Ecrã tátil", "Limitador de velocidade"] },
  { ref: "DEMO-05", brand: "Tesla", model: "Model 3", version: "Long Range AWD", category: "berlina", year: 2021, km: 58000, fuel: "eletrico", transmission: "automatica", cc: null, hp: 440, ext: "Branco", int: "Preto", doors: 4, seats: 5, price: 33900, status: "reservado", equipment: ["Piloto automático", "Teto panorâmico"] },
  { ref: "DEMO-06", brand: "Toyota", model: "C-HR", version: "1.8 Hybrid Comfort", category: "suv", year: 2020, km: 64300, fuel: "hibrido", transmission: "automatica", cc: 1798, hp: 122, ext: "Vermelho", int: "Preto", doors: 5, seats: 5, price: 23900, equipment: ["Câmara traseira", "Ar condicionado bizona"] },
  { ref: "DEMO-07", brand: "Mercedes-Benz", model: "Classe A", version: "A 180 d Style", category: "utilitario", year: 2019, km: 89000, fuel: "gasoleo", transmission: "automatica", cc: 1461, hp: 116, ext: "Prateado", int: "Preto", doors: 5, seats: 5, price: 24500, status: "vendido", equipment: ["MBUX", "Faróis LED"] },
  { ref: "DEMO-08", brand: "Volkswagen", model: "Polo", version: "1.0 TSI Comfortline", category: "citadino", year: 2019, km: 70100, fuel: "gasolina", transmission: "manual", cc: 999, hp: 95, ext: "Branco", int: "Preto", doors: 5, seats: 5, price: 14900, equipment: ["Ar condicionado", "Bluetooth"] },
  { ref: "DEMO-09", brand: "Audi", model: "A4 Avant", version: "35 TDI S tronic", category: "carrinha", year: 2020, km: 82000, fuel: "gasoleo", transmission: "automatica", cc: 1968, hp: 163, ext: "Cinzento", int: "Preto", doors: 5, seats: 5, price: 30900, published: false, equipment: ["Virtual cockpit", "Portão elétrico"] },
];

function slug(d: Demo) {
  return `${d.brand} ${d.model} ${d.version} ${d.year} ${d.ref}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const remove = process.argv.includes("--remover");
  const sql = postgres(requireEnv("DATABASE_URL"), { max: 1, onnotice: () => {} });
  try {
    const removed = await sql`delete from vehicles where is_demo returning id`;
    if (remove) {
      console.log(`✔ ${removed.length} viatura(s) de demonstração removida(s).`);
      return;
    }
    const DAY = 86_400_000;
    for (const [i, d] of DEMOS.entries()) {
      const created = new Date(Date.now() - (45 - i) * DAY);
      const published = d.published !== false;
      await sql.begin(async (tx) => {
        const [v] = await tx<{ id: string }[]>`
          insert into vehicles (
            slug, reference, brand, model, version, category, registration_year, mileage_km, fuel, transmission,
            engine_cc, power_hp, exterior_color, interior_color, doors, seats, condition, price_cents,
            short_description, status, is_published, is_featured, is_demo, published_at, sold_at, reserved_at, created_at
          ) values (
            ${slug(d)}, ${d.ref}, ${d.brand}, ${d.model}, ${d.version}, ${d.category}, ${d.year}, ${d.km}, ${d.fuel}, ${d.transmission},
            ${d.cc}, ${d.hp}, ${d.ext}, ${d.int}, ${d.doors}, ${d.seats}, 'usado', ${d.price * 100},
            ${"Viatura de demonstração — dados fictícios para testar o showroom."},
            ${d.status ?? "disponivel"}, ${published}, ${d.featured ?? false}, true,
            ${published ? created : null}, ${d.status === "vendido" ? new Date() : null}, ${d.status === "reservado" ? new Date() : null}, ${created}
          ) returning id`;
        // Histórico de preço com a data de criação (necessário para o preço de referência legal)
        await tx`update price_history set created_at = ${created} where vehicle_id = ${v.id}`;
        for (const [pos, label] of d.equipment.entries()) {
          await tx`insert into vehicle_equipment (vehicle_id, kind, label, position) values (${v.id}, 'equipamento', ${label}, ${pos})`;
        }
        if (d.promo) {
          const start = new Date(Date.now() - 3 * DAY);
          const end = new Date(Date.now() + 20 * DAY);
          await tx`
            insert into promotions (vehicle_id, discount_type, amount_cents, percent_bp, label, starts_at, ends_at)
            values (${v.id}, ${d.promo.type}, ${d.promo.type === "percentagem" ? null : d.promo.value * 100},
                    ${d.promo.type === "percentagem" ? d.promo.value * 100 : null}, 'Campanha de demonstração', ${start}, ${end})`;
        }
      });
    }
    console.log(`✔ ${DEMOS.length} viaturas de demonstração criadas (referências DEMO-01 a DEMO-${String(DEMOS.length).padStart(2, "0")}).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
