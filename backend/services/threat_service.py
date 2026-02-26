"""Threat intelligence orchestration service.

Coordinates IOC lookups, IP reputation checks, threat feed aggregation,
and IP geolocation across multiple integration sources. Stores results
in the database and emits progress updates over WebSocket.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from backend.database import db
from backend.integrations.abusech_client import AbusechClient
from backend.integrations.abuseipdb_client import AbuseIPDBClient
from backend.integrations.geoip_client import GeoIPClient
from backend.integrations.otx_client import OtxClient
from backend.models.threat import (
    GeoIpResult,
    IocResult,
    IpReputationResult,
    ThreatFeedEntry,
)
from backend.services.keystore_service import keystore
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)


class ThreatService:
    """Orchestrates threat intelligence operations."""

    def __init__(self) -> None:
        self._geoip_client = GeoIPClient()

    async def _get_otx_client(self) -> OtxClient | None:
        """Return an OTX client if the API key is configured."""
        api_key = await keystore.get_key("otx")
        if not api_key:
            logger.warning("OTX API key not configured, skipping OTX queries")
            return None
        return OtxClient(api_key)

    async def _get_abuseipdb_client(self) -> AbuseIPDBClient | None:
        """Return an AbuseIPDB client if the API key is configured."""
        api_key = await keystore.get_key("abuseipdb")
        if not api_key:
            logger.warning("AbuseIPDB API key not configured, skipping AbuseIPDB queries")
            return None
        return AbuseIPDBClient(api_key)

    async def _store_result(self, scan_id: str, scan_type: str, target: str, results: list[dict], severity: str = "info") -> None:
        """Persist scan results to the database."""
        conn = await db.get_connection()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_results (id, scan_type, target, results_json, severity, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (scan_id, scan_type, target, json.dumps(results), severity, datetime.now(timezone.utc).isoformat()),
        )
        await conn.commit()

    async def _store_history(self, scan_id: str, module: str, target: str, status: str, result_count: int) -> None:
        """Record scan execution in scan_history."""
        conn = await db.get_connection()
        now = datetime.now(timezone.utc).isoformat()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_history (id, module, target, status, started_at, completed_at, result_count) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (scan_id, module, target, status, now, now if status in ("completed", "error") else None, result_count),
        )
        await conn.commit()

    @staticmethod
    def _determine_severity(confidence: int) -> str:
        """Map a confidence score to a severity label."""
        if confidence >= 80:
            return "critical"
        if confidence >= 60:
            return "high"
        if confidence >= 40:
            return "medium"
        if confidence >= 20:
            return "low"
        return "info"

    async def lookup_ioc(self, ioc_value: str, ioc_type: str, scan_id: str, emitter: ProgressEmitter) -> dict:
        """Look up an IOC across multiple threat intelligence sources."""
        await self._store_history(scan_id, "threat_ioc", ioc_value, "running", 0)
        try:
            await emitter.emit(5, "running", "Initialising threat intelligence sources", "threat_ioc")
            tasks: dict[str, asyncio.Task] = {}  # type: ignore[type-arg]
            threatfox = AbusechClient()
            otx = await self._get_otx_client()
            tasks["threatfox"] = asyncio.create_task(threatfox.query_ioc(ioc_value))
            if otx:
                if ioc_type == "ip":
                    tasks["otx"] = asyncio.create_task(otx.get_indicator_ip(ioc_value))
                elif ioc_type == "domain":
                    tasks["otx"] = asyncio.create_task(otx.get_indicator_domain(ioc_value))
                elif ioc_type == "url":
                    tasks["otx"] = asyncio.create_task(otx.get_indicator_url(ioc_value))
                elif ioc_type == "hash":
                    tasks["otx"] = asyncio.create_task(otx.get_indicator_hash(ioc_value))
            if ioc_type == "ip":
                abuseipdb = await self._get_abuseipdb_client()
                if abuseipdb:
                    tasks["abuseipdb"] = asyncio.create_task(abuseipdb.check_ip(ioc_value))
                tasks["geoip"] = asyncio.create_task(self._geoip_client.lookup_ip(ioc_value))
            await emitter.emit(20, "running", "Querying threat intelligence sources", "threat_ioc")
            results_map: dict[str, object] = {}
            for name, task in tasks.items():
                try:
                    results_map[name] = await task
                except Exception as exc:
                    logger.error("Source %s failed for IOC %s: %s", name, ioc_value, exc)
                    results_map[name] = {"error": str(exc)}
            await emitter.emit(70, "running", "Aggregating results", "threat_ioc")
            ioc_results: list[dict] = []
            threatfox_data = results_map.get("threatfox", [])
            if isinstance(threatfox_data, list):
                for entry in threatfox_data:
                    ioc_results.append(IocResult(
                        ioc_type=entry.get("ioc_type", ioc_type), value=entry.get("ioc_value", ioc_value),
                        threat_type=entry.get("threat_type", ""), malware=entry.get("malware"),
                        confidence=entry.get("confidence", 0), source="threatfox",
                        first_seen=entry.get("first_seen", ""), last_seen=entry.get("last_seen", ""),
                        tags=entry.get("tags") or [],
                    ).model_dump())
            otx_data = results_map.get("otx", {})
            if isinstance(otx_data, dict) and "error" not in otx_data:
                pulse_count = otx_data.get("pulse_count", 0)
                otx_general = otx_data.get("general", {})
                pulse_info = otx_general.get("pulse_info", {}) if isinstance(otx_general, dict) else {}
                pulses = pulse_info.get("pulses", []) if isinstance(pulse_info, dict) else []
                otx_tags: list[str] = []
                for pulse in pulses[:5]:
                    if isinstance(pulse, dict):
                        otx_tags.extend(pulse.get("tags", []))
                ioc_results.append(IocResult(
                    ioc_type=ioc_type, value=ioc_value, threat_type="otx_indicator",
                    malware=None, confidence=min(pulse_count * 10, 100), source="otx",
                    first_seen="", last_seen="", tags=list(set(otx_tags))[:20],
                ).model_dump())
            max_confidence = max((r.get("confidence", 0) for r in ioc_results), default=0)
            severity = self._determine_severity(max_confidence)
            response: dict = {
                "scan_id": scan_id, "ioc_value": ioc_value, "ioc_type": ioc_type,
                "sources": {}, "ioc_results": ioc_results,
                "max_confidence": max_confidence, "severity": severity,
                "total_sources_queried": len(tasks),
            }
            if "otx" in results_map:
                otx_raw = results_map["otx"]
                if isinstance(otx_raw, dict):
                    response["sources"]["otx"] = {"pulse_count": otx_raw.get("pulse_count", 0), "reputation": otx_raw.get("reputation", 0), "country": otx_raw.get("country", ""), "asn": otx_raw.get("asn", ""), "error": otx_raw.get("error")}
            if "threatfox" in results_map:
                tf_data = results_map["threatfox"]
                response["sources"]["threatfox"] = {"match_count": len(tf_data) if isinstance(tf_data, list) else 0, "error": tf_data.get("error") if isinstance(tf_data, dict) else None}
            if "abuseipdb" in results_map:
                abuse_data = results_map["abuseipdb"]
                if isinstance(abuse_data, dict):
                    response["sources"]["abuseipdb"] = {"abuse_score": abuse_data.get("abuse_score", 0), "country": abuse_data.get("country", ""), "isp": abuse_data.get("isp", ""), "total_reports": abuse_data.get("total_reports", 0), "last_reported": abuse_data.get("last_reported", ""), "categories": abuse_data.get("categories", []), "error": abuse_data.get("error")}
            if "geoip" in results_map:
                geo_data = results_map["geoip"]
                if isinstance(geo_data, dict) and "error" not in geo_data:
                    response["sources"]["geoip"] = {"country": geo_data.get("country", ""), "country_code": geo_data.get("country_code", ""), "region": geo_data.get("region", ""), "city": geo_data.get("city", ""), "lat": geo_data.get("lat", 0.0), "lon": geo_data.get("lon", 0.0), "isp": geo_data.get("isp", ""), "org": geo_data.get("org", ""), "as_number": geo_data.get("as_number", "")}
            await emitter.emit(90, "running", "Storing results", "threat_ioc")
            await self._store_result(scan_id, "threat_ioc", ioc_value, ioc_results, severity)
            await self._store_history(scan_id, "threat_ioc", ioc_value, "completed", len(ioc_results))
            await emitter.emit(100, "completed", "IOC lookup complete", "threat_ioc")
            return response
        except Exception as exc:
            logger.error("IOC lookup failed for %s: %s", ioc_value, exc)
            await self._store_history(scan_id, "threat_ioc", ioc_value, "error", 0)
            await emitter.emit(100, "error", str(exc), "threat_ioc")
            return {"scan_id": scan_id, "ioc_value": ioc_value, "ioc_type": ioc_type, "error": str(exc), "sources": {}, "ioc_results": [], "max_confidence": 0, "severity": "info", "total_sources_queried": 0}

    async def check_ip_reputation(self, ip: str, scan_id: str, emitter: ProgressEmitter) -> dict:
        """Check IP reputation using AbuseIPDB and GeoIP."""
        await self._store_history(scan_id, "threat_ip_reputation", ip, "running", 0)
        try:
            await emitter.emit(10, "running", "Checking IP reputation", "threat_ip_reputation")
            abuseipdb = await self._get_abuseipdb_client()
            tasks = {}
            if abuseipdb:
                tasks["abuseipdb"] = asyncio.create_task(abuseipdb.check_ip(ip))
            tasks["geoip"] = asyncio.create_task(self._geoip_client.lookup_ip(ip))
            await emitter.emit(30, "running", "Querying reputation sources", "threat_ip_reputation")
            results_map: dict[str, dict] = {}
            for name, task in tasks.items():
                try:
                    results_map[name] = await task
                except Exception as exc:
                    logger.error("Source %s failed for IP %s: %s", name, ip, exc)
                    results_map[name] = {"error": str(exc)}
            await emitter.emit(70, "running", "Aggregating reputation data", "threat_ip_reputation")
            abuse_data = results_map.get("abuseipdb", {})
            geo_data = results_map.get("geoip", {})
            reputation = IpReputationResult(
                ip=ip, abuse_score=abuse_data.get("abuse_score", 0),
                country=abuse_data.get("country") or geo_data.get("country", ""),
                isp=abuse_data.get("isp") or geo_data.get("isp", ""),
                domain=abuse_data.get("domain", ""),
                total_reports=abuse_data.get("total_reports", 0),
                last_reported=abuse_data.get("last_reported", ""),
                categories=abuse_data.get("categories", []),
            )
            geo = GeoIpResult(
                ip=ip, country=geo_data.get("country", ""),
                country_code=geo_data.get("country_code", ""),
                region=geo_data.get("region", ""), city=geo_data.get("city", ""),
                lat=geo_data.get("lat", 0.0), lon=geo_data.get("lon", 0.0),
                isp=geo_data.get("isp", ""), org=geo_data.get("org", ""),
                as_number=geo_data.get("as_number", ""),
            )
            response = {"scan_id": scan_id, "reputation": reputation.model_dump(), "geolocation": geo.model_dump(), "abuseipdb_error": abuse_data.get("error"), "geoip_error": geo_data.get("error")}
            await emitter.emit(90, "running", "Storing results", "threat_ip_reputation")
            await self._store_result(scan_id, "threat_ip_reputation", ip, [reputation.model_dump()], self._determine_severity(reputation.abuse_score))
            await self._store_history(scan_id, "threat_ip_reputation", ip, "completed", 1)
            await emitter.emit(100, "completed", "IP reputation check complete", "threat_ip_reputation")
            return response
        except Exception as exc:
            logger.error("IP reputation check failed for %s: %s", ip, exc)
            await self._store_history(scan_id, "threat_ip_reputation", ip, "error", 0)
            await emitter.emit(100, "error", str(exc), "threat_ip_reputation")
            return {"scan_id": scan_id, "reputation": IpReputationResult(ip=ip).model_dump(), "geolocation": GeoIpResult(ip=ip).model_dump(), "error": str(exc)}

    async def get_threat_feed(self, limit: int = 50) -> list[dict]:
        """Aggregate recent IOCs from ThreatFox."""
        try:
            threatfox = AbusechClient()
            raw_results = await threatfox.query_ioc("")
            entries: list[dict] = []
            seen_ids: set[str] = set()
            for item in raw_results[:limit]:
                entry_id = str(item.get("id", uuid4().hex))
                if entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)
                entries.append(ThreatFeedEntry(
                    id=entry_id, ioc_type=item.get("ioc_type", "unknown"),
                    ioc_value=item.get("ioc_value", ""),
                    threat_type=item.get("threat_type", ""),
                    confidence=item.get("confidence", 0), source="threatfox",
                    timestamp=item.get("first_seen", datetime.now(timezone.utc).isoformat()),
                ).model_dump())
            return entries[:limit]
        except Exception as exc:
            logger.error("Threat feed retrieval failed: %s", exc)
            return []

    async def geolocate_ip(self, ip: str) -> dict:
        """Get geolocation data for an IP address."""
        try:
            data = await self._geoip_client.lookup_ip(ip)
            if "error" in data:
                return GeoIpResult(ip=ip).model_dump() | {"error": data["error"]}
            return GeoIpResult(
                ip=data.get("ip", ip), country=data.get("country", ""),
                country_code=data.get("country_code", ""),
                region=data.get("region", ""), city=data.get("city", ""),
                lat=data.get("lat", 0.0), lon=data.get("lon", 0.0),
                isp=data.get("isp", ""), org=data.get("org", ""),
                as_number=data.get("as_number", ""),
            ).model_dump()
        except Exception as exc:
            logger.error("GeoIP lookup failed for %s: %s", ip, exc)
            return GeoIpResult(ip=ip).model_dump() | {"error": str(exc)}
