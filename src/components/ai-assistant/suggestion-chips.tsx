import { motion } from "framer-motion";
import { Shield, Bug, FileText, Wrench, Search, AlertTriangle } from "lucide-react";

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

const suggestions = [
  {
    text: "Explain CVE-2024-3094 (xz backdoor)",
    icon: Bug,
  },
  {
    text: "Analyze suspicious auth logs for brute force patterns",
    icon: Search,
  },
  {
    text: "Write a remediation plan for open SSH ports",
    icon: Wrench,
  },
  {
    text: "Security best practices for hardening a Linux server",
    icon: Shield,
  },
  {
    text: "Generate an executive security summary report",
    icon: FileText,
  },
  {
    text: "Identify common indicators of compromise in web server logs",
    icon: AlertTriangle,
  },
];

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(suggestion.text)}
          className="glass-card flex flex-shrink-0 items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:text-accent"
        >
          <suggestion.icon className="h-3.5 w-3.5 flex-shrink-0 text-accent/60" />
          <span className="whitespace-nowrap">{suggestion.text}</span>
        </motion.button>
      ))}
    </div>
  );
}
