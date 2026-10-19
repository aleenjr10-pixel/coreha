import { fuelLabels, supplyLabels } from './categories'
import type { LeadItem } from './types'

export function rfqReference(leadId: string) {
  return `CH-${leadId.slice(0, 6).toUpperCase()}`
}

function formatDay(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Builds the supplier-facing quote request. The restaurant's name stays private;
// only the city is shared for delivery.
export function buildRfq({
  leadId,
  items,
  city,
  responseDue,
  notes,
}: {
  leadId: string
  items: LeadItem[]
  city: string | null
  responseDue: string
  notes: string
}) {
  const reference = rfqReference(leadId)
  const types = items.map((item) => item.equipment_type)
  const subject = `Cerere de ofertă ${reference} – ${types.slice(0, 3).join(', ')}${types.length > 3 ? ` și alte ${types.length - 3}` : ''}`

  const lines = items.map((item, index) => {
    const details = [`   Categorie: ${item.category}`]
    if (item.fuel_source === 'gas') {
      details.push(`   Alimentare: Gaz${item.gas_notes ? ` (${item.gas_notes})` : ''}`)
    } else if (item.fuel_source === 'electric') {
      details.push(`   Alimentare: Electric${item.electrical_supply ? `, ${supplyLabels[item.electrical_supply]}` : ''}`)
    } else if (item.fuel_source === 'none') {
      details.push(`   Alimentare: ${fuelLabels.none}`)
    }
    if (item.capacity_requirement) details.push(`   Volum/capacitate dorită: ${item.capacity_requirement}`)
    return `${index + 1}. ${item.equipment_type}\n${details.join('\n')}`
  })

  const body = [
    'Bună ziua,',
    '',
    `Vă rugăm să ne transmiteți o ofertă pentru următoarele echipamente (referință ${reference}):`,
    '',
    lines.join('\n\n'),
    '',
    city ? `Locație livrare și montaj: ${city}` : null,
    notes.trim() ? `Observații: ${notes.trim()}` : null,
    city || notes.trim() ? '' : null,
    'Vă rugăm să includeți în ofertă, pentru fiecare echipament:',
    '- model și producător',
    '- preț (fără TVA și cu TVA) și condiții de plată',
    '- consum estimat de energie (kWh/lună)',
    '- garanție',
    '- materiale și durabilitate',
    '- costuri estimate de mentenanță',
    '- termen de livrare',
    '',
    `Vă rugăm să trimiteți oferta până la data de ${formatDay(responseDue)}, cu referința ${reference} în subiect.`,
    '',
    'Mulțumim,',
    'Echipa CoreHa',
  ]
    .filter((line) => line !== null)
    .join('\n')

  return { subject, body }
}
