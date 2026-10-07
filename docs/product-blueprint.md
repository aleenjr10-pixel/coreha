# CoreHa Product Blueprint

This document is the approved product source of truth for the current CoreHa release. It reflects the business logic captured in the attached requirement documents and replaces the earlier generic assumptions with the actual operating model: a full-service maintenance and alerting workflow, a direct equipment-consultation flow, and an automated supplier request and offer-analysis system.

## 1. Product purpose and business model

CoreHa is a service and advisory platform for restaurants that need dependable equipment maintenance and safer equipment-purchasing decisions. The platform helps restaurants manage preventive maintenance, receive critical alerts when equipment needs upkeep, and access expert guidance when they need new machinery or replacement equipment.

The product also supports supplier quotation and comparison workflows by centralizing requests and allowing the administrator to generate a technical and commercial analysis for the client, assisted by external AI tools.

The business model is based on supplier intermediation and premium consulting value, but the exact commission structure and customer disclosure remain Open.

## 2. Product architecture

The system is split into two connected product surfaces:

### 2.1 Customer mobile app

The customer app is the restaurant user's operational space. It is used for:

- login and secure access
- restaurant account and business onboarding
- receiving critical alerts and maintenance notifications
- confirming service needs and scheduling intervention
- accessing consultation flows for new equipment
- receiving the final technical comparison and supplier offer report

This app is designed for speed and clarity in a real restaurant environment.

### 2.2 CoreHa admin web app

The admin app is the operational dashboard used by CoreHa staff. It is used for:

- reviewing client restaurant accounts
- adding maintenance inventory items manually from on-site assessment
- monitoring alert status and service confirmation flow
- receiving equipment requests and consultation forms from clients
- preparing supplier quote requests
- managing incoming supplier offers
- generating the final technical comparison for the client

This app is the operational heart of the business workflow.

### 2.3 Shared backend

Both applications connect to a shared Supabase data layer. The backend supports:

- authentication and roles
- restaurant profiles and owners
- equipment inventory records
- maintenance schedules and alert history
- lead records and consultation requests
- supplier quote requests
- supplier offers and comparison documents
- statuses for client notifications and service actions

## 3. Users and scope

### Initial users

- Restaurant manager or owner: receives critical alerts, confirms maintenance requirements, requests expert advice, and receives pricing/technical analysis.
- CoreHa administrator: manages equipment inventory, receives client requests, prepares supplier requests, reviews offers, and prepares the final comparison.
- Suppliers: contacted and managed manually from the admin workflow; supplier accounts are not required in the first release.

### Initial domain

The first release is limited to restaurants and kitchen equipment. Hotels and other verticals are not part of the initial scope.

## 4. Module 1: Digital equipment inventory and alert dispatch

This module is the core of CoreHa and is designed as a done-for-you service workflow.

### Workflow

1. After an on-site visit or assessment, the CoreHa administrator manually adds the equipment into the digital inventory.
2. The equipment is labeled clearly and assigned to a category such as refrigeration, washing, ice, or cooking.
3. The administrator sets the maintenance frequency in days or months according to the actual needs of that kitchen.
4. When the maintenance date is reached, the system triggers a priority alert.
5. The restaurant user receives the critical alert on their phone and must confirm or schedule the required maintenance.
6. The administrator receives confirmation of delivery and can move the case into a service workflow.

### Equipment record fields

Each item contains:

- clear label or naming convention
- equipment category
- maintenance frequency
- due date or next review date
- status and alert history
- optional technical metadata such as location or equipment notes

### Alert behavior

When the deadline is reached, the app sends a serious alert instead of a simple reminder:

- full-screen notification on Android
- critical alert on iOS
- audible alarm and text message such as: “Equipment [Name] requires periodic maintenance.”
- alert remains active until the user interacts with it

The admin panel logs the delivery of the alert to the restaurant manager's device.

### First-release principle

This module removes the need for restaurant staff to manually enter technical maintenance details. The product acts as the direct communication and dispatch layer for professional maintenance and hygiene services.

## 5. Module 2: Equipment consultation and lead generation

This module acts as the direct bridge between the restaurant's need for a new piece of equipment and the correct technical recommendation.

### UX flow

The restaurant user accesses the equipment-consultation section in the mobile app and sees two clear options:

1. Direct expert line: a large call button with a message inviting the user to speak with an expert and ensure the chosen equipment fits their kitchen.
2. Alternative written request: a short form if the user cannot call immediately.

### Lead form fields

The short form includes:

- equipment type
- fuel source: gas or electric
- electrical supply: 220V single-phase or 380V three-phase where relevant
- power or capacity requirement
- specific equipment details and constraints

The free-text field captures preferences such as manufacturer, space limitations, or kitchen integration needs.

### After submission

Once the form is submitted, the request reaches the admin dashboard as a lead. This gives the administrator enough information to contact the client and continue the workflow toward a supplier request.

This module prioritizes direct human expert guidance and structured lead creation rather than a purely self-service purchase flow.

## 6. Module 3: Supplier quote request and comparative analysis

This module combines the old quote-generation and comparison workflows into a single operational system.

### Phase 1: Quote request generation

The application generates a clear quote request document from the information already collected in the consultation flow. The generation can follow two routes:

- Client route: the restaurant user fills the form from the consultation module; the system automatically sends the request to suppliers.
- Admin route: after a phone consultation, the administrator enters the final equipment specifications agreed during the call and creates the supplier request in one click.

### Phase 2: Supplier offers and comparison

The administrator receives supplier responses and uploads the relevant offers. Instead of building a complex automated comparison engine, the process is streamlined to use external AI support to generate a clear final report for the client.

The report includes:

- sales price and commercial conditions
- estimated electricity consumption (monthly kWh)
- warranty terms
- material durability or build quality
- ongoing maintenance costs
- technical advantages and disadvantages

The final document is uploaded into the client profile and the client receives a notification stating that the technical analysis and offers for the new equipment are ready.

This means the product is not trying to fully automate supplier scoring. Instead, it simplifies the workflow while keeping the premium consulting judgment in the loop.

## 7. Product journey across both apps

1. The administrator adds equipment to the digital inventory during an on-site assessment.
2. The customer receives a critical alert when maintenance is due.
3. The customer confirms the need and schedules the service or repair workflow.
4. The customer accesses the equipment-consultation section when they need a new machine.
5. The customer either calls the expert directly or submits the short equipment request form.
6. The request becomes a lead in the admin panel.
7. The administrator confirms technical requirements and generates a supplier quote request.
8. Suppliers reply with offers.
9. The administrator uses the AI-assisted workflow to create a final comparison document.
10. The document is published in the client app and the client is notified that the analysis is ready.

## 8. Data model requirements

The first release should support the following conceptual records:

- users and roles
- restaurants and business profiles
- equipment inventory records
- maintenance frequency and due-date tracking
- alert event logs and delivery status
- consultation leads and equipment request forms
- quote request documents
- supplier offers
- comparison reports
- notification records and client status updates

## 9. Decisions still Open before implementation

1. Exact maintenance scheduling rules for each equipment category
2. Reminder and alert delivery timing beyond the critical alert behavior
3. How to structure the maintenance/alert lifecycle after confirmation
4. Which fields are mandatory in the equipment inventory record
5. Which CUI or registry source will power business onboarding and validation
6. Required fields in the consultation form for each equipment category
7. Supplier outreach and quote-request delivery flow
8. Whether the final comparison report will include a recommendation or remain neutral
9. Revenue model and commission disclosure
10. Launch-language and regional scope

## 10. Future roadmap

These are not required in the first release:

1. IoT or temperature alerts
2. predictive maintenance
3. consumables tracking
4. HACCP reporting
5. QR labels for equipment
6. service ticketing
7. financing integrations
8. video tutorials
9. business analytics dashboards
10. supplier or technician rating systems

## 11. Definition of first-release success

CoreHa helps a restaurant avoid missed maintenance periods, get clear critical alerts when equipment needs attention, and access expert technical guidance for new equipment decisions. The admin team can manage the service inventory, convert client needs into supplier requests, and generate a clear technical comparison for the client without requiring the future roadmap features.
