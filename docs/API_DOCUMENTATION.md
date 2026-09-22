# EventFlow API Documentation

EventFlow exposes interactive Swagger/OpenAPI documentation and a complete Postman collection.

## Deployed API

- Backend: https://eventflow-ln9q.onrender.com
- Swagger UI: https://eventflow-ln9q.onrender.com/api-docs
- OpenAPI JSON: https://eventflow-ln9q.onrender.com/api-docs.json
- API base URL: https://eventflow-ln9q.onrender.com/api/v1

## Postman

Import the collection plus one environment from `docs/postman/`:

- `EventFlow.postman_collection.json`
- `EventFlow.production.postman_environment.json` for Render
- `EventFlow.local.postman_environment.json` for local development

The collection covers every mounted EventFlow API route. It also contains helper requests for health/docs and duplicate workflow requests where useful for testing state transitions.

## Recommended end-to-end sequence

1. Start PostgreSQL, Redis and EventFlow, or select the Production Postman environment.
2. Login as the seeded Admin and Super Admin.
3. Register an attendee, read the OTP email, set `attendeeOtp`, then verify.
4. Apply as Organizer with a real verification document, read the OTP email, set `organizerOtp`, then verify.
5. Admin lists organizer applications and approves the organizer.
6. Organizer logs in; Admin creates a category; Organizer creates a draft event.
7. Upload the event cover, create ticket types, submit for review, approve as Admin, then publish.
8. Attendee starts checkout. Open the returned `paymentUrl` and complete checkout on UddoktaPay.
9. Verify the resulting order, payment and tickets. Test PDF download and QR/manual check-in.
10. Use disposable records for refund, transfer, cancellation, dispute, payout, delete and moderation tests.

## Automated verification

GitHub Actions runs:

- Prisma client generation
- API contract verification: mounted Express routes vs OpenAPI vs Postman
- TypeScript build
- Prisma migrations from an empty PostgreSQL database
- Runtime smoke tests with PostgreSQL + Redis, including public endpoints and seeded Admin authentication

Run the contract check locally with:

```bash
npm run verify:api-contract
```

## Important payment rules

- Never treat the frontend redirect as proof of payment.
- EventFlow verifies the UddoktaPay invoice server-side before marking an order paid.
- Duplicate callbacks/webhooks are handled idempotently.
- Use a real UddoktaPay invoice for callback/webhook testing; do not fabricate a successful transaction.
- Refund records currently move through the EventFlow refund workflow; do not invent an unsupported gateway refund result.

## Notes

- Organizer and attendee OTP flows require Redis and transactional email.
- Multipart requests require selecting local files in Postman.
- Sample event dates in request bodies must remain in the future.
- The Production environment points to `https://eventflow-ln9q.onrender.com/api/v1`.
