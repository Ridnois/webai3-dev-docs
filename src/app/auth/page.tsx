"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import { Lock, Wallet, ArrowRight, Loader2, Shield, ShieldOff } from "lucide-react";
import { defaultChain } from "@/lib/wagmi";

type Step = "connect" | "sign";

function UnauthorizedView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--background)] px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-red-500/5 blur-[120px]" />
      </div>

      <div className="relative flex flex-col items-center text-center max-w-sm">
        {/* Icon */}
        <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-2xl border border-red-500/20 bg-red-500/10">
          <ShieldOff size={28} className="text-red-400" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Access denied
        </h1>
        <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
          This wallet is not on the authorized list. If you believe this is a mistake, ask an admin to add your address.
        </p>

        {/* Address hint */}
        <div className="mt-6 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-left">
          <p className="text-[10px] uppercase tracking-widest font-mono text-[var(--muted-foreground)]">
            Attempted with
          </p>
          <p className="mt-1 font-mono text-sm text-[var(--foreground)] break-all">
            {typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("address") ?? "unknown"
              : "unknown"}
          </p>
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]/40 hover:bg-[var(--muted)]"
        >
          Try a different wallet
        </button>

        <p className="mt-8 text-[11px] text-[var(--muted-foreground)] font-mono">
          WebAI3 Dev Docs · Internal access only
        </p>
      </div>
    </div>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
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

  useEffect(() => {
    disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isConnected && address && step === "connect") setStep("sign");
    if (!isConnected && step !== "connect") { setStep("connect"); setError(null); }
  }, [isConnected, address, step]);

  function handleRetry() {
    setUnauthorized(false);
    setError(null);
    setStep("connect");
    // Clear the error param from the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    router.replace(url.pathname + url.search);
  }

  function handleConnect(connector: (typeof connectors)[number]) {
    setError(null);
    connect(
      { connector, chainId: defaultChain.id },
      {
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Connection failed";
          setError(msg.toLowerCase().includes("rejected") ? "Connection rejected." : msg);
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
          setUnauthorized(true);
          disconnect();
          return;
        }
        setError(data.error ?? "Verification failed");
        return;
      }

      router.push(from === "/auth" ? "/" : from);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signature rejected";
      setError(msg.toLowerCase().includes("rejected") ? "Signature rejected. Please try again." : msg);
    } finally {
      setSigning(false);
    }
  }

  if (unauthorized) {
    return <UnauthorizedView onRetry={handleRetry} />;
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--background)] px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[var(--foreground)]/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--foreground)]">
            <Lock size={20} className="text-[var(--background)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
              WebAI3 Dev Docs
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Internal access — authorized wallets only
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {(["connect", "sign"] as const).map((s, i) => {
            const idx = step === "connect" ? 0 : 1;
            const isActive = i === idx;
            const isDone = i < idx;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`h-px w-8 transition-colors ${isDone ? "bg-[var(--foreground)]" : "bg-[var(--border)]"}`} />
                )}
                <div className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                  isDone ? "bg-[var(--foreground)] text-[var(--background)]" :
                  isActive ? "border-2 border-[var(--foreground)] text-[var(--foreground)]" :
                  "border border-[var(--border)] text-[var(--muted-foreground)]"
                }`}>
                  {i + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          {step === "connect" && (
            <div>
              <div className="mb-5 flex size-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]">
                <Wallet size={18} className="text-[var(--foreground)]" />
              </div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Connect your wallet</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Connect a wallet to verify your identity.
              </p>
              <div className="mt-5 grid gap-2">
                {!mounted ? (
                  <div className="h-10 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
                ) : connectors.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] text-center py-3 border border-[var(--border)] rounded-xl">
                    No wallet detected. Install MetaMask or another wallet.
                  </p>
                ) : (
                  connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={isConnecting}
                      onClick={() => handleConnect(connector)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]/40 hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                      {connector.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {step === "sign" && (
            <div>
              <div className="mb-5 flex size-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]">
                <Shield size={18} className="text-[var(--foreground)]" />
              </div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Sign to authenticate</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Prove wallet ownership. No gas, no transaction.
              </p>
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-mono">Connected as</p>
                <p className="mt-1 font-mono text-sm text-[var(--foreground)]">
                  {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSign}
                disabled={signing}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-60"
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
                className="mt-3 w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Use a different wallet
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">
          EIP-4361 · Read-only signature · No gas cost
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}
