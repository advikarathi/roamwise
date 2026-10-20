// Auth.js endpoints: /api/auth/signin, /callback/<provider>, /session, /signout, /providers…
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
