import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth.schema";

describe("authentication form schemas", () => {
  it("accepts valid login credentials", () => {
    expect(
      loginSchema.parse({ email: "member@example.com", password: "password123" }),
    ).toEqual({ email: "member@example.com", password: "password123" });
  });

  it.each([
    [{ email: "not-an-email", password: "password123" }, "Invalid email address"],
    [{ email: "member@example.com", password: "short" }, "Password must be at least 8 characters"],
  ])("rejects invalid login input", (input, message) => {
    expect(loginSchema.safeParse(input)).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ message })] },
    });
  });

  it("accepts registration with matching password confirmation", () => {
    expect(
      registerSchema.parse({
        name: "Asha Perera",
        email: "asha@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
    ).toMatchObject({ name: "Asha Perera", email: "asha@example.com" });
  });

  it.each([
    [{ name: "Asha Perera", email: "asha@example.com", password: "short", confirmPassword: "short" }, "Password must be at least 8 characters"],
    [{ name: "Asha Perera", email: "asha@example.com", password: "p".repeat(129), confirmPassword: "p".repeat(129) }, "Password must be at most 128 characters"],
  ])("rejects out-of-range registration passwords", (input, message) => {
    expect(registerSchema.safeParse(input)).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ message })] },
    });
  });

  it("rejects an invalid name, email, and password mismatch", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "invalid",
      password: "password123",
      confirmPassword: "different-password",
    });

    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["name"] }),
          expect.objectContaining({ path: ["email"] }),
          expect.objectContaining({
            path: ["confirmPassword"],
            message: "Passwords do not match",
          }),
        ]),
      );
    }
  });
});
