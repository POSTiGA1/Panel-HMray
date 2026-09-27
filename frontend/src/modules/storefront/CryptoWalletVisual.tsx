"use client";

import { useState } from "react";
import { Check, Copy, Wallet } from "lucide-react";

export type CryptoWalletVisualProps = {
  network?: string | null;
  asset?: string | null;
  address?: string | null;
  amountLabel?: string | null;
  amountValue?: string | null;
  instructions?: string | null;
  copyLabel?: string;
  copiedLabel?: string;
  walletLabel?: string;
  className?: string;
};

function shortenAddress(addr: string) {
  const a = addr.trim();
  if (a.length <= 20) return a;
  return `${a.slice(0, 10)}…${a.slice(-8)}`;
}

/** Crypto destination card — address + amount, tap to copy. */
export function CryptoWalletVisual({
  network,
  asset,
  address,
  amountLabel,
  amountValue,
  instructions,
  copyLabel = "Copy address",
  copiedLabel = "Copied",
  walletLabel = "Crypto wallet",
  className,
}: CryptoWalletVisualProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={className}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Wallet size={14} />
        {walletLabel}
      </div>

      <button
        type="button"
        onClick={copyAddress}
        disabled={!address}
        aria-label={copyLabel}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          minHeight: 168,
          margin: 0,
          padding: 20,
          border: "none",
          borderRadius: 18,
          cursor: address ? "pointer" : "default",
          textAlign: "start",
          color: "#fff",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, #111827 0%, #1f2937 38%, #064e3b 100%)",
          boxShadow: "0 12px 32px rgba(6, 78, 59, 0.35)",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            insetInlineEnd: -30,
            top: -40,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "rgba(52, 211, 153, 0.18)",
            filter: "blur(2px)",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            insetInlineStart: -24,
            bottom: -48,
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: "rgba(16, 185, 129, 0.2)",
            filter: "blur(2px)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                }}
              >
                {(asset || "USDT").toUpperCase()}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(167, 243, 208, 0.85)",
                }}
              >
                {network || "NETWORK"}
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                background: "rgba(255,255,255,0.14)",
                backdropFilter: "blur(6px)",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? copiedLabel : copyLabel}
            </span>
          </div>

          {amountValue ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.28)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {amountLabel ? (
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  {amountLabel}
                </div>
              ) : null}
              <div
                dir="ltr"
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  color: "#a7f3d0",
                }}
              >
                {amountValue}
              </div>
            </div>
          ) : null}

          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 4,
              }}
            >
              Address
            </div>
            <div
              dir="ltr"
              title={address || undefined}
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: "clamp(0.78rem, 2.8vw, 0.92rem)",
                fontWeight: 600,
                letterSpacing: "0.02em",
                wordBreak: "break-all",
                color: "rgba(255,255,255,0.95)",
                lineHeight: 1.45,
              }}
            >
              {address ? shortenAddress(address) : "—"}
            </div>
          </div>
        </div>
      </button>

      {instructions ? (
        <p
          style={{
            marginTop: 8,
            paddingInline: 4,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#71717a",
            whiteSpace: "pre-line",
          }}
        >
          {instructions}
        </p>
      ) : null}
    </div>
  );
}
