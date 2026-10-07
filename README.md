# CoreHa

CoreHa is a HoReCa maintenance and equipment-advisory platform. It helps restaurants keep kitchen equipment in service, receive alerts when maintenance is required, and access direct expert guidance when they need to replace or upgrade equipment.

The current source of truth for scope and workflows is [docs/product-blueprint.md](docs/product-blueprint.md).

## Product modules

1. Digital inventory and critical alert dispatch
2. Equipment consultation and lead capture
3. Supplier quote request and comparative analysis

The first target vertical is restaurants. The product is not yet designed for broader hotel or multi-industry expansion.

## Application architecture

The project uses a split client architecture with one shared backend:

- apps/customer-mobile/ — Expo and React Native app for restaurant users to receive alerts, request equipment consultation, and view offered comparisons.
- apps/admin-web/ — React application used by CoreHa administrators to manage inventory, leads, supplier requests, and final client reports.
- docs/ — product vision, requirements summary, and the source-of-truth blueprint.

Both apps are still in the early prototype phase. Authentication, registry lookup, Supabase persistence, and access rules still need to be connected to real data.

## Run locally

Admin website:

```powershell
cd apps/admin-web
npm run dev
```

Customer mobile app:

```powershell
cd apps/customer-mobile
npm start
```

Use Expo Go to open the mobile project on a physical device or in an emulator. The iOS native build requires macOS.

## Supabase configuration

The admin site uses VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in apps/admin-web/.env.local. The Expo app uses EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/customer-mobile/.env. Both apps should connect to the same Supabase project. Only the public publishable key belongs in the client apps; never store a service-role or secret key there.

No live database migration is defined yet. The schema and Row Level Security policies must be redesigned for the customer/admin split before enabling real data access.
