export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "EventFlow API",
    version: "1.0.0",
    description:
      "OpenAPI documentation for the EventFlow backend. The current API covers attendee authentication, Google login, password recovery, authenticated profile access, and profile-image upload. Extend this specification as new EventFlow modules are added.",
  },
  servers: [
    {
      url: "/",
      description: "Current host",
    },
    {
      url: "http://localhost:5000",
      description: "Local development",
    },
  ],
  tags: [
    {
      name: "System",
      description: "Service health endpoints",
    },
    {
      name: "Auth",
      description: "Authentication and attendee account endpoints",
    },
    {
      name: "User",
      description: "Authenticated user profile endpoints",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Pass the access token returned by login or email verification.",
      },
      accessTokenCookie: {
        type: "apiKey",
        in: "cookie",
        name: "accessToken",
        description: "HTTP-only access-token cookie set by EventFlow.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          statusCode: { type: "integer", example: 400 },
          name: { type: "string", example: "Bad Request" },
          message: { type: "string", example: "Validation failed" },
        },
      },
      AttendeeRegistrationRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: {
            type: "string",
            minLength: 3,
            maxLength: 100,
            example: "Masud Rana",
          },
          email: {
            type: "string",
            format: "email",
            example: "attendee@example.com",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "Attendee@123",
            description:
              "Must contain uppercase, lowercase, number, and special character.",
          },
          attendee: {
            type: "object",
            properties: {
              phone: { type: "string", example: "01700000000" },
              location: { type: "string", example: "Chattogram" },
            },
          },
        },
      },
      VerifyEmailRequest: {
        type: "object",
        required: ["email", "otp"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "attendee@example.com",
          },
          otp: {
            type: "string",
            pattern: "^[0-9]{6}$",
            example: "123456",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "attendee@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "Attendee@123",
          },
        },
      },
      GoogleLoginRequest: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: {
            type: "string",
            description: "Google ID token issued for the configured Google client ID.",
            example: "eyJhbGciOiJSUzI1NiIs...",
          },
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "attendee@example.com",
          },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["email", "newPassword", "otp"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "attendee@example.com",
          },
          newPassword: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "NewPassword@123",
          },
          otp: {
            type: "string",
            example: "123456",
            minLength: 6,
            maxLength: 6,
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "cm123example" },
          name: { type: "string", example: "Masud Rana" },
          email: {
            type: "string",
            format: "email",
            example: "attendee@example.com",
          },
          role: {
            type: "string",
            enum: [
              "SUPER_ADMIN",
              "ADMIN",
              "ORGANIZER",
              "EVENT_STAFF",
              "ATTENDEE",
            ],
            example: "ATTENDEE",
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "BLOCKED"],
            example: "ACTIVE",
          },
          isEmailVerified: { type: "boolean", example: true },
          mustChangePassword: { type: "boolean", example: false },
          imageUrl: { type: "string", example: "https://res.cloudinary.com/..." },
          imagePublicId: { type: "string", example: "eventflow/profile/example" },
        },
      },
      Attendee: {
        type: "object",
        properties: {
          id: { type: "string", example: "cm123attendee" },
          userId: { type: "string", example: "cm123example" },
          phone: { type: "string", nullable: true, example: "01700000000" },
          profileImage: { type: "string", nullable: true },
          location: { type: "string", nullable: true, example: "Chattogram" },
        },
      },
      AuthData: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
          attendee: { $ref: "#/components/schemas/Attendee" },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          statusCode: { type: "integer", example: 200 },
          message: { type: "string", example: "Operation successful" },
          data: { nullable: true },
        },
      },
    },
  },
  paths: {
    "/": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          "200": {
            description: "EventFlow backend is running",
            content: {
              "application/json": {
                example: {
                  success: true,
                  message: "Welcome to EventFlow Backend",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register an attendee and send verification OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AttendeeRegistrationRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Verification OTP sent",
            content: {
              "application/json": {
                example: {
                  success: true,
                  statusCode: 201,
                  message: "Verification OTP Sent",
                  data: null,
                },
              },
            },
          },
          "400": {
            description: "Validation failure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify attendee email and create the attendee account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyEmailRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Email verified and authentication tokens issued",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/AuthData" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": {
            description: "Invalid or expired OTP",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        description:
          "Attendees, approved organizers, accepted event staff, admins, and super admins can use this endpoint according to EventFlow role rules.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful; access and refresh cookies are also set",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/AuthData" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials or account is not allowed to login",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current authenticated user",
        security: [{ bearerAuth: [] }, { accessTokenCookie: [] }],
        responses: {
          "200": {
            description: "Authenticated user profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Role is not allowed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/refresh-token": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access and refresh tokens",
        description:
          "Requires the HTTP-only refreshToken cookie. Postman automatically keeps the cookie after login when the cookie jar is enabled.",
        responses: {
          "200": {
            description: "New authentication cookies issued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "401": {
            description: "Missing or invalid refresh token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Login/register an attendee with Google",
        description: "Google authentication is available only to ATTENDEE accounts.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GoogleLoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Google authentication successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid Google token or unsupported account role",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a password-reset OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForgotPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Reset OTP sent",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password using an OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Password reset successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid OTP or password validation failure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/user/profile-image": {
      patch: {
        tags: ["User"],
        summary: "Upload or replace the current user's profile image",
        security: [{ bearerAuth: [] }, { accessTokenCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["profileImage"],
                properties: {
                  profileImage: {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile image uploaded successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "400": {
            description: "No file uploaded or upload failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
} as const;
