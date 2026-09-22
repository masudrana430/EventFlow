import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

const createToken = (
  payload: JwtPayload,
  secret: string,
  expiresIn: SignOptions["expiresIn"],
) =>
  jwt.sign(payload, secret, {
    expiresIn,
  });

const verifyToken = (token: string, secret: string) => {
  try {
    return {
      success: true as const,
      data: jwt.verify(token, secret),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Token verification failed",
    };
  }
};

export const jwtUtils = {
  createToken,
  verifyToken,
};
