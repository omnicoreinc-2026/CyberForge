"""DNS record analyzer.

Queries multiple DNS record types for a domain using dnspython
and returns structured DnsRecord results.
"""

import asyncio
import logging

import dns.resolver

from backend.models.recon import DnsRecord

logger = logging.getLogger(__name__)

# Record types to query
_RECORD_TYPES: list[str] = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]


def _query_records(domain: str, rtype: str) -> list[DnsRecord]:
    """Synchronously query DNS for a specific record type.

    Returns an empty list if the record type does not exist or the
    query fails.
    """
    records: list[DnsRecord] = []
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5.0
        resolver.lifetime = 5.0
        answers = resolver.resolve(domain, rtype)

        for rdata in answers:
            value = ""
            if rtype == "MX":
                value = f"{rdata.preference} {rdata.exchange}"
            elif rtype == "SOA":
                value = (
                    f"{rdata.mname} {rdata.rname} "
                    f"serial={rdata.serial} "
                    f"refresh={rdata.refresh} "
                    f"retry={rdata.retry} "
                    f"expire={rdata.expire} "
                    f"minimum={rdata.minimum}"
                )
            else:
                value = str(rdata).strip('"')

            records.append(
                DnsRecord(
                    record_type=rtype,
                    name=domain,
                    value=value,
                    ttl=int(answers.rrset.ttl) if answers.rrset else 0,
                )
            )
    except (
        dns.resolver.NXDOMAIN,
        dns.resolver.NoAnswer,
        dns.resolver.NoNameservers,
        dns.resolver.LifetimeTimeout,
        dns.exception.Timeout,
        Exception,
    ) as exc:
        logger.debug("DNS %s query for %s: %s", rtype, domain, exc)

    return records


async def analyze_dns(domain: str) -> list[DnsRecord]:
    """Analyze all common DNS record types for *domain*.

    Runs each record type query concurrently in a thread executor
    to avoid blocking the event loop.

    Args:
        domain: Domain name to analyze.

    Returns:
        List of all discovered DnsRecord objects across all record types.
    """
    loop = asyncio.get_running_loop()
    all_records: list[DnsRecord] = []

    # Query all record types concurrently
    tasks = [
        loop.run_in_executor(None, _query_records, domain, rtype)
        for rtype in _RECORD_TYPES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, list):
            all_records.extend(result)
        elif isinstance(result, Exception):
            logger.warning("DNS query error: %s", result)

    logger.info("DNS analysis for %s: %d records found", domain, len(all_records))
    return all_records
