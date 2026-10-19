export type Restaurant = {
  id: string;
  owner_id: string;
  legal_name: string;
  cui: string | null;
  city: string | null;
  county: string | null;
  address_line_1: string | null;
};

export type EquipmentCategory = 'refrigeration' | 'dishwasher' | 'ice_machine' | 'cooking';

export type EquipmentItem = {
  id: string;
  category: EquipmentCategory;
  label: string;
  maintenance_frequency_days: number;
  last_service_at: string | null;
  next_due_at: string | null;
  status: 'active' | 'inactive' | 'maintenance' | 'retired';
  notes: string | null;
};

export type AlertStatus = 'sent' | 'acknowledged' | 'scheduled' | 'resolved';

export type AlertEvent = {
  id: string;
  equipment_item_id: string;
  status: AlertStatus;
  alert_message: string;
  delivered_at: string;
  acknowledged_at: string | null;
  scheduled_for: string | null;
  equipment_items: Pick<EquipmentItem, 'label' | 'category'> | null;
};

export type LeadStatus = 'new' | 'contacted' | 'quote_requested' | 'closed';

export type ConsultationLead = {
  id: string;
  equipment_type: string;
  fuel_source: string | null;
  electrical_supply: string | null;
  capacity_requirement: string | null;
  technical_details: string | null;
  status: LeadStatus;
  created_at: string;
  consultation_lead_items?: { count: number }[];
};

export type SupplierOffer = {
  id: string;
  supplier_name: string;
  model_name: string | null;
  price: number | null;
  estimated_monthly_kwh: number | null;
  warranty_terms: string | null;
  material_durability: string | null;
  maintenance_cost: number | null;
  advantages: string | null;
  disadvantages: string | null;
};

export type ComparisonReport = {
  id: string;
  summary: string;
  recommendation: string | null;
  published_at: string | null;
  supplier_quote_requests: {
    technical_specifications: string;
    supplier_offers: SupplierOffer[];
  } | null;
};
