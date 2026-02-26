"""Report rendering utilities for CyberForge.

Provides functions to render Jinja2 HTML templates, convert HTML to PDF
via WeasyPrint, and export report data as Markdown.
"""

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=True,
)


def render_html(report_data: dict, template_name: str) -> str:
    """Render report data into an HTML string using a Jinja2 template."""
    template = _jinja_env.get_template(template_name)
    return template.render(report=report_data)


def html_to_pdf(html: str, output_path: str) -> str:
    """Convert an HTML string to a PDF file on disk.

    This is a blocking (synchronous) call -- run in a thread executor
    when called from async code.
    """
    from weasyprint import HTML

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html).write_pdf(output_path)
    logger.info("PDF written to %s", output_path)
    return output_path


def render_markdown(report_data: dict) -> str:
    """Render report data as a Markdown document."""
    lines: list[str] = []
    title = report_data.get("title", "Security Report")
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**Report Type:** {report_data.get('report_type', 'N/A')}")
    lines.append(f"**Generated:** {report_data.get('generated_at', 'N/A')}")
    lines.append(f"**Overall Risk:** {report_data.get('overall_risk', 'N/A')}")
    targets = report_data.get("targets", [])
    if targets:
        lines.append(f"**Targets:** {', '.join(targets)}")
    lines.append("")

    # Executive Summary
    summary = report_data.get("executive_summary")
    if summary:
        lines.append("## Executive Summary")
        lines.append("")
        lines.append(summary)
        lines.append("")

    # Statistics
    stats = report_data.get("statistics", {})
    if stats:
        lines.append("## Statistics")
        lines.append("")
        lines.append(f"- **Total Scans:** {stats.get('total_scans', 0)}")
        lines.append(f"- **Total Findings:** {stats.get('total_findings', 0)}")
        sev_counts = stats.get("severity_counts", {})
        for sev_name in ["critical", "high", "medium", "low", "info"]:
            count = sev_counts.get(sev_name, 0)
            lines.append(f"- **{sev_name.capitalize()}:** {count}")
        lines.append("")

    # Scan Results
    scans = report_data.get("scans", [])
    if scans:
        lines.append("## Scan Results")
        lines.append("")
        for scan in scans:
            scan_type = scan.get("scan_type", "unknown")
            target = scan.get("target", "unknown")
            lines.append(f"### {scan_type} - {target}")
            lines.append("")
            lines.append(f"- **Severity:** {scan.get('severity', 'info')}")
            lines.append(f"- **Date:** {scan.get('created_at', 'N/A')}")
            results = scan.get("results", [])
            # Normalize results: dicts get rendered as key-value summaries
            if isinstance(results, dict):
                findings_count = results.get("total_entries", results.get("anomaly_count", len(results)))
                lines.append(f"- **Findings:** {findings_count}")
                lines.append("")
                # Render dict results as a summary table
                anomalies = results.get("anomalies", [])
                if anomalies and isinstance(anomalies, list):
                    lines.append("| # | Finding | Severity |")
                    lines.append("|---|---------|----------|")
                    for idx, anom in enumerate(anomalies[:20], 1):
                        if isinstance(anom, dict):
                            reason = anom.get("reason", "Unknown")[:60]
                            asev = anom.get("severity", "info")
                        else:
                            reason = str(anom)[:60]
                            asev = "info"
                        lines.append(f"| {idx} | {reason} | {asev} |")
                    if len(anomalies) > 20:
                        lines.append(f"| ... | *{len(anomalies) - 20} more findings* | |")
                    lines.append("")
                else:
                    for k, v in list(results.items())[:10]:
                        if k not in ("anomalies", "statistics"):
                            lines.append(f"- **{k}:** {v}")
                    lines.append("")
            else:
                lines.append(f"- **Findings:** {len(results)}")
                lines.append("")
                if results:
                    lines.append("| # | Finding | Severity |")
                    lines.append("|---|---------|----------|")
                    for idx, finding in enumerate(results[:20], 1):
                        if isinstance(finding, dict):
                            name = finding.get("name", finding.get("title", finding.get("host", str(finding)[:50])))
                            fsev = finding.get("severity", finding.get("risk", "info"))
                        else:
                            name = str(finding)[:50]
                            fsev = "info"
                        lines.append(f"| {idx} | {name} | {fsev} |")
                    if len(results) > 20:
                        lines.append(f"| ... | *{len(results) - 20} more findings* | |")
                lines.append("")

    # Recommendations
    recs = report_data.get("recommendations", [])
    if recs:
        lines.append("## Recommendations")
        lines.append("")
        for rec in recs:
            priority = rec.get("priority", "Info")
            lines.append(f"### [{priority}] {rec.get('title', '')}")
            lines.append("")
            lines.append(rec.get("description", ""))
            lines.append("")

    lines.append("---")
    lines.append("*Generated by CyberForge Security Command Center*")
    return "\n".join(lines)
