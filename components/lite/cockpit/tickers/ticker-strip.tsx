"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

interface WeatherData {
  temp: number;
  feelsLike: number;
  condition: string;
  uv: number;
  rainChance: number;
}

interface CryptoData {
  btc: { price: number; change24h: number };
  eth: { price: number; change24h: number };
}

interface PulseData {
  actionsOvernight: number;
  emailsSent: number;
  contentScheduled: number;
}

interface TickerStripProps {
  pulse: PulseData;
}

function WeatherIcon({ condition }: { condition: string }) {
  const lower = condition.toLowerCase();
  if (lower.includes("rain") || lower.includes("drizzle"))
    return <CloudRain size={14} />;
  if (lower.includes("snow")) return <CloudSnow size={14} />;
  if (lower.includes("thunder") || lower.includes("storm"))
    return <CloudLightning size={14} />;
  if (lower.includes("wind")) return <Wind size={14} />;
  if (lower.includes("clear") || lower.includes("sun"))
    return <Sun size={14} />;
  return <Cloud size={14} />;
}

function uvBadgeColor(uv: number): string {
  if (uv >= 11) return "var(--color-semantic-error)";
  if (uv >= 8) return "var(--color-brand-orange)";
  if (uv >= 6) return "var(--color-semantic-warning)";
  if (uv >= 3) return "var(--color-semantic-success)";
  return "var(--color-neutral-500)";
}

export function TickerStrip({ pulse }: TickerStripProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [crypto, setCrypto] = useState<CryptoData | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch("/api/lite/cockpit/tickers/weather");
        if (res.ok) setWeather(await res.json());
      } catch {
        // Weather unavailable
      }
    }

    async function fetchCrypto() {
      try {
        const res = await fetch("/api/lite/cockpit/tickers/crypto");
        if (res.ok) setCrypto(await res.json());
      } catch {
        // Crypto unavailable
      }
    }

    fetchWeather();
    fetchCrypto();

    const interval = setInterval(() => {
      fetchWeather();
      fetchCrypto();
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : houseSpring}
      className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none"
    >
      {/* Weather */}
      {weather && (
        <TickerChip>
          <WeatherIcon condition={weather.condition} />
          <span className="tabular-nums">{weather.temp}°</span>
          {weather.uv > 0 && (
            <span
              className="rounded px-1 py-px text-[9px] font-medium uppercase"
              style={{
                background: `${uvBadgeColor(weather.uv)}20`,
                color: uvBadgeColor(weather.uv),
              }}
            >
              UV {weather.uv}
            </span>
          )}
          {weather.rainChance > 20 && (
            <span style={{ color: "var(--color-neutral-500)" }}>
              {weather.rainChance}% rain
            </span>
          )}
        </TickerChip>
      )}

      {/* Crypto */}
      {crypto && (
        <TickerChip>
          <span style={{ color: "var(--color-brand-orange)" }}>BTC</span>
          <span className="tabular-nums">
            ${crypto.btc.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <PriceChange change={crypto.btc.change24h} />
          <span className="mx-1 opacity-30">|</span>
          <span style={{ color: "var(--color-neutral-500)" }}>ETH</span>
          <span className="tabular-nums">
            ${crypto.eth.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <PriceChange change={crypto.eth.change24h} />
        </TickerChip>
      )}

      {/* Lite Pulse */}
      <TickerChip>
        <Activity size={12} style={{ color: "var(--color-semantic-success)" }} />
        <span>{pulse.actionsOvernight} overnight</span>
      </TickerChip>
    </motion.div>
  );
}

function TickerChip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[12px]"
      style={{
        background: "var(--color-surface-2)",
        color: "var(--color-neutral-300)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      {children}
    </div>
  );
}

function PriceChange({ change }: { change: number }) {
  const isUp = change >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] tabular-nums"
      style={{
        color: isUp ? "var(--color-semantic-success)" : "var(--color-semantic-error)",
      }}
    >
      {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}
