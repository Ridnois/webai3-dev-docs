"use client";

import { Suspense, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useSearchParams } from "next/navigation";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Shield,
  ShieldOff,
  Wallet,
} from "lucide-react";
import { defaultChain } from "@/lib/wagmi";

type Step = "connect" | "sign" | "done";

/* ─── Ambient background ─────────────────────────────────────────────── */
function Ambiance() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-[var(--foreground)]/[0.05] blur-[130px]" />
      <div className="absolute -bottom-40 -right-40 size-[420px] rounded-full bg-[var(--muted-foreground)]/[0.07] blur-[110px]" />
    </div>
  );
}

/* ─── Step dots ──────────────────────────────────────────────────────── */
const STEPS: { key: Step; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "sign", label: "Sign" },
  { key: "done", label: "Access" },
];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const isComplete = i < idx;
        const isActive = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 transition-colors duration-500 ${
                  isComplete ? "bg-[var(--foreground)]" : "bg-[var(--border)]"
                }`}
              />
            )}
            <div
              className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                isComplete
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : isActive
                  ? "border-2 border-[var(--foreground)] text-[var(--foreground)]"
                  : "border border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              {isComplete ? <CheckCircle2 size={14} /> : i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Card shell ─────────────────────────────────────────────────────── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-[var(--border)]/80 bg-[var(--card)] overflow-hidden shadow-xl shadow-black/20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(1_0_0/0.06),transparent_60%),radial-gradient(ellipse_at_bottom_right,oklch(0.5_0_0/0.06),transparent_60%)]" />
      <div className="relative p-7 sm:p-8">{children}</div>
    </div>
  );
}

/* ─── Step icon ──────────────────────────────────────────────────────── */
function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-[var(--border)]/60 bg-[var(--foreground)]/[0.06]">
      {children}
    </div>
  );
}

/* ─── Error banner ───────────────────────────────────────────────────── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3">
      <p className="text-xs text-red-400 leading-relaxed">{message}</p>
    </div>
  );
}

/* ─── Unauthorized full-screen ───────────────────────────────────────── */
function UnauthorizedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <Ambiance />
      <div className="relative w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
          <ShieldOff size={30} className="text-red-400" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Access denied
        </h1>
        <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
          This wallet is not on the authorized list. Contact an admin to get added.
        </p>

        <div className="my-6 border-t border-[var(--border)]" />

        <div className="text-left rounded-xl border border-[var(--border)]/80 bg-[var(--muted)]/60 px-5 py-4 space-y-2.5">
          {[
            "Make sure you connected the right wallet",
            "Ask a team admin to whitelist your address",
            "Check that ALLOWED_ADDRESSES includes your address",
          ].map((tip) => (
            <div key={tip} className="flex items-start gap-2.5">
              <div className="mt-1.5 size-1.5 rounded-full bg-[var(--muted-foreground)] shrink-0" />
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]/40 hover:bg-[var(--muted)]"
        >
          Try a different wallet
        </button>

        <p className="mt-6 text-[11px] font-mono text-[var(--muted-foreground)]/60">
          WebAI3 Dev Docs · Internal only
        </p>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function safeRedirect(from: string): string {
  // Prevent open redirect and auth→auth loops
  if (!from || from === "/" || from.startsWith("/auth")) return "/";
  return from;
}

/* ─── Main auth content ──────────────────────────────────────────────── */
function AuthContent() {
  const searchParams = useSearchParams();
  const from = safeRedirect(searchParams.get("from") ?? "/");
  const authError = searchParams.get("error");

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("connect");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(authError === "unauthorized");

  useEffect(() => { setMounted(true); }, []);

  // Sync wallet connection state → step (wagmi manages its own reconnect)
  useEffect(() => {
    if (isConnected && address && step === "connect") setStep("sign");
    if (!isConnected && step === "sign") { setStep("connect"); setError(null); }
  }, [isConnected, address, step]);

  function handleRetry() {
    disconnect();
    setUnauthorized(false);
    setError(null);
    setStep("connect");
  }

  function handleConnect(connector: (typeof connectors)[number]) {
    setError(null);
    connect(
      { connector, chainId: defaultChain.id },
      {
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Connection failed";
          setError(
            msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")
              ? "Connection rejected. Please try again."
              : msg
          );
        },
      }
    );
  }

  async function handleSign() {
    if (!address) return;
    setSigning(true);
    setError(null);

    try {
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to WebAI3 internal developer documentation.",
        uri: window.location.origin,
        version: "1",
        chainId: defaultChain.id,
        nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
        issuedAt: new Date().toISOString(),
      });

      const messageToSign = message.prepareMessage();
      const signature = await signMessageAsync({ message: messageToSign });

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSign, signature }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          disconnect();
          setUnauthorized(true);
          return;
        }
        setError(data.error ?? "Verification failed");
        return;
      }

      setStep("done");
      // Hard navigate: ensures the browser picks up the new session cookie
      // and the proxy sees a fresh request — avoids router cache conflicts.
      setTimeout(() => {
        window.location.replace(from);
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signature rejected";
      setError(
        msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")
          ? "Signature rejected. Please try again."
          : msg
      );
    } finally {
      setSigning(false);
    }
  }

  if (unauthorized) return <UnauthorizedScreen onRetry={handleRetry} />;

  return (
    <div className="relative min-h-dvh flex flex-col bg-[var(--background)]">
      <Ambiance />

      {/* Header */}
      <header className="relative z-10 border-b border-[var(--border)]/60 bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="flex h-14 items-center px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded-md bg-[var(--foreground)]">
              <Lock size={12} className="text-[var(--background)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--foreground)]">WebAI3</span>
            <span className="text-[0.6rem] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] tracking-wider uppercase">
              Dev Docs
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">
          <StepDots current={step} />

          <Card>
            {/* Connect step */}
            {step === "connect" && (
              <div>
                <StepIcon><Wallet size={20} className="text-[var(--foreground)]/80" /></StepIcon>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                  Connect your wallet
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  Connect a wallet to verify your identity and access the internal documentation.
                </p>

                <div className="mt-6 grid gap-2">
                  {!mounted ? (
                    <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
                  ) : connectors.length === 0 ? (
                    <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--muted)]/50 px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                      No wallet detected. Install MetaMask or another browser wallet.
                    </p>
                  ) : (
                    connectors.map((connector) => (
                      <button
                        key={connector.uid}
                        type="button"
                        disabled={isConnecting}
                        onClick={() => handleConnect(connector)}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border)]/80 bg-[var(--background)]/60 px-4 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]/40 hover:bg-[var(--foreground)]/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isConnecting
                          ? <Loader2 size={15} className="animate-spin text-[var(--muted-foreground)]" />
                          : <Wallet size={15} className="text-[var(--muted-foreground)]" />
                        }
                        Connect with {connector.name}
                      </button>
                    ))
                  )}
                </div>

                {error && <ErrorBanner message={error} />}

                <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                  <Shield size={11} />
                  <span>No funds are moved during sign-in</span>
                </div>
              </div>
            )}

            {/* Sign step */}
            {step === "sign" && (
              <div>
                <StepIcon><Shield size={20} className="text-[var(--foreground)]/80" /></StepIcon>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                  Verify identity
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  Sign a message to prove wallet ownership. Free signature — no transaction, no gas.
                </p>

                <div className="mt-5 rounded-xl border border-[var(--border)]/60 bg-[var(--foreground)]/[0.04] px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--muted-foreground)]">
                    Signing as
                  </p>
                  <p className="mt-1 font-mono text-sm text-[var(--foreground)]">
                    {address ? `${address.slice(0, 10)}…${address.slice(-8)}` : ""}
                  </p>
                </div>

                {error && <ErrorBanner message={error} />}

                <button
                  type="button"
                  onClick={handleSign}
                  disabled={signing}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-5 py-3.5 text-sm font-semibold text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {signing ? (
                    <><Loader2 size={15} className="animate-spin" /> Waiting for signature…</>
                  ) : (
                    <>Sign in with Ethereum <ArrowRight size={15} /></>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { disconnect(); setStep("connect"); setError(null); }}
                  className="mt-3 w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-1"
                >
                  Use a different wallet
                </button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                  <Shield size={11} />
                  <span>EIP-4361 (SIWE) — read-only, no gas cost</span>
                </div>
              </div>
            )}

            {/* Done step */}
            {step === "done" && (
              <div className="text-center py-4">
                <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--foreground)]/10 border border-[var(--foreground)]/15">
                  <CheckCircle2 size={26} className="text-[var(--foreground)]" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                  Access granted
                </h1>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Redirecting you to the docs…
                </p>
                <div className="mt-5">
                  <Loader2 size={18} className="mx-auto animate-spin text-[var(--muted-foreground)]" />
                </div>
              </div>
            )}
          </Card>

          <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]/60 font-mono">
            Internal use only · Authorized wallets only
          </p>
        </div>
      </main>
    </div>
  );
}

const queryClient = new QueryClient();

export default function AuthPage() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Suspense>
          <AuthContent />
        </Suspense>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
