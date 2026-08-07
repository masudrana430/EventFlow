# Project Requirements — EventFlow

## 1. Overview

EventFlow is an event-management and ticketing platform that connects event organizers with attendees.

An organizer applies to join the platform, creates an event, publishes ticket types, and submits the event for approval. After an Admin approves the event, attendees can discover it, purchase tickets, receive QR-based digital passes, and use those passes to enter the venue.

Organizers can monitor ticket sales, communicate with attendees, scan tickets at the entrance, manage event staff, and receive their earnings after the event is completed.

Admins and Super Admins manage organizer approvals, event moderation, refunds, disputes, platform fees, user accounts, and organizer payouts.

This document defines what the system must do and the exact business rules it must follow. It is a product specification, not a database schema or API design. Database models and API endpoints should be designed afterward based on these rules.

---

## 2. User roles

Five roles exist:

1. Super Admin
2. Admin
3. Organizer
4. Event Staff
5. Attendee

| Role        | How they join                      | Login method             |
| ----------- | ---------------------------------- | ------------------------ |
| Attendee    | Registers directly                 | Email/password or Google |
| Organizer   | Applies and waits for approval     | Email/password           |
| Event Staff | Invited by an approved organizer   | Email/password           |
| Admin       | Created by an Admin or Super Admin | Email/password           |
| Super Admin | Created by another Super Admin     | Email/password           |

Google authentication is available only to Attendees.

Organizers, Event Staff, Admins, and Super Admins always use email and password.

---

## 2.1 Role responsibilities

### Attendee

An Attendee can:

* Browse approved and published events
* Search and filter events
* Purchase tickets
* Download digital tickets
* View QR passes
* Transfer eligible tickets
* Request cancellation or refund
* Join an event waitlist
* Submit event reviews
* Open support disputes
* Receive announcements and reminders

### Organizer

An Organizer can:

* Create and manage events
* Create multiple ticket types
* Configure ticket inventory and pricing
* Submit events for approval
* Invite Event Staff
* Send announcements to attendees
* View sales and attendance analytics
* Scan tickets
* Respond to refund requests
* Request payouts
* Respond to disputes

### Event Staff

Event Staff can:

* View assigned events
* Scan attendee QR codes
* Manually search for a ticket
* Mark an attendee as checked in
* View basic attendance statistics

Event Staff cannot:

* Edit event information
* Change ticket prices
* Issue refunds
* Access organizer revenue
* Invite other staff
* Request payouts

### Admin

An Admin can:

* Approve or reject organizer applications
* Approve or reject events
* Block or unblock Attendees
* Block or unblock Organizers
* Suspend events
* Review refund disputes
* Process organizer payouts
* Create Admin accounts
* Manage event categories
* Manage platform fees

### Super Admin

A Super Admin has all Admin permissions and can additionally:

* Create Super Admin accounts
* Block or unblock Admins
* Block or unblock Super Admins
* Change global platform settings
* View administrative audit logs

---

## 2.2 Who can manage whom

| Action                                   | Admin | Super Admin |
| ---------------------------------------- | ----: | ----------: |
| Approve or reject Organizer applications |   Yes |         Yes |
| Approve or reject events                 |   Yes |         Yes |
| Block or unblock Attendees               |   Yes |         Yes |
| Block or unblock Organizers              |   Yes |         Yes |
| Suspend or restore events                |   Yes |         Yes |
| Create an Admin                          |   Yes |         Yes |
| Create a Super Admin                     |    No |         Yes |
| Block or unblock an Admin                |    No |         Yes |
| Block or unblock a Super Admin           |    No |         Yes |
| Change global platform settings          |    No |         Yes |
| View all administrative audit logs       |    No |         Yes |

An Admin can manage platform users and content, but only a Super Admin can act on another Admin or Super Admin.

---

## 3. Accounts and authentication

### 3.1 Attendee registration

An Attendee registers using:

* Full name
* Email address
* Password

The Attendee may alternatively register with Google.

Every direct registration creates an Attendee account. A public user cannot register directly as an Organizer, Event Staff, Admin, or Super Admin.

---

### 3.2 Organizer application

A person who wants to become an Organizer must complete a separate application.

The application includes:

* Full name
* Email
* Password
* Phone number
* Organization or business name
* Organization type
* Business address
* National identification or business-registration document
* Previous event-management experience
* Website or social-media link, if available

The applicant must verify their email with an OTP.

After verification, the application receives a pending status.

The applicant cannot use Organizer features until an Admin or Super Admin approves the application.

---

### 3.3 Email OTP verification

Email OTP verification is required for:

* Attendee registration with email and password
* Organizer application
* Forgot-password requests
* Sensitive email-change requests

Google registration does not require OTP verification because Google has already verified the email address.

Admin, Super Admin, and Event Staff accounts do not use self-registration OTP. Their accounts are created through invitation flows.

An OTP:

* Expires after 10 minutes
* Can be used only once
* Is invalidated when a newer OTP is generated
* Can be resent only after a 60-second cooldown
* Must be rate-limited to prevent abuse

---

### 3.4 Login

Attendees may log in with:

* Email and password
* Google

An Attendee who registered with email and password may later log in with Google if the Google email matches the same verified email address.

The system must not create a duplicate account in that case.

Organizers, Event Staff, Admins, and Super Admins may log in only with email and password.

A blocked account cannot log in.

A pending or rejected Organizer application cannot log in as an Organizer.

---

### 3.5 Forgot password and reset password

Any user who uses password authentication may request a password reset.

The process has two steps:

1. The user submits their email and receives an OTP.
2. The user submits the OTP and a new password.

The new password must satisfy the platform password policy.

After a successful reset:

* All existing refresh tokens for that account are revoked
* The user must log in again
* A password-change confirmation email is sent

---

### 3.6 Set password for Google Attendees

An Attendee who registered through Google may not initially have a password.

The Set Password feature allows that Attendee to create one.

After setting a password, the Attendee may log in using either:

* Google
* Email and password

This feature is available only to Attendees.

---

### 3.7 Change password

A logged-in password-based user may change their password by submitting:

* Current password
* New password

The current password must be correct.

After changing the password, all other active sessions should be revoked.

---

### 3.8 Sessions and tokens

Every successful login issues:

* A short-lived access token
* A longer-lived refresh token

Both tokens are stored using secure, HTTP-only cookies.

The system must support:

* Token refresh
* Logout from the current device
* Logout from all devices
* Refresh-token revocation
* Session expiration
* Detection of revoked or blocked accounts

---

## 4. Admin and Super Admin management

Admins and Super Admins cannot self-register.

An authorized Admin or Super Admin creates an account using:

* Full name
* Organization email
* Personal email
* Role
* Phone number

An Admin may create another Admin.

Only a Super Admin may create a Super Admin.

The system generates a temporary password and sends it to the new account holder’s personal email.

The email contains:

* Organization email
* Temporary password
* Login link
* Instruction to change the password

The new account receives a must-change-password flag.

Until the password is changed, the user may access only:

* Their profile
* The change-password screen
* Logout

---

## 5. Organizer approval

Organizer applications move through these statuses:

pending → approved

or:

pending → rejected

An Admin or Super Admin reviews the application.

### Approval

When approved:

* The Organizer account becomes active
* The Organizer receives a welcome email
* Organizer dashboard access becomes available
* The Organizer may create events

### Rejection

When rejected:

* The application stores a rejection reason
* The applicant receives an email
* The applicant cannot use Organizer features
* The applicant may submit a new application after 30 days

An Admin cannot approve an incomplete application.

---

## 6. Event creation

Only an approved and active Organizer may create an event.

Each event contains:

* Event title
* Short description
* Full description
* Event category
* Cover image
* Gallery images
* Venue name
* Venue address
* Geographic coordinates
* Event date
* Event start time
* Event end time
* Entry opening time
* Organizer contact information
* Age restriction
* Event policies
* Refund policy
* Ticket-sale start time
* Ticket-sale end time
* Maximum venue capacity

---

## 6.1 Event date and time rules

An event must follow these rules:

* The event start time must be in the future
* The end time must be after the start time
* Ticket sales must begin before ticket sales end
* Ticket sales must end before the event starts
* Entry opening time cannot be after the event start time
* Venue capacity must be greater than zero
* The combined ticket inventory cannot exceed venue capacity

An event may span midnight.

For example, an event may begin at 8:00 PM and end at 2:00 AM the following day.

---

## 6.2 Event lifecycle

An event moves through these statuses:

draft → pending_review → approved → published → ongoing → completed

Other possible statuses are:

* rejected
* suspended
* cancelled

### Draft

The Organizer is still preparing the event.

Attendees cannot see it.

### Pending review

The Organizer has submitted the event for approval.

The Organizer may no longer edit approval-sensitive fields while review is pending.

### Approved

An Admin has approved the event.

The Organizer may publish it immediately or schedule publication.

### Published

The event is visible to Attendees.

Tickets may be sold only during the configured ticket-sale period.

### Ongoing

The event has started.

New ticket purchases are no longer allowed.

Ticket scanning remains available.

### Completed

The event end time has passed and the Organizer has confirmed completion.

The platform may begin payout processing after the dispute-hold period.

---

## 6.3 Event review and approval

An Organizer submits a completed event for review.

An Admin or Super Admin may:

* Approve it
* Reject it with a reason
* Request changes

If changes are requested:

* The event returns to draft
* The Organizer sees the requested changes
* The Organizer edits and resubmits it

Approval checks may include:

* Valid Organizer identity
* Complete venue information
* Appropriate event category
* Valid ticket pricing
* No prohibited content
* Venue capacity consistency
* Clear refund policy
* Valid event date and time

---

## 6.4 Editing an approved or published event

Different fields lock at different times.

| Field           | Editing rule                                         |
| --------------- | ---------------------------------------------------- |
| Event title     | Editable until the first ticket is sold              |
| Category        | Editable until approval                              |
| Event date      | Editable until the first ticket is sold              |
| Venue           | Editable until the first ticket is sold              |
| Ticket price    | Editable until a ticket of that type is sold         |
| Ticket capacity | May be increased but not reduced below sold quantity |
| Description     | Editable until event start                           |
| Cover image     | Editable until event start                           |
| Contact details | Editable until event completion                      |
| Refund policy   | Locked after the first ticket sale                   |

If a critical field must change after ticket sales begin, the Organizer must request an Admin-assisted event modification.

Affected Attendees must be notified.

---

## 7. Ticket types

An Organizer may create multiple ticket types for one event.

Examples:

* General Admission
* VIP
* Early Bird
* Student
* Group Package

Each ticket type contains:

* Name
* Description
* Price
* Quantity
* Maximum quantity per order
* Sale start time
* Sale end time
* Transferability
* Refund eligibility
* Benefits
* Visibility status

---

## 7.1 Ticket inventory rules

The system must prevent overselling.

When an Attendee begins checkout, the selected ticket quantity is temporarily reserved.

A reservation:

* Lasts for 10 minutes
* Prevents other users from buying the same inventory
* Expires automatically if payment is not completed
* Converts into sold inventory after successful payment

If payment fails or the reservation expires, the inventory becomes available again.

The sum of sold and actively reserved tickets cannot exceed the ticket type’s quantity.

---

## 7.2 Ticket pricing rules

Ticket prices cannot be negative.

A free ticket has a price of zero and does not require a payment-gateway transaction.

For paid tickets, the final price may include:

* Base ticket price
* Platform service fee
* Taxes, if configured
* Discount
* Promotional code adjustment

The checkout page must show a complete price breakdown before confirmation.

---

## 8. Event discovery

Attendees can browse only events that are:

* Approved
* Published
* Not suspended
* Not cancelled
* Not completed

Attendees can search and filter by:

* Event name
* Category
* Location
* Date
* Price range
* Free or paid
* Organizer
* Availability
* Popularity

Search results should support:

* Pagination
* Sorting
* Location-based discovery
* Upcoming-events filtering
* Recommended events

A sold-out event may remain visible but must show a sold-out status.

---

## 9. Ticket purchase

An Attendee selects:

* Event
* Ticket type
* Quantity

The system then:

1. Validates inventory
2. Creates a temporary reservation
3. Calculates fees and discounts
4. Creates a pending order
5. Sends the Attendee to the payment gateway
6. Verifies the payment result
7. Confirms the order
8. Generates digital tickets
9. Emails the invoice and tickets

A ticket purchase is complete only after server-side payment verification.

A successful browser redirect alone is not enough to mark an order as paid.

---

## 9.1 Order lifecycle

An order moves through these statuses:

pending → paid → completed

Alternative statuses include:

* payment_failed
* expired
* partially_refunded
* refunded
* cancelled

### Pending

The checkout session exists but payment has not been verified.

### Paid

Payment was successfully verified and tickets were generated.

### Completed

The event has completed and the order has no unresolved issue.

### Expired

The reservation expired before successful payment.

---

## 9.2 Duplicate payment protection

The payment-verification operation must be idempotent.

If the payment gateway sends multiple callbacks for the same transaction:

* The order must not be paid twice
* Tickets must not be generated twice
* Inventory must not be reduced twice
* Confirmation emails must not be sent repeatedly

Every payment transaction must have a unique gateway transaction ID.

---

## 10. Digital tickets

Each purchased ticket receives:

* Unique ticket number
* Unique QR code
* Event name
* Ticket type
* Attendee name
* Event date
* Venue
* Order number
* Ticket status

A PDF ticket is generated and emailed to the Attendee.

Tickets are also accessible from the Attendee dashboard.

One order may contain multiple tickets.

Each ticket must have its own unique QR code.

---

## 10.1 Ticket statuses

A ticket may have one of these statuses:

* valid
* checked_in
* transferred
* cancelled
* refunded
* void

A ticket marked checked_in cannot be checked in again.

A refunded or cancelled ticket cannot be used for entry.

---

## 11. QR-based event check-in

An Organizer or assigned Event Staff scans a ticket QR code.

The system validates:

* The ticket exists
* The ticket belongs to the correct event
* The ticket is valid
* The event entry window is open
* The ticket has not already been used
* The ticket has not been cancelled or refunded

If valid:

* Ticket status becomes checked_in
* Check-in time is recorded
* Scanner identity is recorded
* The attendance count updates in real time

If invalid, the scanner sees a clear rejection reason.

Examples:

* Already checked in
* Wrong event
* Ticket cancelled
* Ticket refunded
* Entry window not open
* Invalid QR code

---

## 11.1 Manual check-in

If scanning is unavailable, authorized staff may search by:

* Ticket number
* Order number
* Attendee email
* Attendee name

Manual check-in requires an additional confirmation step.

The system records that the entry was manual rather than QR-based.

---

## 12. Event Staff management

An Organizer may invite Event Staff using an email address.

The invitation contains:

* Organizer name
* Event name
* Invitation link
* Temporary password or account-setup link
* Invitation expiry time

An invitation expires after 48 hours.

The invited person may be assigned to one or more events.

An Organizer may revoke a staff member’s access at any time.

Revocation immediately removes access to assigned event-scanning tools.

---

## 13. Ticket transfer

An Attendee may transfer a ticket only when:

* The ticket type allows transfers
* The ticket is valid
* The ticket has not been checked in
* The event has not started
* The ticket is not involved in a refund request

The sender provides the recipient’s email.

The recipient receives a transfer invitation.

The transfer is completed only when the recipient accepts it.

After acceptance:

* The original ticket becomes transferred
* A new ticket is issued to the recipient
* The original QR code becomes invalid
* A new QR code is generated

The payment record remains linked to the original purchaser.

---

## 14. Waiting list

When an event or ticket type is sold out, an Attendee may join a waiting list.

The waiting list follows first-come, first-served order.

When inventory becomes available:

* The first eligible person receives an email and in-app notification
* A temporary purchase window is opened
* The reserved opportunity lasts for 30 minutes

If the person does not purchase within the window, the opportunity moves to the next person.

Joining the waiting list does not guarantee a ticket.

---

## 15. Promotional codes

An Organizer may create promotional codes for their own events.

Each promotional code may define:

* Percentage discount
* Fixed-amount discount
* Usage limit
* Usage limit per Attendee
* Minimum order value
* Applicable ticket types
* Start time
* Expiry time

A promotional code cannot:

* Reduce an order below zero
* Be used after expiration
* Exceed its usage limit
* Apply to an excluded ticket type

A code is counted as used only after successful payment.

---

## 16. Event announcements

An Organizer may send announcements to paid Attendees of an event.

Announcements may include:

* Schedule changes
* Venue instructions
* Entry rules
* Parking information
* Emergency notices
* Event cancellation information

Announcements are delivered through:

* In-app notifications
* Email

Only Attendees with valid tickets receive normal event announcements.

For cancellation or refund-related announcements, affected refunded users may also receive the message.

---

## 17. Cancellation and refunds

### 17.1 Attendee-requested cancellation

Whether an Attendee receives a refund depends on the event’s refund policy.

A ticket may define one of these policies:

* Fully refundable until a specified deadline
* Partially refundable until a specified deadline
* Non-refundable
* Organizer approval required

The applicable refund policy must be shown before payment.

---

## 17.2 Standard refund rule

Unless the Organizer defines a stricter approved policy:

| Cancellation time                          | Refund                   |
| ------------------------------------------ | ------------------------ |
| More than 72 hours before event start      | Full ticket price refund |
| Between 24 and 72 hours before event start | 50% ticket price refund  |
| Less than 24 hours before event start      | No refund                |
| After event start                          | No refund                |

Platform service fees may be non-refundable unless the event itself is cancelled.

---

## 17.3 Organizer-cancelled event

If an Organizer cancels an event:

* All valid tickets are cancelled
* All paid Attendees receive a full refund
* Platform service fees are also refunded
* QR codes become invalid
* Attendees receive email and in-app notifications
* Organizer payout for the event is blocked
* The cancellation reason is recorded

An Organizer cannot cancel an event after it is marked completed.

An Admin may cancel or suspend an event when necessary.

---

## 17.4 Refund lifecycle

A refund request moves through:

requested → approved → processing → refunded

Alternative statuses include:

* rejected
* failed
* cancelled

The system records:

* Request reason
* Requested amount
* Approved amount
* Decision maker
* Decision reason
* Gateway refund ID
* Refund completion time

---

## 18. Disputes

An Attendee may open a dispute for:

* Event cancelled without refund
* Event materially different from its listing
* Venue inaccessible
* Ticket rejected incorrectly
* Duplicate charge
* Organizer misconduct

A dispute must be opened within seven days after the event ends.

A dispute contains:

* Reason
* Description
* Evidence files
* Related order
* Related ticket
* Communication history

The Organizer may respond.

An Admin reviews the evidence and decides whether to:

* Reject the dispute
* Approve a partial refund
* Approve a full refund
* Warn the Organizer
* Suspend the Organizer
* Suspend the event

Dispute decisions must be recorded in an audit log.

---

## 19. Organizer earnings and payouts

Ticket revenue does not become immediately withdrawable.

The platform holds event earnings until:

* The event is completed
* A configurable dispute-hold period has passed
* No major unresolved dispute exists
* Refund liabilities have been calculated

Organizer earnings are calculated as:

gross ticket revenue
− refunded amounts
− payment-gateway fees
− platform commission
− other approved adjustments
= net payout amount

---

## 19.1 Payout lifecycle

A payout moves through:

pending → eligible → requested → processing → paid

Alternative statuses include:

* held
* rejected
* failed

### Pending

The event has not yet completed or the hold period is active.

### Eligible

The earnings are available for payout.

### Requested

The Organizer has requested withdrawal.

### Processing

An Admin is processing the payout.

### Paid

The payout has been completed.

A payout may be placed on hold because of:

* Open disputes
* Suspicious activity
* Identity-verification issues
* Event cancellation
* Excessive refund rate
* Admin investigation

---

## 20. Reviews and ratings

An Attendee may review an event only when:

* They purchased a valid ticket
* The event is completed
* The ticket was not fully refunded
* They have not already reviewed the event

A review contains:

* Rating from 1 to 5
* Written comment
* Optional photos

An Organizer cannot review their own event.

Admins may hide reviews that contain:

* Abuse
* Spam
* Personal information
* Fraudulent claims
* Prohibited content

The system should display:

* Event average rating
* Organizer average rating
* Total number of reviews

---

## 21. Notifications

The platform supports:

* In-app notifications
* Email notifications

Notification events include:

* Registration completed
* Organizer application approved or rejected
* Event approved or rejected
* Event published
* Ticket purchase completed
* Payment failed
* Ticket transferred
* Transfer invitation received
* Event reminder
* Announcement received
* Refund requested
* Refund approved or rejected
* Event cancelled
* Payout status changed
* Dispute updated

Users may mark notifications as read.

Transactional and security notifications cannot be disabled.

---

## 22. Scheduled jobs

The system requires scheduled background jobs for:

* Expiring ticket reservations
* Sending event reminders
* Moving events to ongoing status
* Moving events to completed status
* Expiring staff invitations
* Expiring transfer invitations
* Processing waiting-list opportunities
* Releasing organizer payouts
* Retrying failed emails
* Cleaning expired OTP records
* Detecting abandoned orders

Background jobs must be idempotent so that running the same job twice does not create duplicate actions.

---

## 23. Real-time features

The platform should provide real-time updates for:

* Remaining ticket inventory
* Ticket sales
* Check-in counts
* Organizer dashboard metrics
* Event announcements
* Refund and dispute status
* Admin moderation queues

Real-time updates may use WebSockets or Server-Sent Events.

The system must still work correctly when real-time connectivity is unavailable by falling back to normal data refetching.

---

## 24. Organizer analytics

The Organizer dashboard shows:

* Total events
* Published events
* Upcoming events
* Completed events
* Gross ticket revenue
* Net estimated earnings
* Tickets sold
* Remaining tickets
* Refund amount
* Check-in rate
* Sales by ticket type
* Sales over time
* Revenue over time
* Attendee locations
* Promotional-code usage
* Conversion rate
* Payout history

Analytics must be scoped so an Organizer can view only their own events and revenue.

---

## 25. Admin analytics

The Admin dashboard shows:

* Total users by role
* Pending Organizer applications
* Active Organizers
* Published events
* Pending event reviews
* Ticket sales volume
* Gross merchandise value
* Platform revenue
* Refund volume
* Open disputes
* Completed payouts
* Suspended events
* User growth
* Event-category performance

Only authorized Admins and Super Admins may access platform-wide financial metrics.

---

## 26. Audit logs

Sensitive actions must create audit logs.

Logged actions include:

* Organizer approval or rejection
* Event approval, rejection, suspension, or cancellation
* User blocking or unblocking
* Refund approval
* Payout processing
* Platform-fee changes
* Admin creation
* Role changes
* Dispute decisions
* Manual ticket check-in

Each audit log stores:

* Acting user
* Action
* Target resource
* Previous value, when applicable
* New value, when applicable
* Timestamp
* IP address
* User-agent information

Audit logs cannot be edited by normal users.

---

## 27. Security requirements

The system must include:

* Role-based access control
* Resource ownership validation
* Secure password hashing
* HTTP-only authentication cookies
* CSRF protection where required
* Input validation
* File-upload validation
* Rate limiting
* OTP attempt limiting
* Payment-signature verification
* Idempotent payment handling
* Prevention of ticket overselling
* QR-token integrity protection
* Audit logging
* Secure secret management

A frontend-hidden button is not authorization.

Every protected action must also be checked on the backend.

---

## 28. File uploads

Supported file uploads include:

* Organizer verification documents
* Event cover images
* Event gallery images
* Dispute evidence
* Review photos

The system must validate:

* File type
* File size
* File count
* Upload ownership

Private verification documents must not be publicly accessible.

Public event images may be stored and delivered through a cloud media service.

---

## 29. Error-handling requirements

The system must provide structured errors for:

* Validation failure
* Authentication failure
* Authorization failure
* Resource not found
* Ticket inventory conflict
* Expired reservation
* Duplicate payment callback
* Invalid QR code
* Already-used ticket
* Payment-gateway failure
* Refund failure
* File-upload failure
* Rate-limit violation

Errors shown to users must be clear without exposing internal stack traces, secrets, or database details.

---

## 30. Conceptual data models

The database structure is not finalized. These models describe the required information, not the final schema.

### User

Shared identity for every role:

* Name
* Email
* Password
* Google account link
* Role
* Account status
* Email-verification status
* Must-change-password flag
* Last login
* Session information

### Attendee profile

* User reference
* Phone number
* Profile image
* Saved preferences
* Location
* Notification preferences

### Organizer profile

* User reference
* Organization name
* Organization type
* Phone number
* Address
* Verification documents
* Approval status
* Approval or rejection information
* Payout information
* Average rating

### Event Staff profile

* User reference
* Inviting Organizer
* Assigned events
* Invitation status
* Access status

### Event

* Organizer
* Event information
* Category
* Venue
* Coordinates
* Date and time
* Capacity
* Status
* Approval data
* Policies
* Images

### Ticket type

* Event
* Name
* Description
* Price
* Quantity
* Sold quantity
* Reserved quantity
* Purchase limit
* Sale period
* Transfer rules
* Refund rules

### Ticket reservation

* Attendee
* Event
* Ticket type
* Quantity
* Expiry time
* Reservation status

### Order

* Attendee
* Event
* Ticket selections
* Price breakdown
* Discount
* Total amount
* Payment status
* Order status

### Payment

* Order
* Gateway
* Transaction ID
* Amount
* Currency
* Verification status
* Raw gateway reference
* Payment time

### Ticket

* Order
* Event
* Ticket type
* Owner
* Ticket number
* QR identity
* Status
* Check-in information

### Ticket transfer

* Ticket
* Sender
* Recipient email
* Recipient user
* Status
* Expiry time
* Acceptance time

### Check-in

* Ticket
* Event
* Scanned by
* Check-in method
* Timestamp
* Device information

### Refund

* Order
* Ticket
* Requested amount
* Approved amount
* Reason
* Status
* Gateway refund ID
* Decision information

### Dispute

* Attendee
* Organizer
* Event
* Order
* Reason
* Evidence
* Status
* Admin decision

### Payout

* Organizer
* Event
* Gross revenue
* Deductions
* Net amount
* Status
* Payment reference

### Review

* Attendee
* Event
* Organizer
* Rating
* Comment
* Images
* Moderation status

### Notification

* Recipient
* Type
* Title
* Message
* Related resource
* Read status

### Audit log

* Actor
* Action
* Target
* Previous value
* New value
* Metadata
* Timestamp

---

## 31. Recommended technical implementation

A suitable full-stack implementation may use:

### Frontend

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* TanStack Query
* React Hook Form
* Zod
* Recharts
* Socket.IO client

### Backend

* Node.js
* Express.js or NestJS
* TypeScript
* PostgreSQL
* Prisma ORM
* Redis
* Socket.IO
* Background job queues

### Authentication and security

* Access and refresh tokens
* Google OAuth
* HTTP-only cookies
* bcrypt or Argon2
* Role-based authorization
* Rate limiting
* Email OTP

### Infrastructure and integrations

* Stripe or SSLCommerz
* Cloudinary or Amazon S3
* Redis-based inventory reservations
* BullMQ for scheduled jobs
* Nodemailer or Resend
* QR-code generation
* PDF invoice and ticket generation
* Docker
* GitHub Actions
* Vercel or AWS deployment

---

## 32. Recruiter-focused technical highlights

The project should demonstrate:

* Multi-role authentication and authorization
* Organizer and event approval workflows
* Complex event and ticket lifecycles
* Concurrency-safe ticket inventory
* Temporary checkout reservations
* Idempotent payment verification
* QR-based ticket validation
* Real-time check-in statistics
* Ticket-transfer workflows
* Refund and dispute management
* Escrow-style organizer payouts
* Scheduled background jobs
* PDF ticket and invoice generation
* Email and in-app notifications
* Analytics dashboards
* Audit logging
* Secure file uploads
* Location-based event discovery
* Production-grade error handling

These features make EventFlow more than a basic CRUD application. It demonstrates payment processing, transaction safety, concurrency control, role-based systems, real-time communication, background processing, analytics, security, and complex business-rule implementation.
