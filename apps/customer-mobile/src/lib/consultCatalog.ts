// Equipment catalog for the consultation form.
// power: 'gas_or_electric' asks Gaz/Electric first, 'electric' goes straight to voltage,
// 'none' skips the power step (e.g. stainless sinks).

export type PowerType = 'gas_or_electric' | 'electric' | 'none';

export type EquipmentOption = { label: string; power: PowerType };

export type ConsultCategory = { id: string; label: string; types: EquipmentOption[] };

const gas = (label: string): EquipmentOption => ({ label, power: 'gas_or_electric' });
const electric = (label: string): EquipmentOption => ({ label, power: 'electric' });
const unpowered = (label: string): EquipmentOption => ({ label, power: 'none' });

export const consultCategories: ConsultCategory[] = [
  {
    id: 'cooking',
    label: 'Gătire (Cald)',
    types: [
      gas('Aragaz profesional'),
      gas('Cuptoare gastronomie'),
      gas('Cuptoare pentru pizza'),
      gas('Friteuze'),
      gas('Grătare'),
      gas('Fierbătoare paste'),
      gas('Salamandre'),
      electric('Hote'),
      gas('Marmite/Tigăi basculante'),
      electric('Aparate Sous-Vide'),
    ],
  },
  {
    id: 'cold',
    label: 'Frig și Gheață',
    types: [
      electric('Dulapuri frigorifice'),
      electric('Mese reci'),
      electric('Mese preparare pizza/Saladete'),
      electric('Vitrine ingrediente'),
      electric('Mașini gheață'),
      electric('Vitrine prezentare'),
      electric('Răcitoare sticle'),
      electric('Abatitoare'),
      electric('Camere frigorifice'),
    ],
  },
  {
    id: 'washing',
    label: 'Spălare',
    types: [
      electric('Mașini spălat vase'),
      electric('Mașini spălat pahare'),
      electric('Mașini spălat oale/tăvi'),
      unpowered('Spălătoare inox'),
      electric('Dedurizatoare'),
      electric('Sterilizatoare cuțite'),
      electric('Mașini lustruit tacâmuri'),
    ],
  },
  {
    id: 'bar',
    label: 'Bar și Fast-Food',
    types: [
      gas('Aparate shaorma/Kebab'),
      electric('Grill-uri Panini'),
      electric('Espressoare/Râșnițe'),
      electric('Blendere/Storcătoare'),
      electric('Vitrine calde'),
      gas('Aparate Hot-Dog/Rotișoare'),
      electric('Dozatoare bere'),
    ],
  },
  {
    id: 'prep',
    label: 'Preparare Dinamică',
    types: [
      electric('Feliatoare'),
      electric('Mașini tocat carne'),
      electric('Mixere/Malaxoare'),
      electric('Mașini curățat cartofi'),
      electric('Mașini ambalat vid'),
    ],
  },
];

export const fuelLabels = { gas: 'Gaz', electric: 'Electric', none: 'Fără alimentare' } as const;

export const supplyLabels = { '220V': '220V (Monofazic)', '380V': '380V/400V (Trifazic)' } as const;

export function findCategory(id: string | null) {
  return consultCategories.find((category) => category.id === id) ?? null;
}

export function findType(categoryId: string | null, label: string | null) {
  return findCategory(categoryId)?.types.find((type) => type.label === label) ?? null;
}
