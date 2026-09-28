# EventFlow Backend

Production-oriented backend for **EventFlow**, a multi-role event management, ticketing, payment, digital-ticket, check-in, refund, dispute, announcement, and payout platform.

The backend is the system of record for authentication, RBAC, organizer approval, event lifecycle, ticket inventory, payment verification, QR-ticket integrity, check-in rules, refunds, transfers, waitlists, announcements, disputes, payouts, analytics, and audit-sensitive operations.

> The original business/product specification is kept in **Project Requirements.md**. This README documents the mechanism that is implemented in the current codebase.

## Production endpoints

- API: https://eventflow-ln9q.onrender.com
- API base: https://eventflow-ln9q.onrender.com/api/v1
- Swagger UI: https://eventflow-ln9q.onrender.com/api-docs
- OpenAPI JSON: https://eventflow-ln9q.onrender.com/api-docs.json
- Frontend: https://event-flow-frontend-nu.vercel.app

## Technology stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js |
| Language | TypeScript |
| HTTP | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Cache / OTP | Redis |
| Validation | Zod |
| Authentication | JWT access + refresh sessions |
| Passwords | bcryptjs |
| Google auth | google-auth-library |
| Email | Resend HTTPS API |
| Media | Cloudinary |
| Payments | Paymently / UddoktaPay integration |
| QR | qrcode + HMAC-signed payloads |
| PDF | PDFKit |
| Scheduling | node-cron |
| API docs | Swagger / OpenAPI |
| CI | GitHub Actions |

## What EventFlow does

EventFlow supports five roles:

| Role | Primary responsibility |
| --- | --- |
| Attendee | Discover events, buy tickets, receive QR tickets, request refunds/transfers, join waitlists, review events |
| Organizer | Apply for approval, create/manage events, ticket types, promos, staff, announcements, refunds, payouts |
| Event Staff | Work only on assigned events and perform ticket check-in |
| Admin | Review organizers/events, manage users/categories, refunds, payouts, disputes, moderation |
| Super Admin | Platform-level administration plus Admin capabilities |

Google sign-in is intentionally limited to **Attendees**. Organizer, Event Staff, Admin, and Super Admin accounts use email/password flows.

## High-level architecture

~~~mermaid
flowchart LR
    U[Browser / Next.js Frontend] -->|HTTPS / JSON| API[Express API]
    API --> AUTH[Auth + RBAC]
    API --> DB[(PostgreSQL / Prisma)]
    API --> REDIS[(Redis)]
    API --> MAIL[Resend]
    API --> MEDIA[Cloudinary]
    API --> PAY[Paymently / UddoktaPay]
    PAY --> STRIPE[Stripe Sandbox / Stripe]
    PAY --> BKS[bKash / BDT gateways]
    API --> JOBS[node-cron jobs]
    API --> QR[QR + PDF ticket generator]
~~~

## Core API modules

All application APIs are mounted under **/api/v1**.

| Module | Base path |
| --- | --- |
| Auth | /auth |
| Users | /user |
| Organizer | /organizer |
| Admin | /admin |
| Categories | /categories |
| Events | /events |
| Ticket types | /ticket-types |
| Staff | /staff |
| Promo codes | /promos |
| Orders | /orders |
| Payments | /payment |
| Tickets | /tickets |
| Refunds | /refunds |
| Transfers | /transfers |
| Waitlist | /waitlist |
| Notifications | /notifications |
| Announcements | /announcements |
| Reviews | /reviews |
| Disputes | /disputes |
| Payouts | /payouts |
| Analytics | /analytics |

Swagger is the canonical route-level reference.

---

# End-to-end mechanism

## 1. Attendee registration and login

An attendee can register with email/password or use Google sign-in.

Email/password registration:

~~~text
Register
  -> temporary registration data stored in Redis
  -> OTP email sent
  -> verify OTP
  -> ATTENDEE user + attendee profile created
  -> access token + refresh session issued
  -> user enters attendee dashboard
~~~

Important rules:

- registration OTP lifetime: 10 minutes
- OTP resend cooldown: 60 seconds
- invalid OTP attempts are limited
- passwords are hashed before persistence
- refresh sessions are persisted and revocable
- blocked users cannot log in
- Google auth is Attendee-only

## 2. Organizer application and approval

A public applicant does not directly register as an Organizer. They submit an organizer application with organization information and a verification document.

~~~text
Organizer application
  -> verification document upload
  -> email OTP
  -> OTP verified
  -> ORGANIZER account created with PENDING approval
  -> Admin / Super Admin reviews
      -> APPROVED
      -> or REJECTED
~~~

An approved organizer can then sign in and create events.

### Current account-model limitation

The current implementation uses a single primary role on a user account. If an email already belongs to an Attendee account, the same email cannot currently submit a fresh Organizer application. The current workaround is a separate Organizer email/account.

A future enhancement can support one identity with multiple platform roles.

## 3. Event creation

Only an **approved Organizer** can create an event.

The organizer defines:

- category
- title and descriptions
- venue and address
- start/end time
- entry-open time
- ticket-sale window
- capacity
- contact information
- policies and refund settings
- event currency: **BDT or USD**
- cover/gallery media

An event starts as **DRAFT**.

Before review, EventFlow requires:

- a cover image
- at least one ticket type
- ticket inventory that does not exceed event capacity

## 4. Event lifecycle

~~~mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING_REVIEW: organizer submits
    PENDING_REVIEW --> APPROVED: admin approves
    PENDING_REVIEW --> REJECTED: admin rejects
    PENDING_REVIEW --> CHANGES_REQUESTED: admin requests changes
    CHANGES_REQUESTED --> PENDING_REVIEW: organizer resubmits
    REJECTED --> PENDING_REVIEW: allowed rework/resubmission
    APPROVED --> PUBLISHED: organizer publishes
    PUBLISHED --> ONGOING: start time reached
    ONGOING --> COMPLETED: end time reached
    PUBLISHED --> CANCELLED: cancellation
    APPROVED --> CANCELLED: cancellation
    PUBLISHED --> SUSPENDED: admin action
~~~

Background jobs advance published events into ongoing/completed states.

## 5. Ticket types and inventory

An Organizer can create multiple ticket types such as:

- General Admission
- VIP
- Early Bird
- Student
- Group Package

Each ticket type has its own price, quantity, max-per-order rule, sale dates, benefits, refundability, transferability, and visibility.

### Oversell protection

Checkout creates a temporary reservation before payment.

~~~text
available = quantity - soldQuantity - reservedQuantity
~~~

The reservation operation updates inventory atomically. If enough inventory is unavailable, checkout is rejected.

Reservations expire automatically. Expired reservations release reserved inventory.

## 6. BDT and USD currency model

Currency is defined at the **event level** and propagated into:

- ticket display
- orders
- payments
- refunds
- payouts
- analytics

Supported currencies:

~~~text
BDT
USD
~~~

Once ticket types exist, EventFlow locks event currency so mixed-currency inventory cannot be created accidentally.

Analytics keeps BDT and USD totals separate rather than adding unlike currencies together.

## 7. Checkout and payment

Attendee checkout:

~~~mermaid
sequenceDiagram
    participant A as Attendee
    participant F as EventFlow API
    participant DB as PostgreSQL
    participant P as Paymently
    participant G as Gateway

    A->>F: POST order checkout
    F->>DB: reserve inventory + create PENDING order/payment
    F->>P: create checkout invoice
    P-->>F: payment URL + invoice ID
    F-->>A: payment URL
    A->>P: open checkout
    P->>G: Stripe / bKash / configured gateway
    G-->>P: payment result
    P->>F: callback / webhook
    F->>P: verify invoice server-side
    F->>DB: finalize payment/order/reservation
    F->>DB: generate ticket records
    F-->>A: redirect to order detail
~~~

A browser redirect is **never** treated as proof of payment. EventFlow verifies the provider invoice server-side.

### Paymently currency behavior

Paymently/UddoktaPay Create Charge is treated as using the payment panel's active/default invoice currency. EventFlow therefore has a safety environment variable:

~~~env
UDDOKTAPAY_CURRENCY=BDT
~~~

or:

~~~env
UDDOKTAPAY_CURRENCY=USD
~~~

The value must match Paymently's active/default currency.

Typical testing setup:

| Event currency | Paymently default | EventFlow env | Gateway |
| --- | --- | --- | --- |
| BDT | BDT | BDT | bKash / BDT gateway |
| USD | USD | USD | Stripe |

For Stripe development, use Stripe **Sandbox/Test Mode** so no real money is charged.

## 8. Promo codes

A promo is validated before checkout.

The backend checks:

- correct event
- active status
- start/end time
- usage limit
- minimum order amount
- whether that attendee already redeemed it

Discount calculation happens before service fee calculation.

Example with a USD 10 ticket and a 70% discount:

~~~text
subtotal = 10.00
discount = 7.00
net = 3.00
service fee at 5% = 0.15
total = 3.15 USD
~~~

A promo is counted as redeemed only when payment finalization succeeds.

## 9. Payment finalization and idempotency

After provider verification, EventFlow validates:

- provider status is completed
- provider metadata contains the EventFlow order ID
- provider amount matches the local order total
- metadata currency matches the order currency when supplied
- local reservation has not expired

Finalization is transaction-based.

Within one database transaction EventFlow:

1. marks Payment as PAID
2. marks Order as PAID
3. converts the reservation
4. updates reserved/sold ticket counts
5. increments promo use if applicable
6. records promo redemption
7. creates digital ticket records

If a later step fails, the transaction rolls back. This prevents a Payment row becoming PAID while ticket generation failed.

Repeated payment callbacks do not generate duplicate tickets.

## 10. Digital tickets

After successful payment, each ticket gets:

- unique ticket ID
- unique ticket number
- event reference
- order reference
- ticket type
- owner
- signed QR payload
- QR token hash
- status

The attendee can view the ticket online and download a premium PDF ticket.

The PDF contains:

- EventFlow branding
- event name
- ticket type
- currency and price
- ticket number
- order number
- venue/address
- event start
- status
- QR code
- security guidance

### QR security

QR payloads are HMAC-signed using **QR_SECRET**.

Production must define a strong, stable secret:

~~~env
QR_SECRET=replace-with-a-long-random-secret
~~~

Do not rotate this casually. Changing QR_SECRET invalidates previously issued QR signatures.

## 11. Event Staff invitation

An Organizer can invite Event Staff and assign them to one or more owned events.

The invitation flow is:

~~~text
Organizer sends invitation
  -> EventFlow creates/updates EVENT_STAFF account
  -> temporary password generated and stored
  -> invitation token generated and stored as a hash
  -> email sent
  -> staff opens Accept Invitation page
  -> staff pastes token
  -> invitation becomes ACCEPTED
  -> assignments become active
  -> staff signs in with email + temporary password
  -> first login redirects to Security
  -> staff changes to a permanent password
~~~

Invitation page:

https://event-flow-frontend-nu.vercel.app/staff/accept

Invitations expire after 48 hours.

Re-inviting existing pending staff rotates and persists the temporary password so the emailed password and stored password stay consistent.

## 12. Ticket check-in

Organizer or Event Staff can check in a ticket only for an event they manage/are assigned to.

EventFlow validates:

- scanner authorization
- staff assignment is active
- event entry window is open
- event has not ended
- ticket belongs to selected event
- QR signature is valid
- ticket status is VALID

On success:

~~~text
VALID -> CHECKED_IN
~~~

The check-in record stores the scanner identity, event, method, device information when provided, and timestamp.

A second use of the same ticket is rejected.

### Entry-window rule

Before the event's configured **entryOpenTime**, check-in returns:

~~~text
Event entry window is not open
~~~

After event end, it returns a closed-window error.

This is intentional venue-access control.

### Manual check-in

Staff can search by:

- ticket number
- order number
- attendee email
- attendee name

A manual check-in is audit-sensitive and records the manual method.

## 13. Announcements

Organizer announcements target **distinct ticket owners** for that event whose tickets are currently:

~~~text
VALID
CHECKED_IN
~~~

Sending an announcement creates:

1. an in-app notification
2. an email through Resend

One attendee with multiple tickets receives one announcement, because recipients are deduplicated by ticket owner.

Normal announcements are blocked for cancelled/completed events.

## 14. Refunds

Refund requests are persisted separately from payments/orders and preserve order currency.

The platform can:

- receive attendee requests
- allow organizer/admin decision workflows
- track requested and approved amounts
- track processing/refunded state
- prevent invalid refund operations

Cancelled events can create refund records for affected paid orders.

## 15. Ticket transfer

Eligible tickets can be transferred only when transfer rules allow it.

A transfer flow can:

- identify recipient by email
- create a pending transfer
- expire the transfer
- accept the transfer
- change ownership
- invalidate old QR identity and generate appropriate ticket identity for the recipient

## 16. Waitlist

When inventory is unavailable, attendees can enter a waitlist.

A background job looks for newly available inventory and offers it in first-come order.

Waitlist offer state is time-bound and can expire so inventory can move to another attendee.

## 17. Reviews

Review eligibility is tied to event/ticket/order state so unrelated users cannot review arbitrary events.

Admins can moderate review visibility.

## 18. Disputes

Disputes connect an attendee issue to relevant commerce/event resources. Organizer responses and admin decisions are persisted so dispute-sensitive payout decisions can be made.

Open disputes can prevent payout eligibility.

## 19. Organizer payouts

Payouts preserve event currency.

EventFlow calculates organizer earnings from event revenue and deductions, then holds payout eligibility until:

- the event is completed
- the configured hold period passes
- no blocking dispute exists

Typical lifecycle:

~~~text
PENDING -> ELIGIBLE -> REQUESTED -> PROCESSING -> PAID
~~~

Admins manage payout processing.

## 20. Notifications

The platform stores in-app notifications for important lifecycle events such as:

- organizer decisions
- ticket purchase/payment
- announcements
- waitlist offers
- refunds
- disputes
- payout updates

Transactional email complements in-app notification where appropriate.

## 21. Analytics

Role-aware analytics endpoints expose only data appropriate to the authenticated role.

Examples:

**Attendee**
- orders
- tickets
- spending by currency
- upcoming tickets

**Organizer**
- event counts
- paid orders
- gross revenue by currency
- tickets sold
- check-in rate
- refunds by currency
- payout history

**Admin**
- platform users
- organizer/event moderation queues
- ticket-sales volume
- GMV by currency
- service fees by currency
- refunds
- disputes
- payouts

Cross-currency money is never represented as one summed value.

## 22. Background jobs

A cron job runs recurring lifecycle work including:

- expiring checkout reservations
- publishing scheduled approved events
- moving PUBLISHED events to ONGOING
- moving ONGOING events to COMPLETED
- expiring staff invitations
- expiring transfer invitations
- offering waitlist inventory
- expiring waitlist offers
- releasing eligible payouts

Jobs are written to be safe when re-evaluated repeatedly.

---

# Security model

EventFlow enforces security on the backend, not by hiding frontend controls.

Implemented controls include:

- role-based authorization
- organizer/event ownership checks
- password hashing
- access and refresh tokens
- persisted/revocable sessions
- HTTP-only auth cookies
- CSRF guard
- CORS origin restriction
- OTP expiry/cooldowns/attempt limits
- Zod validation
- upload MIME validation
- HMAC-signed QR payloads
- server-side payment verification
- payment amount/currency matching
- idempotent payment finalization
- concurrency-safe inventory reservation
- protected audit-sensitive actions
- structured production error handling
- secret-based environment configuration

Never commit production secrets.

---

# Local development

## Requirements

- Node.js
- PostgreSQL
- Redis
- Cloudinary account
- Resend account/API key
- Paymently/UddoktaPay sandbox account
- Google OAuth client if testing Google sign-in

## Install

~~~bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run dev
~~~

Default local API:

~~~text
http://localhost:5000
~~~

Swagger:

~~~text
http://localhost:5000/api-docs
~~~

## Important environment variables

~~~env
NODE_ENV=development
PORT=5000

DATABASE_URL=
DIRECT_URL=
SHADOW_DATABASE_URL=

BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
QR_SECRET=

GOOGLE_CLIENT_ID=

REDIS_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

EMAIL_SENDER=
RESEND_API_KEY=

UDDOKTAPAY_BASE_URL=
UDDOKTAPAY_API_KEY=
UDDOKTAPAY_CURRENCY=BDT

RESERVATION_MINUTES=10
SERVICE_FEE_PERCENT=5
PLATFORM_COMMISSION_PERCENT=10
PAYOUT_HOLD_DAYS=7
~~~

See **.env.example** for the complete template.

---

# Useful scripts

| Command | Purpose |
| --- | --- |
| npm run dev | Run backend in watch mode |
| npm run build | TypeScript compilation |
| npm start | Start backend with tsx |
| npm run prisma:generate | Generate Prisma client |
| npm run prisma:migrate | Create/apply development migration |
| npm run prisma:deploy | Apply committed migrations |
| npm run verify:api-contract | Verify Express/OpenAPI/Postman route coverage |
| npm run test:api-routes | Smoke mounted API routes |
| npm run format:check | Biome formatting check |
| npm run lint:check | Biome lint check |

---

# Deployment

The production backend is deployed on **Render**.

A deployment must have all required secrets configured in Render Environment, especially:

- DATABASE_URL / DIRECT_URL
- JWT secrets
- QR_SECRET
- Redis connection
- Cloudinary credentials
- EMAIL_SENDER / RESEND_API_KEY
- UDDOKTAPAY_BASE_URL / UDDOKTAPAY_API_KEY
- UDDOKTAPAY_CURRENCY
- FRONTEND_URL
- BACKEND_URL

After changing payment currency configuration, Paymently's default currency and EventFlow's UDDOKTAPAY_CURRENCY must remain aligned.

---

# CI / verification

GitHub Actions validates the backend using jobs for:

- dependency installation
- Prisma client generation
- TypeScript build
- migration deployment from an empty PostgreSQL database
- API-contract verification
- mounted-route smoke testing
- public/authenticated API smoke flows

Do not treat a feature as production-ready until CI is green.

---

# Repository relationship

This repository is the **backend/API**.

Frontend repository:

https://github.com/masudrana430/EventFlow-frontend

Production frontend:

https://event-flow-frontend-nu.vercel.app

The frontend is a role-aware client. The backend remains authoritative for permissions, money, ticket validity, event ownership, check-in, and all lifecycle decisions.

## License

Project-specific / repository-owner terms apply.
