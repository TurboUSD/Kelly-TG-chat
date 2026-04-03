"use client";

import { useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { useState, useCallback, Suspense } from "react";
import { SiweMessage } from "siwe";

function VerifyContent() {
  const searchParams = useSearchParams();
  const tg = searchParams.get("tg");
  const chat = searchParams.get("chat");

  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [status, setStatus] = useState<
    "idle" | "signing" | "verifying" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState("");

  const handleVerify = useCallback(async () => {
    if (!address || !tg || !chat) return;

    const toStr = (err: any): string => {
      if (!err) return "Unknown error";
      if (typeof err === "string") return err;
      if (typeof err.shortMessage === "string" && err.shortMessage) return err.shortMessage;
      if (typeof err.message === "string" && err.message) return err.message;
      if (typeof err.name === "string" && err.name) return err.name;
      try { return JSON.stringify(err); } catch { return String(err); }
    };

    const isRejection = (s: string) =>
      ["reject", "cancel", "denied", "refused", "declined"].some((w) =>
        s.toLowerCase().includes(w)
      );

    // Step 1: Get nonce
    let nonce: string;
    try {
      setStatus("signing");
      const nonceRes = await fetch(`/api/nonce?tg=${tg}&chat=${chat}`);
      const data = await nonceRes.json();
      nonce = data.nonce;
      if (!nonce) throw new Error("Server did not return a nonce");
    } catch (err: any) {
      setStatus("error");
      setMessage("Failed to get nonce: " + toStr(err));
      return;
    }

    // Step 2: Build SIWE message
    let messageToSign: string;
    try {
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement: `Verify KELLY token ownership for Telegram user ${tg}`,
        uri: window.location.origin,
        version: "1",
        chainId: 8453,
        nonce,
      });
      messageToSign = siweMessage.prepareMessage();
    } catch (err: any) {
      setStatus("error");
      setMessage("Failed to build sign-in message: " + toStr(err));
      return;
    }

    // Step 3: Sign message
    let signature: string;
    try {
      signature = await signMessageAsync({ message: messageToSign });
    } catch (err: any) {
      setStatus("error");
      const msg = toStr(err);
      setMessage(isRejection(msg) ? "Signature cancelled. Please try again." : "Signing failed: " + msg);
      return;
    }

    // Step 4: Verify with server
    setStatus("verifying");
    try {
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSign, signature }),
      });

      let result: any;
      try {
        result = await verifyRes.json();
      } catch {
        setStatus("error");
        setMessage("Server returned an invalid response (HTTP " + verifyRes.status + ")");
        return;
      }

      if (verifyRes.ok && result.success) {
        setStatus("success");
        setMessage(result.message);
        setBalance(result.balance);
      } else {
        setStatus("error");
        setMessage(result.error || "Verification failed");
        if (result.balance) setBalance(result.balance);
      }
    } catch (err: any) {
      setStatus("error");
      setMessage("Network error: " + toStr(err));
    }
  }, [address, tg, chat, signMessageAsync]);

  if (!tg || !chat) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={styles.text}>
            Use the /start command in the Telegram bot to get a valid
            verification link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Kelly icon */}
        <div style={styles.iconWrapper}>
          <img
            src="/kelly-icon.jpg"
            alt="Kelly"
            style={styles.icon}
          />
        </div>

        <h1 style={styles.title}>$KELLY Token Gate</h1>
        <p style={styles.subtitle}>
          Connect your wallet and verify you hold at least 50M $KELLY
          on Base to join the chat.
        </p>
        <p style={{ color: "#555", fontSize: "0.78rem", margin: "-0.75rem 0 1.5rem", letterSpacing: "0.03em" }}>
          🔒 No funds move — signature only
        </p>

        <div style={styles.connectWrapper}>
          <ConnectButton />
        </div>

        {isConnected && chain?.id !== 8453 && (
          <div style={{ ...styles.alert, borderColor: "#f59e0b" }}>
            Please switch your wallet to the <strong>Base</strong> network to continue.
          </div>
        )}

        {isConnected && (chain?.id === 8453 || !chain) && status === "idle" && (
          <button
            style={styles.verifyButton}
            onClick={handleVerify}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Verify $KELLY Holdings
          </button>
        )}

        {status === "signing" && (
          <div style={styles.alert}>
            Sign the message in your wallet...
          </div>
        )}

        {status === "verifying" && (
          <div style={styles.alert}>
            Checking your $KELLY balance on Base...
          </div>
        )}

        {status === "success" && (
          <div style={{ ...styles.alert, borderColor: "#22c55e", background: "#052e16" }}>
            <p style={{ fontSize: "1.2rem", margin: "0 0 0.5rem" }}>Verified!</p>
            {balance && (
              <p style={{ margin: "0.25rem 0", color: "#86efac" }}>
                Balance: {Number(balance).toLocaleString()} $KELLY
              </p>
            )}
            <p style={{ margin: "0.5rem 0 0", color: "#bbf7d0" }}>{message}</p>
            <p style={{ margin: "1rem 0 0", color: "#aaa", fontSize: "0.85rem" }}>
              Head back to Telegram — the bot sent you an invite link.
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ ...styles.alert, borderColor: "#ef4444", background: "#450a0a" }}>
            {balance ? (
              <>
                <p style={{ fontSize: "1.3rem", margin: "0 0 0.75rem", fontWeight: 700, color: "#fca5a5" }}>
                  Insufficient $KELLY balance
                </p>
                <p style={{ margin: "0 0 0.5rem", color: "#f87171", fontSize: "1.1rem" }}>
                  Your balance: <strong>~{Math.floor(Number(balance)).toLocaleString()} $KELLY</strong>
                </p>
                <p style={{ margin: "0", color: "#fca5a5", fontSize: "0.95rem" }}>
                  You need at least <strong>50,000,000 $KELLY</strong> to join.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "1.2rem", margin: "0 0 0.5rem", fontWeight: 700, color: "#fca5a5" }}>
                  Verification Failed
                </p>
                <p style={{ margin: "0", color: "#f87171", fontSize: "0.9rem" }}>{message}</p>
              </>
            )}
            <button
              style={{ ...styles.verifyButton, marginTop: "1.25rem" }}
              onClick={() => {
                setStatus("idle");
                setMessage("");
                setBalance("");
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.card}>
            <p style={{ color: "#aaa" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "1rem",
    background: "#0a0a0a",
  },
  card: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: "20px",
    padding: "2.5rem 2rem",
    maxWidth: "440px",
    width: "100%",
    textAlign: "center",
  },
  iconWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "1.25rem",
  },
  icon: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    objectFit: "cover" as const,
  },
  title: {
    fontSize: "1.6rem",
    margin: "0 0 0.75rem",
    color: "#ff6b8a",
    fontWeight: 700,
  },
  text: {
    color: "#aaa",
    fontSize: "0.95rem",
  },
  subtitle: {
    color: "#999",
    fontSize: "0.9rem",
    margin: "0 0 1.75rem",
    lineHeight: "1.6",
  },
  connectWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "1.25rem",
  },
  verifyButton: {
    background: "linear-gradient(135deg, #ff6b8a 0%, #ff8a6b 100%)",
    color: "white",
    border: "none",
    borderRadius: "14px",
    padding: "16px 28px",
    fontSize: "1.05rem",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
    letterSpacing: "0.01em",
  },
  alert: {
    border: "1px solid #333",
    borderRadius: "12px",
    padding: "1rem",
    margin: "1rem 0",
    background: "#1a1a2e",
    textAlign: "center" as const,
    color: "#ccc",
  },
};
