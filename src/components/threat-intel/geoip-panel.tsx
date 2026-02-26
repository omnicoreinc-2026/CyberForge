import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, Globe, Server, Building, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import type { GeoIpData } from "@/types/threat";
import type { ScanStatus } from "@/types/scan";

function InfoRow({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <Icon className="h-4 w-4 text-accent shrink-0" />
      <span className="text-xs text-text-muted w-28">{label}</span>
      <span className="font-mono text-sm text-text-primary">{value || "-"}</span>
    </div>
  );
}

export function GeoipPanel() {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [results, setResults] = useState<GeoIpData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus("running");
    setError(null);
    try {
      const data = await ApiClient.post<GeoIpData>("/api/threat/geoip", { target: target.trim() });
      if ("error" in data && data.error) {
        setError(data.error as string);
        setStatus("error");
        return;
      }
      setResults(data);
      setStatus("complete");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "GeoIP lookup failed";
      setError(message);
      setStatus("error");
    }
  }, [target]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleScan(); }}
            placeholder="Enter IP address (e.g., 1.1.1.1)"
            disabled={status === "running"}
            className={cn(
              "w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5",
              "text-sm text-text-primary placeholder:text-text-muted font-mono",
              "outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void handleScan()}
          disabled={status === "running" || !target.trim()}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5",
            "text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50",
            "hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]",
          )}
        >
          <Search className="h-4 w-4" />
          {status === "running" ? "Looking up..." : "Locate"}
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card border-danger/30 p-4 text-sm text-danger">{error}
          </motion.div>
        )}
      </AnimatePresence>

      {status === "running" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Geolocating IP address...</span>
        </motion.div>
      )}

      {status === "complete" && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                Location Details
              </h3>
              <div className="flex flex-col">
                <InfoRow icon={Globe} label="Country" value={`${results.country}${results.country_code ? ` (${results.country_code})` : ""}`} />
                <InfoRow icon={MapPin} label="Region" value={results.region} />
                <InfoRow icon={Building} label="City" value={results.city} />
                <InfoRow icon={Navigation} label="Coordinates" value={results.lat && results.lon ? `${results.lat.toFixed(4)}, ${results.lon.toFixed(4)}` : "-"} />
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Server className="h-4 w-4 text-accent" />
                Network Details
              </h3>
              <div className="flex flex-col">
                <InfoRow icon={Globe} label="IP Address" value={results.ip} />
                <InfoRow icon={Server} label="ISP" value={results.isp} />
                <InfoRow icon={Building} label="Organization" value={results.org} />
                <InfoRow icon={Server} label="AS Number" value={results.as_number} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {status === "idle" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
          <MapPin className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter an IP address to view its geolocation data</p>
        </motion.div>
      )}
    </div>
  );
}
