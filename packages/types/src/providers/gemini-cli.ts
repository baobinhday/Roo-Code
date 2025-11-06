import type { ModelInfo } from "../model.js"

// Gemini CLI models - using the same models as regular Gemini
// but accessed through the @google/gemini-cli-core library
export type GeminiCliModelId = keyof typeof geminiCliModels

export const geminiCliDefaultModelId: GeminiCliModelId = "gemini-2.5-flash"

// Re-use the same model definitions as regular Gemini since they're the same models
// just accessed through a different authentication mechanism (OAuth via CLI)
export const geminiCliModels = {
	"gemini-2.5-flash-preview-09-2025:thinking": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 3.5,
		maxThinkingTokens: 24_576,
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
	},
	"gemini-2.5-flash-preview-09-2025": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
	},
	"gemini-2.5-flash-preview-05-20:thinking": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.15,
		outputPrice: 3.5,
		cacheReadsPrice: 0.0375,
		cacheWritesPrice: 1.0,
		maxThinkingTokens: 24_576,
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
	},
	"gemini-2.5-flash-preview-05-20": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.15,
		outputPrice: 0.6,
		cacheReadsPrice: 0.0375,
		cacheWritesPrice: 1.0,
	},
	"gemini-2.5-flash": {
		maxTokens: 64_000,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.3,
		outputPrice: 2.5,
		cacheReadsPrice: 0.075,
		cacheWritesPrice: 1.0,
		maxThinkingTokens: 24_576,
		supportsReasoningBudget: true,
	},
	"gemini-2.5-pro": {
		maxTokens: 64_000,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 2.5,
		outputPrice: 15,
		cacheReadsPrice: 0.625,
		cacheWritesPrice: 4.5,
		maxThinkingTokens: 32_768,
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 1.25,
				outputPrice: 10,
				cacheReadsPrice: 0.31,
			},
			{
				contextWindow: Infinity,
				inputPrice: 2.5,
				outputPrice: 15,
				cacheReadsPrice: 0.625,
			},
		],
	},
	"gemini-2.0-flash-exp": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
} as const satisfies Record<string, ModelInfo>
