export const MODELS = {
  haiku:  { id: "claude-haiku-4-5",  label: "Haiku 4.5",  tier: "cheap" },
  sonnet: { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tier: "mid" },
  opus:   { id: "claude-opus-4-7",   label: "Opus 4.7",   tier: "expensive" },
};

export const TIER_WARNINGS = {
  cheap: "",
  mid: " (~3x costlier than Haiku)",
  expensive: " (~15x costlier than Haiku — use sparingly)",
};

export function resolveModel(alias) {
  return MODELS[alias?.toLowerCase()];
}

export function aliasFor(modelId) {
  for (const [alias, m] of Object.entries(MODELS)) if (m.id === modelId) return alias;
  return null;
}
