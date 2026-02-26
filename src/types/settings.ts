export interface ApiKeyInfo {
  service: string;
  key_hint: string;
  created_at: string;
  configured: boolean;
}

export interface ApiKeyStatus {
  service: string;
  configured: boolean;
}

export interface ApiKeyStore {
  service: string;
  key: string;
}

export interface AppSettings {
  ai_provider: string;
  ai_model: string;
  theme: string;
  scan_timeout: number;
}

export interface SettingsUpdate {
  key: string;
  value: string | number | boolean;
}

export interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  docsUrl: string;
}

export const SUPPORTED_SERVICES: ServiceInfo[] = [
  {
    id: 'shodan',
    name: 'Shodan',
    description: 'Internet-connected device search engine for network reconnaissance.',
    icon: 'Search',
    docsUrl: 'https://developer.shodan.io/',
  },
  {
    id: 'virustotal',
    name: 'VirusTotal',
    description: 'Multi-engine malware scanning and URL/domain analysis.',
    icon: 'Shield',
    docsUrl: 'https://docs.virustotal.com/reference/overview',
  },
  {
    id: 'hibp',
    name: 'Have I Been Pwned',
    description: 'Breach database for checking compromised email addresses.',
    icon: 'AlertTriangle',
    docsUrl: 'https://haveibeenpwned.com/API/v3',
  },
  {
    id: 'abuseipdb',
    name: 'AbuseIPDB',
    description: 'IP address abuse reporting and reputation checking.',
    icon: 'Ban',
    docsUrl: 'https://docs.abuseipdb.com/',
  },
  {
    id: 'otx',
    name: 'AlienVault OTX',
    description: 'Open threat exchange for community-driven threat intelligence.',
    icon: 'Radar',
    docsUrl: 'https://otx.alienvault.com/api',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models for AI-powered security analysis.',
    icon: 'Bot',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models for AI-powered security analysis.',
    icon: 'Brain',
    docsUrl: 'https://docs.anthropic.com/en/docs/welcome',
  },
];

export const AI_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
  },
  {
    id: 'ollama',
    name: 'Local (Ollama)',
    models: [
      { id: 'llama3', name: 'Llama 3' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'codellama', name: 'Code Llama' },
    ],
  },
];
