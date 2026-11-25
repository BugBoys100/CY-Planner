/** Protection optionnelle par mot de passe (APP_PASSWORD). Compatible Edge (middleware). */
export const AUTH_COOKIE = "cyp_auth";

export async function authToken(password: string) {
  const data = new TextEncoder().encode(`cytech-planner:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
