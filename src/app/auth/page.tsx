"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import { Lock, Wallet, ArrowRight, Loader2, Shield, AlertCircle } from "lucide-react";
import { defaultChain } from "@/lib/wagmi";

type Step = "connect" | "sign";

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
  const [error, setError] = useState<string | null>(
    authError === "unauthorized" ? "Your address is not authorized to access this site." : null
  );

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isConnected && address && step === "connect") setStep("sign");
    if (!isConnected && step !== "connect") { setStep("connect"); setError(null); }
  }, [isConnected, address, step]);

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

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--foreground)]">
          <Lock size={22} className="text-[var(--background)]" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
            WebAI3 Dev Docs
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Internal access — authorized wallets only
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
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
                    <Wallet size={15} />
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
              Sign a message to prove you own this wallet. No gas, no transaction.
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
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--muted-foreground)]">
        EIP-4361 · Read-only signature · No gas cost
      </p>
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
