"""AI service layer for CyberForge.

Provides a unified interface to the configured AI provider and
exposes specialised analysis methods with cybersecurity-focused
system prompts.
"""

import json
import logging
from typing import AsyncGenerator

from backend.ai.base_provider import BaseAIProvider
from backend.ai.anthropic_provider import AnthropicProvider
from backend.ai.openai_provider import OpenAIProvider
from backend.ai.ollama_provider import OllamaProvider
from backend.services.keystore_service import keystore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

CYBERSECURITY_SYSTEM_PROMPT = (
    "You are a senior cybersecurity analyst assistant embedded in CyberForge, "
    "a professional cybersecurity command center. You have deep expertise in "
    "vulnerability assessment, penetration testing, threat intelligence, "
    "incident response, and security architecture.\n\n"
    "Guidelines:\n"
    "- Provide technically accurate, actionable advice.\n"
    "- Reference CVE identifiers, MITRE ATT&CK techniques, and CVSS scores when relevant.\n"
    "- Use clear structure: headings, bullet points, code blocks.\n"
    "- When unsure, state your confidence level and suggest further investigation.\n"
    "- Prioritize defensive recommendations and risk mitigation.\n"
    "- Format code examples with proper syntax highlighting hints."
)

VULN_ANALYSIS_PROMPT = (
    "You are a vulnerability analysis specialist. Analyze the provided vulnerability "
    "data and deliver:\n\n"
    "1. **Severity Assessment** -- CVSS score interpretation, exploitability, and impact.\n"
    "2. **Attack Vector** -- How the vulnerability can be exploited, prerequisites.\n"
    "3. **Affected Systems** -- Scope of impact across typical infrastructure.\n"
    "4. **Detection** -- How to identify if systems are vulnerable or exploited.\n"
    "5. **Remediation** -- Specific patches, configuration changes, or workarounds.\n"
    "6. **Priority** -- Urgency ranking relative to common enterprise risk.\n\n"
    "Be precise and reference official advisories where possible."
)

LOG_ANALYSIS_PROMPT = (
    "You are a security log analysis and anomaly detection expert. Analyze the "
    "provided log entries and identify:\n\n"
    "1. **Anomalies** -- Unusual patterns, unexpected access, timing irregularities.\n"
    "2. **Indicators of Compromise (IoCs)** -- Suspicious IPs, domains, user agents, hashes.\n"
    "3. **Attack Patterns** -- Map findings to MITRE ATT&CK techniques if applicable.\n"
    "4. **Timeline** -- Reconstruct the sequence of events.\n"
    "5. **Severity** -- Rate the overall threat level (info / low / medium / high / critical).\n"
    "6. **Recommendations** -- Immediate containment steps and longer-term hardening.\n\n"
    "Present findings in a structured, analyst-friendly format."
)

REPORT_PROMPT = (
    "You are a cybersecurity report writer preparing executive-level summaries. "
    "Given the scan results, produce a concise report containing:\n\n"
    "1. **Executive Summary** -- 2-3 sentence overview for non-technical stakeholders.\n"
    "2. **Key Findings** -- Top vulnerabilities and risks, ranked by severity.\n"
    "3. **Risk Score** -- Overall posture rating (Critical / High / Medium / Low).\n"
    "4. **Statistics** -- Counts by severity, affected hosts, open ports.\n"
    "5. **Recommendations** -- Prioritized action items with effort estimates.\n\n"
    "Use professional language suitable for board-level reporting."
)

REMEDIATION_PROMPT = (
    "You are a remediation planning specialist. For the provided vulnerability, "
    "generate a detailed fix plan:\n\n"
    "1. **Immediate Actions** -- Quick wins to reduce exposure now.\n"
    "2. **Patch / Update** -- Specific versions, links to advisories.\n"
    "3. **Configuration Hardening** -- Settings changes, firewall rules.\n"
    "4. **Workarounds** -- Temporary mitigations if patching is not immediately possible.\n"
    "5. **Verification** -- How to confirm the fix was applied successfully.\n"
    "6. **Prevention** -- Long-term measures to avoid recurrence.\n\n"
    "Include code snippets or commands where applicable."
)

_TASK_PROMPTS: dict[str, str] = {
    "vulnerability": VULN_ANALYSIS_PROMPT,
    "log": LOG_ANALYSIS_PROMPT,
    "report": REPORT_PROMPT,
    "remediation": REMEDIATION_PROMPT,
}


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AIService:
    """High-level AI service consumed by API routers.

    Reads the active provider / model from application settings and
    lazily instantiates the appropriate provider on first use.
    """

    def __init__(self) -> None:
        self._provider: BaseAIProvider | None = None
        self._provider_name: str = "anthropic"
        self._model_name: str = "claude-sonnet-4-20250514"

    # ------------------------------------------------------------------
    # Provider management
    # ------------------------------------------------------------------

    async def _load_settings(self) -> tuple[str, str]:
        """Read AI provider settings from the database."""
        from backend.database import db

        conn = await db.get_connection()
        cursor = await conn.execute(
            "SELECT key, value_json FROM settings WHERE key IN ('ai_provider', 'ai_model')"
        )
        rows = await cursor.fetchall()

        provider = "anthropic"
        model = "claude-sonnet-4-20250514"
        for row in rows:
            import json as _json
            val = _json.loads(row["value_json"])
            if row["key"] == "ai_provider":
                provider = val
            elif row["key"] == "ai_model":
                model = val

        return provider, model

    async def get_provider(self) -> BaseAIProvider:
        """Return the active AI provider, creating it if necessary."""
        provider_name, model_name = await self._load_settings()

        if (
            self._provider is None
            or provider_name != self._provider_name
            or model_name != self._model_name
        ):
            self._provider_name = provider_name
            self._model_name = model_name
            self._provider = await self._create_provider(provider_name, model_name)

        return self._provider

    async def _create_provider(self, provider_name: str, model: str) -> BaseAIProvider:
        """Instantiate the correct provider based on settings."""
        if provider_name == "anthropic":
            api_key = await keystore.get_key("anthropic") or ""
            return AnthropicProvider(api_key=api_key, model=model)

        if provider_name == "openai":
            api_key = await keystore.get_key("openai") or ""
            return OpenAIProvider(api_key=api_key, model=model)

        if provider_name == "ollama":
            return OllamaProvider(model=model)

        logger.warning("Unknown provider '%s', falling back to Anthropic", provider_name)
        api_key = await keystore.get_key("anthropic") or ""
        return AnthropicProvider(api_key=api_key, model=model)

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict],
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        """Send a chat conversation using the active provider."""
        provider = await self.get_provider()
        return await provider.chat(
            messages,
            system_prompt=CYBERSECURITY_SYSTEM_PROMPT,
            stream=stream,
        )

    # ------------------------------------------------------------------
    # Specialized analysis helpers
    # ------------------------------------------------------------------

    async def analyze_vulnerability(self, cve_data: dict) -> str:
        """Analyze vulnerability / CVE data."""
        provider = await self.get_provider()
        content = json.dumps(cve_data, indent=2)
        result = await provider.chat(
            [{"role": "user", "content": content}],
            system_prompt=VULN_ANALYSIS_PROMPT,
            stream=False,
        )
        assert isinstance(result, str)
        return result

    async def analyze_log_anomaly(self, log_entries: list[str]) -> str:
        """Analyze log entries for anomalies and IoCs."""
        provider = await self.get_provider()
        content = "\n".join(log_entries)
        result = await provider.chat(
            [{"role": "user", "content": content}],
            system_prompt=LOG_ANALYSIS_PROMPT,
            stream=False,
        )
        assert isinstance(result, str)
        return result

    async def generate_report_summary(self, scan_results: dict) -> str:
        """Generate an executive summary from scan results."""
        provider = await self.get_provider()
        content = json.dumps(scan_results, indent=2)
        result = await provider.chat(
            [{"role": "user", "content": content}],
            system_prompt=REPORT_PROMPT,
            stream=False,
        )
        assert isinstance(result, str)
        return result

    async def suggest_remediation(self, vulnerability: dict) -> str:
        """Generate a remediation plan for a specific vulnerability."""
        provider = await self.get_provider()
        content = json.dumps(vulnerability, indent=2)
        result = await provider.chat(
            [{"role": "user", "content": content}],
            system_prompt=REMEDIATION_PROMPT,
            stream=False,
        )
        assert isinstance(result, str)
        return result

    # ------------------------------------------------------------------
    # Generic analysis (used by the /analyze endpoint)
    # ------------------------------------------------------------------

    async def analyze(self, content: str, task: str) -> str:
        """Run analysis using the task-specific system prompt."""
        provider = await self.get_provider()
        system_prompt = _TASK_PROMPTS.get(task, CYBERSECURITY_SYSTEM_PROMPT)
        result = await provider.chat(
            [{"role": "user", "content": content}],
            system_prompt=system_prompt,
            stream=False,
        )
        assert isinstance(result, str)
        return result


# Module-level singleton
ai_service = AIService()
