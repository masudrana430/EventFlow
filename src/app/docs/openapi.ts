type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

const routeRows = `
post|/api/v1/auth/register|Auth|Register attendee and send OTP|
post|/api/v1/auth/resend-verification-otp|Auth|Resend attendee verification OTP|
post|/api/v1/auth/verify-email|Auth|Verify attendee email|
post|/api/v1/auth/login|Auth|Credential login|
get|/api/v1/auth/me|Auth|Get current user|auth
post|/api/v1/auth/refresh-token|Auth|Rotate refresh session|
post|/api/v1/auth/google|Auth|Google login for attendees|
post|/api/v1/auth/forgot-password|Auth|Send password reset OTP|
post|/api/v1/auth/reset-password|Auth|Reset password using OTP|
post|/api/v1/auth/change-password|Auth|Change password|auth
post|/api/v1/auth/set-password|Auth|Set password for Google attendee|auth
post|/api/v1/auth/logout|Auth|Logout current session|auth
post|/api/v1/auth/logout-all|Auth|Revoke all sessions|auth
patch|/api/v1/user/profile|User|Update own profile|auth
patch|/api/v1/user/profile-image|User|Upload profile image|auth,multipart
post|/api/v1/organizer/apply|Organizer|Apply as organizer|multipart
post|/api/v1/organizer/verify-email|Organizer|Verify organizer application email|
get|/api/v1/organizer/applications|Organizer|Admin list organizer applications|auth
patch|/api/v1/organizer/applications/{organizerId}/decision|Organizer|Approve or reject organizer|auth
get|/api/v1/organizer/me|Organizer|Get organizer profile|auth
patch|/api/v1/organizer/me|Organizer|Update organizer profile|auth
post|/api/v1/admin/accounts|Admin|Create administrative account|auth
get|/api/v1/admin/users|Admin|List users|auth
patch|/api/v1/admin/users/{userId}/status|Admin|Block or unblock user|auth
get|/api/v1/admin/audit-logs|Admin|View audit logs|auth
get|/api/v1/admin/settings|Admin|List platform settings|auth
put|/api/v1/admin/settings/{key}|Admin|Upsert platform setting|auth
get|/api/v1/categories/public|Category|List active categories|
get|/api/v1/categories|Category|Admin list categories|auth
post|/api/v1/categories|Category|Create category|auth
patch|/api/v1/categories/{categoryId}|Category|Update category|auth
delete|/api/v1/categories/{categoryId}|Category|Delete or disable category|auth
get|/api/v1/events/public|Event|Discover published events|
get|/api/v1/events/public/{eventIdOrSlug}|Event|Get public event details|
get|/api/v1/events/my-events|Event|Organizer event list|auth
post|/api/v1/events|Event|Create draft event|auth
patch|/api/v1/events/{eventId}|Event|Update owned event|auth
patch|/api/v1/events/{eventId}/cover|Event|Upload event cover|auth,multipart
patch|/api/v1/events/{eventId}/gallery|Event|Upload event gallery|auth,multipart
post|/api/v1/events/{eventId}/submit|Event|Submit event for review|auth
post|/api/v1/events/{eventId}/publish|Event|Publish approved event|auth
post|/api/v1/events/{eventId}/cancel|Event|Cancel event|auth
get|/api/v1/events/admin/all|Event|Admin list all events|auth
post|/api/v1/events/admin/{eventId}/review|Event|Review submitted event|auth
post|/api/v1/events/admin/{eventId}/suspend|Event|Suspend event|auth
post|/api/v1/events/admin/{eventId}/restore|Event|Restore event|auth
get|/api/v1/ticket-types/event/{eventId}/public|Ticket Type|List public ticket types|
post|/api/v1/ticket-types/event/{eventId}|Ticket Type|Create ticket type|auth
patch|/api/v1/ticket-types/{ticketTypeId}|Ticket Type|Update ticket type|auth
delete|/api/v1/ticket-types/{ticketTypeId}|Ticket Type|Delete or disable ticket type|auth
post|/api/v1/staff/accept|Staff|Accept staff invitation|
get|/api/v1/staff/my-assignments|Staff|Staff assigned events|auth
get|/api/v1/staff|Staff|Organizer list staff|auth
post|/api/v1/staff/invite|Staff|Invite event staff|auth
patch|/api/v1/staff/{staffId}/assign|Staff|Assign staff to events|auth
delete|/api/v1/staff/{staffId}|Staff|Revoke staff access|auth
post|/api/v1/promos|Promo|Create promo code|auth
get|/api/v1/promos/event/{eventId}|Promo|List event promo codes|auth
patch|/api/v1/promos/{promoId}|Promo|Update promo code|auth
post|/api/v1/orders/checkout|Order|Reserve inventory and create checkout|auth
get|/api/v1/orders/my-orders|Order|Attendee order history|auth
get|/api/v1/orders/my-orders/{orderId}|Order|Attendee order details|auth
get|/api/v1/payment/uddoktapay/callback|Payment|UddoktaPay browser callback|
get|/api/v1/payment/uddoktapay/cancel|Payment|UddoktaPay cancel callback|
post|/api/v1/payment/uddoktapay/webhook|Payment|UddoktaPay webhook with server verification|
get|/api/v1/payment/my-payments|Payment|Attendee payment history|auth
get|/api/v1/payment/all|Payment|Admin payment history|auth
get|/api/v1/tickets/my-tickets|Ticket|Attendee digital tickets|auth
get|/api/v1/tickets/my-tickets/{ticketId}|Ticket|Get digital ticket|auth
get|/api/v1/tickets/my-tickets/{ticketId}/pdf|Ticket|Download PDF ticket|auth
post|/api/v1/tickets/check-in/qr|Ticket|QR check-in|auth
get|/api/v1/tickets/check-in/event/{eventId}/search|Ticket|Manual ticket search|auth
post|/api/v1/tickets/check-in/manual|Ticket|Manual ticket check-in|auth
post|/api/v1/refunds|Refund|Request ticket refund|auth
get|/api/v1/refunds/organizer|Refund|Organizer refund queue|auth
get|/api/v1/refunds/all|Refund|Admin refund queue|auth
patch|/api/v1/refunds/{refundId}/decision|Refund|Approve or reject refund|auth
patch|/api/v1/refunds/{refundId}/complete|Refund|Record completed gateway refund|auth
post|/api/v1/transfers|Transfer|Create ticket transfer|auth
post|/api/v1/transfers/accept|Transfer|Accept ticket transfer|auth
get|/api/v1/transfers/mine|Transfer|My ticket transfers|auth
post|/api/v1/waitlist|Waitlist|Join sold-out waitlist|auth
delete|/api/v1/waitlist/{ticketTypeId}|Waitlist|Leave waitlist|auth
get|/api/v1/waitlist/mine|Waitlist|My waitlist entries|auth
get|/api/v1/notifications|Notification|My notifications|auth
patch|/api/v1/notifications/read-all|Notification|Mark all notifications read|auth
patch|/api/v1/notifications/{notificationId}/read|Notification|Mark notification read|auth
post|/api/v1/announcements|Announcement|Send announcement to ticket holders|auth
get|/api/v1/announcements/event/{eventId}|Announcement|List event announcements|auth
post|/api/v1/reviews|Review|Review completed event|auth
get|/api/v1/reviews/event/{eventId}|Review|Public event reviews|
patch|/api/v1/reviews/{reviewId}/moderate|Review|Moderate review|auth
post|/api/v1/disputes|Dispute|Open dispute|auth
get|/api/v1/disputes/mine|Dispute|My disputes|auth
get|/api/v1/disputes/organizer|Dispute|Organizer dispute queue|auth
post|/api/v1/disputes/{disputeId}/respond|Dispute|Organizer respond to dispute|auth
get|/api/v1/disputes/admin/all|Dispute|Admin dispute queue|auth
patch|/api/v1/disputes/admin/{disputeId}/decision|Dispute|Admin resolve dispute|auth
post|/api/v1/payouts/event/{eventId}/request|Payout|Request eligible payout|auth
get|/api/v1/payouts/mine|Payout|Organizer payout history|auth
get|/api/v1/payouts/all|Payout|Admin payout queue|auth
patch|/api/v1/payouts/{payoutId}/status|Payout|Update payout status|auth
get|/api/v1/analytics/attendee|Analytics|Attendee analytics|auth
get|/api/v1/analytics/organizer|Analytics|Organizer analytics|auth
get|/api/v1/analytics/staff|Analytics|Staff analytics|auth
get|/api/v1/analytics/admin|Analytics|Admin analytics|auth
`.trim();

const rows = routeRows.split("\n").map((row) => {
  const [method, path, tag, summary, flags = ""] = row.split("|");
  return {
    method: method as HttpMethod,
    path,
    tag,
    summary,
    auth: flags.includes("auth"),
    multipart: flags.includes("multipart"),
  };
});

const paths: Record<string, Record<string, unknown>> = {};

for (const route of rows) {
  const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));

  paths[route.path] ??= {};
  paths[route.path][route.method] = {
    tags: [route.tag],
    summary: route.summary,
    ...(route.auth ? { security: [{ bearerAuth: [] }, { cookieAuth: [] }] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(["post", "patch", "put"].includes(route.method)
      ? {
          requestBody: {
            required: true,
            content: route.multipart
              ? {
                  "multipart/form-data": {
                    schema: { type: "object", additionalProperties: true },
                  },
                }
              : {
                  "application/json": {
                    schema: { type: "object", additionalProperties: true },
                  },
                },
          },
        }
      : {}),
    responses: {
      "200": { description: "Success" },
      "201": { description: "Created" },
      "400": { description: "Bad request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };
}

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "EventFlow API",
    version: "2.1.0",
    description:
      "Complete EventFlow backend API reference covering authentication, organizer approval, event moderation, inventory-safe ticketing, UddoktaPay checkout/verification, digital tickets, check-in, refunds, transfers, waitlists, staff, disputes, payouts, notifications and analytics. Protected endpoints accept either an HTTP-only accessToken cookie or a Bearer JWT.",
  },
  servers: [
    { url: "/", description: "Current host" },
    { url: "https://eventflow-ln9q.onrender.com", description: "EventFlow production (Render)" },
    { url: "http://localhost:5000", description: "Local development" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the access token returned by login/verification.",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "accessToken",
        description: "HTTP-only access-token cookie used by browser clients.",
      },
    },
  },
  tags: [...new Set(rows.map((route) => route.tag))].map((name) => ({ name })),
  paths,
};
