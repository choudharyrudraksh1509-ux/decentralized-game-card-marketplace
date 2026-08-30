/**
 * WalletConnector.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained wallet connection widget.
 *
 * What it does:
 *   - Detects MetaMask / any EIP-1193 injected provider at mount.
 *   - Renders a "Connect Wallet" button (delegates to RainbowKit modal for
 *     multi-wallet support, plus a quick-connect for injected providers).
 *   - Once connected, shows a shortened address pill + Copy + Disconnect.
 *   - If the connected chain is NOT Polygon Mumbai (80001), renders a
 *     prominent warning banner with a one-click "Switch Network" button
 *     that calls wallet_switchEthereumChain (+ wallet_addEthereumChain if
 *     the chain is not yet registered in the wallet).
 *
 * Export: default WalletConnector
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkGuard, MUMBAI_CHAIN_ID } from "../hooks/useNetworkGuard";

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Format:  0x1234...5678  */
function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

/** Detect window.ethereum at call-time (client-side only). */
function detectProvider() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return {
    isMetaMask:  Boolean(window.ethereum.isMetaMask),
    isCoinbase:  Boolean(window.ethereum.isCoinbaseWallet),
    isInjected:  true,
    raw:         window.ethereum,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Small badge indicating which provider was detected. */
function ProviderBadge({ info }) {
  if (!info) return null;
  const [label, emoji] = info.isMetaMask
    ? ["MetaMask", "🦊"]
    : info.isCoinbase
    ? ["Coinbase", "🔵"]
    : ["Injected", "💼"];
  return (
    <span className="badge badge-amber gap-1 text-[10px] tracking-widest">
      {emoji} {label} detected
    </span>
  );
}

/** Wrong-network banner. */
function NetworkWarningBanner({ currentChainId, onSwitch, switching, error }) {
  return (
    <div
      role="alert"
      className="w-full rounded-lg border border-crimson/40 bg-crimson/10
                 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center
                 justify-between gap-3"
    >
      <div className="flex items-start gap-2">
        <span className="text-crimson-light text-lg leading-none mt-0.5" aria-hidden>⚠️</span>
        <div>
          <p className="text-crimson-light font-semibold text-sm">Wrong Network</p>
          <p className="text-muted text-xs mt-0.5">
            Connected to chain{" "}
            <code className="font-mono text-parchment">{currentChainId}</code>.
            {" "}This dApp requires{" "}
            <span className="text-parchment font-semibold">Polygon Mumbai</span>
            {" "}(chain <code className="font-mono text-parchment">{MUMBAI_CHAIN_ID}</code>).
          </p>
          {error && (
            <p className="text-crimson-light text-xs mt-1 font-mono break-all">{error}</p>
          )}
        </div>
      </div>

      <button
        onClick={onSwitch}
        disabled={switching}
        className="btn-danger shrink-0 text-xs px-4 py-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {switching
          ? <><span className="animate-spin inline-block mr-1">&#x27F3;</span>Switching&hellip;</>
          : "Switch to Mumbai"}
      </button>
    </div>
  );
}

/** Connected address pill with copy + disconnect. */
function ConnectedPill({ address, onDisconnect, openAccountModal }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard API unavailable */ }
  }, [address]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Address pill — opens RainbowKit account modal on click */}
      <button
        onClick={openAccountModal}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                   border border-gold/40 bg-gold/10 text-gold
                   font-mono text-sm
                   hover:border-gold hover:bg-gold/20
                   transition-colors duration-200"
        title="View account details"
      >
        {/* Pulse dot */}
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse" aria-hidden />
        {shortenAddress(address)}
      </button>

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="btn-ghost text-xs px-2.5 py-1.5"
        title="Copy full address"
        aria-label="Copy address to clipboard"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>

      {/* Disconnect */}
      <button
        onClick={onDisconnect}
        className="btn-ghost text-xs px-2.5 py-1.5
                   hover:border-crimson hover:text-crimson-light"
        title="Disconnect wallet"
      >
        Disconnect
      </button>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function WalletConnector() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect }    = useConnect();

  const [providerInfo, setProviderInfo] = useState(null);

  const {
    currentChainId,
    isCorrectNetwork,
    switching,
    switchToTarget,
    error: networkError,
  } = useNetworkGuard(MUMBAI_CHAIN_ID);

  // Detect provider once on mount; re-detect on account changes.
  useEffect(() => {
    setProviderInfo(detectProvider());
    const refresh = () => setProviderInfo(detectProvider());
    window.ethereum?.on?.("accountsChanged", refresh);
    return () => window.ethereum?.removeListener?.("accountsChanged", refresh);
  }, []);

  const isPending = isConnecting || isReconnecting;

  return (
    <div className="flex flex-col gap-2 items-start w-full">

      {/* Provider badge — visible only when disconnected */}
      {!isConnected && <ProviderBadge info={providerInfo} />}

      {/* ── Connection controls via RainbowKit Custom render prop ── */}
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openAccountModal, mounted }) => {

          // Prevent SSR / hydration mismatch
          if (!mounted) {
            return (
              <div aria-hidden className="opacity-0 pointer-events-none">
                <button className="btn-primary">Connect Wallet</button>
              </div>
            );
          }

          // ── Disconnected state ─────────────────────────────────────────────
          if (!isConnected) {
            return (
              <div className="flex items-center gap-2 flex-wrap">
                {/* RainbowKit multi-wallet modal */}
                <button
                  onClick={openConnectModal}
                  disabled={isPending}
                  className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending
                    ? <><span className="animate-spin inline-block mr-1">&#x27F3;</span>Connecting&hellip;</>
                    : "Connect Wallet"}
                </button>

                {/* Quick-connect for injected provider (MetaMask etc.) */}
                {providerInfo?.isInjected && (
                  <button
                    onClick={() => connect({ connector: injected() })}
                    disabled={isPending}
                    className="btn-ghost text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    title={`Quick-connect with ${providerInfo.isMetaMask ? "MetaMask" : "injected wallet"}`}
                  >
                    {providerInfo.isMetaMask ? "🦊" : "💼"} Quick Connect
                  </button>
                )}
              </div>
            );
          }

          // ── Connected state ────────────────────────────────────────────────
          return (
            <ConnectedPill
              address={address}
              onDisconnect={disconnect}
              openAccountModal={openAccountModal}
            />
          );
        }}
      </ConnectButton.Custom>

      {/* ── Network guard ───────────────────────────────────────────── */}
      {isConnected && !isCorrectNetwork && (
        <NetworkWarningBanner
          currentChainId={currentChainId}
          onSwitch={switchToTarget}
          switching={switching}
          error={networkError}
        />
      )}

      {/* Correct-network confirmation dot */}
      {isConnected && isCorrectNetwork && (
        <p className="text-xs text-muted flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" aria-hidden />
          Polygon Mumbai
        </p>
      )}
    </div>
  );
}