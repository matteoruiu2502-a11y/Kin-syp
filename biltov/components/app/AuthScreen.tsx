"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Mail } from "lucide-react";
import { AuthError, logIn, signUp } from "@/lib/app/auth";
import { useApp } from "@/lib/app/store";
import { cn } from "@/lib/utils";
import { BiltovLogo } from "../BiltovLogo";
import { Field, Notice, inputClass } from "./ui";

const MESSAGES: Record<AuthError["code"], string> = {
  exists: "Un compte existe déjà avec cet e-mail sur cet appareil. Connectez-vous.",
  invalid: "E-mail ou mot de passe incorrect.",
  weak: "Le mot de passe doit contenir au moins 8 caractères.",
};

/** Création de compte obligatoire avant tout accès à l'espace artisan. */
export function AuthScreen() {
  const { signedIn } = useApp();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup") {
      if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
      if (!terms) return setError("Vous devez accepter les conditions d'utilisation.");
    }
    setBusy(true);
    try {
      const account = mode === "signup" ? await signUp(email, password) : await logIn(email, password);
      await signedIn(account);
    } catch (err) {
      setError(err instanceof AuthError ? MESSAGES[err.code] : "Une erreur est survenue. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="pointer-events-none fixed left-1/2 top-1/3 -z-10 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue/20 to-emerald/15 blur-[140px]" aria-hidden />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="Biltov">
            <BiltovLogo size={34} />
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
        </div>

        <div className="card glow-border p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.02] p-1">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn("rounded-lg py-2 text-sm font-semibold transition-colors", mode === m ? "bg-gradient-to-r from-blue to-emerald text-white" : "text-slate-400 hover:text-white")}
              >
                {m === "signup" ? "Créer un compte" : "Se connecter"}
              </button>
            ))}
          </div>

          <h1 className="font-display text-2xl font-bold text-white">{mode === "signup" ? "Créez votre espace Biltov" : "Bon retour sur Biltov"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === "signup" ? "Un compte est nécessaire pour créer vos chantiers, devis et factures." : "Connectez-vous pour retrouver vos chantiers."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="E-mail">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className={cn(inputClass, "pl-9")} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </Field>
            <Field label="Mot de passe" hint={mode === "signup" ? "8 caractères minimum" : undefined}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className={cn(inputClass, "pl-9")} type="password" required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </Field>
            {mode === "signup" && (
              <>
                <Field label="Confirmer le mot de passe">
                  <input className={inputClass} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
                <label className="flex items-start gap-2.5 text-xs text-slate-400">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                  <span>J&apos;accepte les conditions générales d&apos;utilisation et la politique de confidentialité de Biltov.</span>
                </label>
              </>
            )}
            {error && <Notice tone="warn">{error}</Notice>}
            <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">Votre compte et vos données sont enregistrés sur cet appareil. Mot de passe chiffré (PBKDF2).</p>
        </div>
      </motion.div>
    </div>
  );
}
