// Génère la paire de clés de signature des licences (ECDSA P-256).
// node scripts/generate-keys.mjs
//   → LICENSE_PRIVATE_KEY : secret du serveur (npx wrangler secret put LICENSE_PRIVATE_KEY)
//   → BILTOV_BILLING_PUBLIC_KEY : variable GitHub du site (Settings → Secrets and variables → Actions → Variables)
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const b64 = (buf) => Buffer.from(buf).toString("base64");
console.log("LICENSE_PRIVATE_KEY (secret du serveur) :\n" + b64(await crypto.subtle.exportKey("pkcs8", privateKey)) + "\n");
console.log("BILTOV_BILLING_PUBLIC_KEY (variable GitHub, publique) :\n" + b64(await crypto.subtle.exportKey("spki", publicKey)));
