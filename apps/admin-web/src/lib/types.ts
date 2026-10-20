export type EquipmentCategory = 'refrigeration' | 'dishwasher' | 'ice_machine' | 'cooking'
export type AlertStatus = 'sent' | 'acknowledged' | 'scheduled' | 'resolved'
export type LeadStatus = 'new' | 'contacted' | 'quote_requested' | 'closed'
export type QuoteStatus = 'draft' | 'sent' | 'received' | 'closed'
export type ReportStatus = 'draft' | 'published' | 'archived'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: 'customer' | 'admin'
}

export type RestaurantRow = {
  id: string
  legal_name: string
  cui: string | null
  city: string | null
  created_at: string
  owner: Pick<Profile, 'email' | 'full_name' | 'phone'> | null
  equipment_items: { count: number }[]
  consultation_leads: { status: LeadStatus }[]
}

export type OpenAlert = {
  id: string
  status: AlertStatus
  scheduled_for: string | null
  delivered_at: string
  push_device_count: number
  push_sent_at: string | null
  push_error: string | null
}

export type EquipmentRow = {
  id: string
  restaurant_id: string
  category: EquipmentCategory
  label: string
  maintenance_frequency_days: number
  last_service_at: string | null
  next_due_at: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'retired'
  notes: string | null
  restaurants: { legal_name: string; city: string | null } | null
  alert_events: OpenAlert[]
}

export type LeadRow = {
  id: string
  equipment_type: string
  fuel_source: string | null
  electrical_supply: string | null
  capacity_requirement: string | null
  technical_details: string | null
  status: LeadStatus
  created_at: string
  restaurants: { legal_name: string; city: string | null } | null
  author: Pick<Profile, 'email' | 'phone'> | null
  consultation_lead_items: { count: number }[]
}

export type LeadItem = {
  id: string
  position: number
  category: string
  equipment_type: string
  fuel_source: 'gas' | 'electric' | 'none' | null
  gas_notes: string | null
  electrical_supply: '220V' | '380V' | null
  capacity_requirement: string | null
  photo_path: string | null
}

export type QuoteRequestRow = {
  id: string
  title: string | null
  lead_id: string | null
  technical_specifications: string
  status: QuoteStatus
  created_at: string
  restaurants: { legal_name: string } | null
  supplier_offers: { count: number }[]
  supplier_quote_recipients: { count: number }[]
  comparison_reports: { id: string; status: ReportStatus; published_at: string | null }[]
}

export type Supplier = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  categories: string[]
  notes: string | null
  is_active: boolean
}

export type QuoteRecipient = {
  id: string
  status: 'sent' | 'replied' | 'declined'
  sent_at: string
  suppliers: Pick<Supplier, 'name' | 'email'> | null
}
