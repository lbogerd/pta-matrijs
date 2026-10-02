import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { transaction } from "./db";
export const roles = ["teacher", "committee", "office", "admin"] as const;
export async function createAccount(
  name: string,
  email: string,
  password: string,
  role: string,
) {
  if (
    !roles.includes(role as any) ||
    !name?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 12
  )
    throw new Error(
      "Vul naam, geldig e-mailadres, rol en een wachtwoord van minimaal 12 tekens in.",
    );
  const id = randomUUID(),
    hashed = await hashPassword(password);
  return transaction(async (c) => {
    await c.query(
      'INSERT INTO "user" (id,name,email,"emailVerified",role) VALUES ($1,$2,$3,true,$4)',
      [id, name.trim(), email.toLowerCase().trim(), role],
    );
    await c.query(
      'INSERT INTO account (id,"accountId","providerId","userId",password) VALUES ($1,$2,\'credential\',$2,$3)',
      [randomUUID(), id, hashed],
    );
    return { id, name, email, role };
  });
}
