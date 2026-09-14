# EventFlow API documentation

This branch includes both interactive Swagger/OpenAPI documentation and an importable Postman collection for the currently implemented EventFlow endpoints.

## Swagger / OpenAPI

After installing dependencies and starting the backend:

```bash
npm install
npm run dev
```

Open:

- Swagger UI: `http://localhost:5000/api-docs`
- Raw OpenAPI JSON: `http://localhost:5000/api-docs.json`

After Render deployment, use the same paths on the deployed backend host, for example:

```text
https://YOUR-EVENTFLOW-BACKEND.onrender.com/api-docs
https://YOUR-EVENTFLOW-BACKEND.onrender.com/api-docs.json
```

The OpenAPI source is maintained in:

```text
src/app/docs/openapi.ts
```

Whenever a new route/module is implemented, add its request/response contract there so Swagger remains synchronized with the backend.

## Postman

Import these two files into Postman:

```text
docs/postman/EventFlow.postman_collection.json
docs/postman/EventFlow.local.postman_environment.json
```

Select the **EventFlow - Local** environment before running requests.

Default local API base URL:

```text
http://localhost:5000/api/v1
```

For Render, duplicate the environment in Postman and change `baseUrl` to:

```text
https://YOUR-EVENTFLOW-BACKEND.onrender.com/api/v1
```

Do not commit real passwords, OTPs, Google ID tokens, JWTs, or production secrets into the collection/environment files.

## Recommended current test order

1. `System / Health Check`
2. `Auth - Attendee / Register Attendee`
3. Read the OTP from email and set the `otp` Postman variable.
4. `Auth - Attendee / Verify Email`
5. `Auth - Attendee / Get Me`
6. `User / Upload Profile Image` (choose a local image manually)
7. `Auth - Attendee / Refresh Token`
8. `Auth - Attendee / Forgot Password`
9. Read the reset OTP and update the `otp` variable.
10. `Auth - Attendee / Reset Password`
11. Update `attendeePassword` if you want to login with the new password.
12. `Auth - Attendee / Attendee Login`
13. Optional: `Auth - Attendee / Google Login` with a real Google ID token.
14. Optional: test seeded `Admin Login` and `Super Admin Login` after filling their Postman variables.

The collection automatically saves returned attendee, Admin, and Super Admin access tokens where applicable. Postman's cookie jar also retains the HTTP-only refresh-token cookie after login/verification, which is required by `/auth/refresh-token`.

## Current documented route set

```text
GET   /
POST  /api/v1/auth/register
POST  /api/v1/auth/verify-email
POST  /api/v1/auth/login
GET   /api/v1/auth/me
POST  /api/v1/auth/refresh-token
POST  /api/v1/auth/google
POST  /api/v1/auth/forgot-password
POST  /api/v1/auth/reset-password
PATCH /api/v1/user/profile-image
```

The Postman collection and OpenAPI spec should be expanded together as Organizer, Event, Ticket, Order, UddoktaPay Payment, Check-in, Refund, Payout, Analytics, and other EventFlow modules are implemented.
