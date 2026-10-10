"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Mail, PlayCircle } from "lucide-react";
import { AuthError, RECOVERY_PARAM, enterDemo, logIn, requestPasswordReset, signUp, updatePassword } from "@/lib/app/auth";
import { supabaseConfigured } from "@/utils/supabase/client";
import { useApp } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { cn } from "@/lib/utils";
import { BiltovLogo } from "../BiltovLogo";
import { Field, Notice, inputClass } from "./ui";

const MESSAGES: Record<AuthError["code"], string> = {
  exists: supabaseConfigured ? "Un compte existe déjà avec cet e-mail. Connectez-vous." : "Un compte existe déjà avec cet e-mail sur cet appareil. Connectez-vous.",
  invalid: "E-mail ou mot de passe incorrect.",
  weak: "Le mot de passe doit contenir au moins 8 caractères.",
  confirm: "Compte créé. Ouvrez le lien reçu par e-mail pour confirmer votre adresse, puis connectez-vous.",
  unconfirmed: "Adresse e-mail pas encore confirmée : ouvrez le lien reçu par e-mail, puis reconnectez-vous.",
  network: "Connexion impossible. Vérifiez votre accès à Internet et réessayez.",
  rate: "Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez.",
  same: "Le nouveau mot de passe doit être différent de l'ancien.",
};

/** Retire le paramètre du lien « mot de passe oublié » de l'adresse. */
export function clearRecoveryParam() {
  const u = new URL(window.location.href);
  if (!u.searchParams.has(RECOVERY_PARAM)) return;
  u.searchParams.delete(RECOVERY_PARAM);
  window.history.replaceState(null, "", u.pathname + u.search + u.hash);
}

/** Création de compte obligatoire avant tout accès à l'espace artisan. */
export function AuthScreen() {
  const { signedIn } = useApp();
  const { t } = useTr();
  const [mode, setMode] = useState<"signup" | "login" | "forgot">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const demo = async () => {
    setBusy(true);
    await signedIn(enterDemo());
    setBusy(false);
  };

  // Lien « mot de passe oublié » ouvert sans session : expiré, déjà utilisé ou ouvert sur un autre appareil
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(RECOVERY_PARAM)) {
      clearRecoveryParam();
      setMode("login");
      setError(t("Ce lien de réinitialisation a expiré ou a été ouvert sur un autre appareil. Redemandez un lien depuis cet appareil."));
    }
  }, []);

  // Lien direct « …/tableau-de-bord/#demo » depuis la page d'accueil
  useEffect(() => {
    if (window.location.hash === "#demo") {
      window.history.replaceState(null, "", window.location.pathname);
      void demo();
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "signup") {
      if (password !== confirm) return setError(t("Les deux mots de passe ne correspondent pas."));
      if (!terms) return setError(t("Vous devez accepter les conditions d'utilisation."));
    }
    setBusy(true);
    if (mode === "forgot") {
      try {
        await requestPasswordReset(email);
        setInfo(t("Si un compte existe avec cet e-mail, vous allez recevoir un lien pour choisir un nouveau mot de passe. Ouvrez-le sur cet appareil."));
      } catch (err) {
        setError(err instanceof AuthError ? t(MESSAGES[err.code]) : t("Une erreur est survenue. Réessayez."));
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const account = mode === "signup" ? await signUp(email, password) : await logIn(email, password);
      await signedIn(account);
    } catch (err) {
      if (err instanceof AuthError && err.code === "confirm") {
        setMode("login");
        setPassword("");
        setConfirm("");
        return setInfo(t(MESSAGES.confirm));
      }
      setError(err instanceof AuthError ? t(MESSAGES[err.code]) : t("Une erreur est survenue. Réessayez."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="Biltov">
            <BiltovLogo size={34} />
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t("Retour au site")}
          </Link>
        </div>

        <button
          type="button"
          onClick={demo}
          disabled={busy}
          className="mb-4 flex w-full items-center gap-4 rounded-2xl border border-emerald/40 bg-blue/10 p-4 text-left transition-colors hover:border-emerald disabled:opacity-60"
        >
          <PlayCircle className="h-9 w-9 shrink-0 text-emerald" />
          <span>
            <span className="block font-display text-lg font-bold text-white">{t("Découvrir sans compte")}</span>
            <span className="block text-sm text-slate-300">{t("Espace de démonstration déjà rempli : chantiers, devis, factures, catalogue, planning. Aucun numéro d'entreprise demandé.")}</span>
          </span>
        </button>

        <div className="card glow-border p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.02] p-1">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                className={cn("rounded-lg py-2 text-sm font-semibold transition-colors", (mode === "forgot" ? "login" : mode) === m ? "bg-blue text-white" : "text-slate-400 hover:text-white")}
              >
                {m === "signup" ? t("Créer un compte") : t("Se connecter")}
              </button>
            ))}
          </div>

          <h1 className="font-display text-2xl font-bold text-white">{mode === "signup" ? t("Créez votre espace Biltov") : mode === "forgot" ? t("Mot de passe oublié") : t("Bon retour sur Biltov")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === "signup" ? t("Un compte est nécessaire pour créer vos chantiers, devis et factures.") : mode === "forgot" ? t("Indiquez l'e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.") : t("Connectez-vous pour retrouver vos chantiers.")}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label={t("E-mail")}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className={cn(inputClass, "pl-9")} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </Field>
            {mode !== "forgot" && (
            <Field label={t("Mot de passe")} hint={mode === "signup" ? t("8 caractères minimum") : undefined}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className={cn(inputClass, "pl-9")} type="password" required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </Field>
            )}
            {mode === "login" && supabaseConfigured && (
              <button type="button" onClick={() => (setMode("forgot"), setError(null), setInfo(null))} className="-mt-2 text-xs text-cyan hover:underline">
                {t("Mot de passe oublié ?")}
              </button>
            )}
            {mode === "signup" && (
              <>
                <Field label={t("Confirmer le mot de passe")}>
                  <input className={inputClass} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
                <label className="flex items-start gap-2.5 text-xs text-slate-400">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                  <span>
                    {t("J'accepte les conditions générales d'utilisation et la politique de confidentialité de Biltov.")}{" "}
                    <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/conditions-generales/`} target="_blank" className="text-cyan hover:underline">
                      {t("Conditions générales")}
                    </a>
                    {" · "}
                    <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/confidentialite/`} target="_blank" className="text-cyan hover:underline">
                      {t("Confidentialité")}
                    </a>
                  </span>
                </label>
              </>
            )}
            {info && <Notice>{info}</Notice>}
            {error && <Notice tone="warn">{error}</Notice>}
            <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? t("Créer mon compte") : mode === "forgot" ? t("Envoyer le lien") : t("Se connecter")}
            </button>
            {mode === "forgot" && (
              <button type="button" onClick={() => (setMode("login"), setError(null), setInfo(null))} className="w-full text-center text-xs text-slate-400 hover:text-white">
                {t("Retour à la connexion")}
              </button>
            )}
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">{supabaseConfigured ? t("Vos données sont enregistrées en ligne et sur cet appareil : retrouvez-les sur votre téléphone, tablette ou ordinateur.") : t("Votre compte et vos données sont enregistrés sur cet appareil. Mot de passe chiffré (PBKDF2).")}</p>
        </div>
      </motion.div>
    </div>
  );
}

/** Retour du lien « mot de passe oublié » : la session est ouverte, l'artisan choisit son nouveau mot de passe. */
export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTr();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError(t("Les deux mots de passe ne correspondent pas."));
    setBusy(true);
    try {
      await updatePassword(password);
      clearRecoveryParam();
      onDone();
    } catch (err) {
      setError(err instanceof AuthError ? t(MESSAGES[err.code]) : t("Une erreur est survenue. Réessayez."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="w-full max-w-md">
        <div className="mb-8">
          <BiltovLogo size={34} />
        </div>
        <div className="card glow-border p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-white">{t("Choisissez un nouveau mot de passe")}</h1>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label={t("Nouveau mot de passe")} hint={t("8 caractères minimum")}>
              <input className={inputClass} type="password" required minLength={8} autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t("Confirmer le mot de passe")}>
              <input className={inputClass} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            {error && <Notice tone="warn">{error}</Notice>}
            <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Enregistrer le mot de passe")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
