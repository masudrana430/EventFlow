# EventFlow API Testing

Import both files from `docs/postman/` into Postman.

## Recommended test sequence

1. Start PostgreSQL, Redis and EventFlow.
2. Login as seeded Admin and Super Admin.
3. Register an attendee, read the OTP email, set `attendeeOtp`, then verify.
4. Apply as Organizer with a real verification document, read the OTP email, set `organizerOtp`, then verify.
5. Admin lists organizer applications and approves the new organizer.
6. Organizer logs in, Admin creates a category, Organizer creates a draft event.
7. Upload the event cover, create at least one ticket type, submit for review, approve it as Admin, then publish.
8. Attendee starts checkout. Open the returned `paymentUrl` in a browser and complete UddoktaPay sandbox payment.
9. Verify the resulting order, payment and tickets. Test PDF download and check-in with assigned staff.
10. Use disposable records for refund, transfer, cancellation, dispute and payout tests.

## Important

- Never treat the frontend payment redirect as proof of payment. EventFlow calls UddoktaPay verify-payment on the backend.
- The repository does not invent an undocumented UddoktaPay refund endpoint. Refund records move to PROCESSING and an Admin records the real gateway refund reference after the refund is completed through the supported gateway process.
- Organizer and attendee OTPs require Redis and transactional email.
- File requests require selecting a local file in Postman after importing the collection.
- Event dates in the included sample bodies are examples; update them if they are no longer in the future.
- For Render, duplicate the environment and change `baseUrl` to `https://YOUR-SERVICE.onrender.com/api/v1`.
