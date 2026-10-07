# Requirements Overview

This file summarizes the current first release based on the approved product specification documents in this folder. See [Product Blueprint](product-blueprint.md) for the complete workflow and open decisions.

## First-release objective

Help a restaurant manage critical equipment maintenance and obtain expert technical guidance for new equipment purchases, while allowing the CoreHa administrator to generate supplier requests and produce a client-facing comparison report.

## Module 1: Inventory and critical alerts

- The CoreHa administrator creates the digital equipment inventory manually after on-site assessment.
- Each equipment item is labeled clearly and assigned a category such as refrigeration, washing, ice, or cooking.
- A maintenance interval is defined in days or months based on the real operating needs of the restaurant.
- When the due date is reached, the app triggers a critical alert on the restaurant manager's phone.
- The restaurant user confirms the requirement and schedules the maintenance intervention.
- The alert delivery is logged in the admin panel so the service workflow can be tracked.

## Module 2: Equipment consultation and lead capture

- The restaurant user can access the equipment-consultation section in the app.
- The primary experience is a direct call to the expert, designed to quickly resolve technical fit and compatibility questions.
- If the user cannot call immediately, they may submit a short request form.
- The form requests the type of equipment, fuel source, electrical configuration, capacity needs, and specific technical constraints.
- Once submitted, the request becomes a lead in the admin dashboard.
- The administrator can follow up with the restaurant and prepare the next stage with supplier outreach.

## Module 3: Quote generation and offer analysis

- The system generates a supplier quote request automatically from the consultation data or from the admin's follow-up phone discussion.
- The administrator can trigger supplier outreach with a single click after agreeing on the technical details.
- Incoming supplier offers are centralized in the admin workflow.
- The administrator uses external AI assistance to prepare a final comparison report for the client.
- The final report includes technical and commercial information such as price, estimated monthly electricity use, warranty, material durability, and maintenance costs.
- The report is uploaded into the client profile and the client receives a notification that the analysis is ready.

## Roles

- Restaurant user: receives equipment alerts, confirms maintenance needs, requests equipment advice, and reviews final offer analysis.
- CoreHa administrator: manages asset records, qualifies leads, prepares quote requests, centralizes offers, and generates final reports for the client.
- Supplier: external network; no direct supplier account is required in the first release.

## First-release boundaries

- The product focuses on restaurants and kitchen equipment.
- Supplier accounts are not required for the initial release.
- The system does not aim to build a fully autonomous supplier comparison engine; the expert/admin remains in the decision loop.
- The first release does not include IoT, predictive maintenance, financing, QR tracking, service tickets, or other future modules.

## Future roadmap

See the future roadmap section in [Product Blueprint](product-blueprint.md) for the next expansion areas.
