import { z } from "zod";
import { VALIDATION_SETTINGS } from "@/lib/settings";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(VALIDATION_SETTINGS.password.min, `Password must be at least ${VALIDATION_SETTINGS.password.min} characters`),
});

export const registerSchema = z.object({
  name: z.string().trim().min(VALIDATION_SETTINGS.name.min, `Name must be at least ${VALIDATION_SETTINGS.name.min} characters`).max(VALIDATION_SETTINGS.name.max),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(VALIDATION_SETTINGS.password.min, `Password must be at least ${VALIDATION_SETTINGS.password.min} characters`).max(VALIDATION_SETTINGS.password.max, `Password must be at most ${VALIDATION_SETTINGS.password.max} characters`),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
