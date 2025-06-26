import { ApiHandlerOptions } from "../../shared/api"
import { ContextProxy } from "../../core/config/ContextProxy"
import { EmbedderProvider } from "./interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "./interfaces/config"
import { SEARCH_MIN_SCORE } from "./constants"
import { getDefaultModelId, getModelDimension } from "../../shared/embeddingModels"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager {
	private isEnabled: boolean = false
	private embedderProvider: EmbedderProvider = "openai"
	private modelId?: string
	private openAiOptions?: ApiHandlerOptions
	private ollamaOptions?: ApiHandlerOptions
	private openAiCompatibleOptions?: { baseUrl: string; apiKey: string; modelDimension?: number }
	private qdrantUrl?: string = "http://localhost:6333"
	private qdrantApiKey?: string
	private searchMinScore?: number

	constructor(private readonly contextProxy: ContextProxy) {
		// Initialize with current configuration to avoid false restart triggers
		this._loadAndSetConfiguration()
	}

	/**
	 * Gets the context proxy instance
	 */
	public getContextProxy(): ContextProxy {
		return this.contextProxy
	}

	/**
	 * Reads a secret directly from VSCode secret storage (async)
	 */
	private async getSecretAsync(key: string): Promise<string | undefined> {
		try {
			// Access VSCode context through ContextProxy
			const context = this.contextProxy.getVSCodeContext()
			const value = await context.secrets.get(key)
			console.log(
				`[DEBUG ConfigManager] getSecretAsync(${key}): ${value ? `"${value.substring(0, 4)}..."` : "undefined"}`,
			)
			return value
		} catch (error) {
			console.error(`[ERROR ConfigManager] Failed to get secret ${key}:`, error)
			return undefined
		}
	}

	/**
	 * Stores a secret directly to VSCode secret storage (async)
	 */
	private async storeSecretAsync(key: string, value: string | undefined): Promise<void> {
		try {
			console.log(
				`[DEBUG ConfigManager] storeSecretAsync(${key}): ${value ? `"${value.substring(0, 4)}..."` : "undefined"}`,
			)

			const context = this.contextProxy.getVSCodeContext()
			if (value === undefined || value === "") {
				await context.secrets.delete(key)
				console.log(`[DEBUG ConfigManager] Deleted secret ${key}`)
			} else {
				await context.secrets.store(key, value)
				console.log(`[DEBUG ConfigManager] Stored secret ${key}`)
			}
		} catch (error) {
			console.error(`[ERROR ConfigManager] Failed to store secret ${key}:`, error)
			throw error
		}
	}

	/**
	 * Loads all code index secrets asynchronously
	 */
	public async loadSecretsAsync(): Promise<{
		openAiKey?: string
		qdrantApiKey?: string
		openAiCompatibleApiKey?: string
	}> {
		console.log(`[DEBUG ConfigManager] Loading secrets asynchronously`)

		const [openAiKey, qdrantApiKey, openAiCompatibleApiKey] = await Promise.all([
			this.getSecretAsync("codeIndexOpenAiKey"),
			this.getSecretAsync("codeIndexQdrantApiKey"),
			this.getSecretAsync("codebaseIndexOpenAiCompatibleApiKey"),
		])

		console.log(`[DEBUG ConfigManager] Loaded async secrets:`)
		console.log(
			`[DEBUG ConfigManager] - OpenAI key: ${openAiKey ? `"${openAiKey.substring(0, 4)}..."` : "undefined"}`,
		)
		console.log(
			`[DEBUG ConfigManager] - Qdrant API key: ${qdrantApiKey ? `"${qdrantApiKey.substring(0, 4)}..."` : "undefined"}`,
		)
		console.log(
			`[DEBUG ConfigManager] - OpenAI Compatible API key: ${openAiCompatibleApiKey ? `"${openAiCompatibleApiKey.substring(0, 4)}..."` : "undefined"}`,
		)

		return {
			openAiKey,
			qdrantApiKey,
			openAiCompatibleApiKey,
		}
	}

	/**
	 * Stores all code index secrets asynchronously
	 */
	public async storeSecretsAsync(secrets: {
		openAiKey?: string
		qdrantApiKey?: string
		openAiCompatibleApiKey?: string
	}): Promise<void> {
		console.log(`[DEBUG ConfigManager] Storing secrets asynchronously`)

		const promises: Promise<void>[] = []

		if (secrets.openAiKey !== undefined) {
			promises.push(this.storeSecretAsync("codeIndexOpenAiKey", secrets.openAiKey))
		}

		if (secrets.qdrantApiKey !== undefined) {
			promises.push(this.storeSecretAsync("codeIndexQdrantApiKey", secrets.qdrantApiKey))
		}

		if (secrets.openAiCompatibleApiKey !== undefined) {
			promises.push(this.storeSecretAsync("codebaseIndexOpenAiCompatibleApiKey", secrets.openAiCompatibleApiKey))
		}

		await Promise.all(promises)
		console.log(`[DEBUG ConfigManager] All secrets stored successfully`)
	}

	/**
	 * Async version of _loadAndSetConfiguration that reads secrets directly from VSCode storage
	 */
	private async _loadAndSetConfigurationAsync(): Promise<void> {
		console.log(`[DEBUG ConfigManager] Loading configuration asynchronously`)

		// Load configuration from storage (global state is still synchronous)
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {
			codebaseIndexEnabled: false,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexSearchMinScore: 0.4,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
		} = codebaseIndexConfig

		// Load secrets asynchronously - this is the key fix!
		const secrets = await this.loadSecretsAsync()
		const openAiKey = secrets.openAiKey ?? ""
		const qdrantApiKey = secrets.qdrantApiKey ?? ""
		const openAiCompatibleApiKey = secrets.openAiCompatibleApiKey ?? ""

		// Load other global state values
		const openAiCompatibleBaseUrl = this.contextProxy?.getGlobalState("codebaseIndexOpenAiCompatibleBaseUrl") ?? ""
		const openAiCompatibleModelDimension = this.contextProxy?.getGlobalState(
			"codebaseIndexOpenAiCompatibleModelDimension",
		) as number | undefined

		// Update instance variables with configuration
		this.isEnabled = codebaseIndexEnabled || false
		this.qdrantUrl = codebaseIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.openAiOptions = { openAiNativeApiKey: openAiKey }
		this.searchMinScore = SEARCH_MIN_SCORE

		console.log(
			`[DEBUG ConfigManager] Set async openAiOptions.openAiNativeApiKey to: ${this.openAiOptions.openAiNativeApiKey ? `"${this.openAiOptions.openAiNativeApiKey.substring(0, 4)}..."` : "undefined"}`,
		)

		// Set embedder provider with support for openai-compatible
		if (codebaseIndexEmbedderProvider === "ollama") {
			this.embedderProvider = "ollama"
		} else if (codebaseIndexEmbedderProvider === "openai-compatible") {
			this.embedderProvider = "openai-compatible"
		} else {
			this.embedderProvider = "openai"
		}

		this.modelId = codebaseIndexEmbedderModelId || undefined

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
		}

		this.openAiCompatibleOptions =
			openAiCompatibleBaseUrl && openAiCompatibleApiKey
				? {
						baseUrl: openAiCompatibleBaseUrl,
						apiKey: openAiCompatibleApiKey,
						modelDimension: openAiCompatibleModelDimension,
					}
				: undefined

		console.log(
			`[DEBUG ConfigManager] Async configuration loaded - enabled: ${this.isEnabled}, provider: ${this.embedderProvider}`,
		)
	}

	/**
	 * Private method that handles loading configuration from storage and updating instance variables.
	 * This eliminates code duplication between initializeWithCurrentConfig() and loadConfiguration().
	 */
	private _loadAndSetConfiguration(): void {
		console.log(`[DEBUG ConfigManager] Loading configuration from storage`)

		// Load configuration from storage
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {
			codebaseIndexEnabled: false,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexSearchMinScore: 0.4,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""
		const openAiCompatibleBaseUrl = this.contextProxy?.getGlobalState("codebaseIndexOpenAiCompatibleBaseUrl") ?? ""
		const openAiCompatibleApiKey = this.contextProxy?.getSecret("codebaseIndexOpenAiCompatibleApiKey") ?? ""
		const openAiCompatibleModelDimension = this.contextProxy?.getGlobalState(
			"codebaseIndexOpenAiCompatibleModelDimension",
		) as number | undefined

		console.log(`[DEBUG ConfigManager] Loaded secrets from ContextProxy:`)
		console.log(
			`[DEBUG ConfigManager] - OpenAI key: ${openAiKey ? `"${openAiKey.substring(0, 4)}..."` : "undefined"}`,
		)
		console.log(
			`[DEBUG ConfigManager] - Qdrant API key: ${qdrantApiKey ? `"${qdrantApiKey.substring(0, 4)}..."` : "undefined"}`,
		)
		console.log(
			`[DEBUG ConfigManager] - OpenAI Compatible API key: ${openAiCompatibleApiKey ? `"${openAiCompatibleApiKey.substring(0, 4)}..."` : "undefined"}`,
		)

		// Update instance variables with configuration
		this.isEnabled = codebaseIndexEnabled || false
		this.qdrantUrl = codebaseIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.openAiOptions = { openAiNativeApiKey: openAiKey }
		this.searchMinScore = SEARCH_MIN_SCORE

		console.log(
			`[DEBUG ConfigManager] Set openAiOptions.openAiNativeApiKey to: ${this.openAiOptions.openAiNativeApiKey ? `"${this.openAiOptions.openAiNativeApiKey.substring(0, 4)}..."` : "undefined"}`,
		)

		// Set embedder provider with support for openai-compatible
		if (codebaseIndexEmbedderProvider === "ollama") {
			this.embedderProvider = "ollama"
		} else if (codebaseIndexEmbedderProvider === "openai-compatible") {
			this.embedderProvider = "openai-compatible"
		} else {
			this.embedderProvider = "openai"
		}

		this.modelId = codebaseIndexEmbedderModelId || undefined

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
		}

		this.openAiCompatibleOptions =
			openAiCompatibleBaseUrl && openAiCompatibleApiKey
				? {
						baseUrl: openAiCompatibleBaseUrl,
						apiKey: openAiCompatibleApiKey,
						modelDimension: openAiCompatibleModelDimension,
					}
				: undefined
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<{
		configSnapshot: PreviousConfigSnapshot
		currentConfig: {
			isEnabled: boolean
			isConfigured: boolean
			embedderProvider: EmbedderProvider
			modelId?: string
			openAiOptions?: ApiHandlerOptions
			ollamaOptions?: ApiHandlerOptions
			openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
			qdrantUrl?: string
			qdrantApiKey?: string
			searchMinScore?: number
		}
		requiresRestart: boolean
	}> {
		// Capture the ACTUAL previous state before loading new configuration
		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.isEnabled,
			configured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			openAiKey: this.openAiOptions?.openAiNativeApiKey ?? "",
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl ?? "",
			openAiCompatibleBaseUrl: this.openAiCompatibleOptions?.baseUrl ?? "",
			openAiCompatibleApiKey: this.openAiCompatibleOptions?.apiKey ?? "",
			openAiCompatibleModelDimension: this.openAiCompatibleOptions?.modelDimension,
			qdrantUrl: this.qdrantUrl ?? "",
			qdrantApiKey: this.qdrantApiKey ?? "",
		}

		// Load new configuration from storage and update instance variables
		// Use async version to get fresh secrets from VSCode storage
		await this._loadAndSetConfigurationAsync()

		const requiresRestart = this.doesConfigChangeRequireRestart(previousConfigSnapshot)

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isEnabled: this.isEnabled,
				isConfigured: this.isConfigured(),
				embedderProvider: this.embedderProvider,
				modelId: this.modelId,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				openAiCompatibleOptions: this.openAiCompatibleOptions,
				qdrantUrl: this.qdrantUrl,
				qdrantApiKey: this.qdrantApiKey,
				searchMinScore: this.searchMinScore,
			},
			requiresRestart,
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 */
	public isConfigured(): boolean {
		console.log(`[DEBUG ConfigManager] Checking if configured for provider: ${this.embedderProvider}`)

		if (this.embedderProvider === "openai") {
			const openAiKey = this.openAiOptions?.openAiNativeApiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(openAiKey && qdrantUrl)
			console.log(
				`[DEBUG ConfigManager] OpenAI config check: key=${openAiKey ? `"${openAiKey.substring(0, 4)}..."` : "undefined"}, url=${qdrantUrl}, configured=${isConfigured}`,
			)
			return isConfigured
		} else if (this.embedderProvider === "ollama") {
			// Ollama model ID has a default, so only base URL is strictly required for config
			const ollamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(ollamaBaseUrl && qdrantUrl)
			console.log(
				`[DEBUG ConfigManager] Ollama config check: baseUrl=${ollamaBaseUrl}, url=${qdrantUrl}, configured=${isConfigured}`,
			)
			return isConfigured
		} else if (this.embedderProvider === "openai-compatible") {
			const baseUrl = this.openAiCompatibleOptions?.baseUrl
			const apiKey = this.openAiCompatibleOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(baseUrl && apiKey && qdrantUrl)
			console.log(
				`[DEBUG ConfigManager] OpenAI Compatible config check: baseUrl=${baseUrl}, key=${apiKey ? `"${apiKey.substring(0, 4)}..."` : "undefined"}, url=${qdrantUrl}, configured=${isConfigured}`,
			)
			return isConfigured
		}
		console.log(`[DEBUG ConfigManager] Unknown provider, returning false`)
		return false // Should not happen if embedderProvider is always set correctly
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 */
	doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured()

		// Handle null/undefined values safely - use empty strings for consistency with loaded config
		const prevEnabled = prev?.enabled ?? false
		const prevConfigured = prev?.configured ?? false
		const prevProvider = prev?.embedderProvider ?? "openai"
		const prevModelId = prev?.modelId ?? undefined
		const prevOpenAiKey = prev?.openAiKey ?? ""
		const prevOllamaBaseUrl = prev?.ollamaBaseUrl ?? ""
		const prevOpenAiCompatibleBaseUrl = prev?.openAiCompatibleBaseUrl ?? ""
		const prevOpenAiCompatibleApiKey = prev?.openAiCompatibleApiKey ?? ""
		const prevOpenAiCompatibleModelDimension = prev?.openAiCompatibleModelDimension
		const prevQdrantUrl = prev?.qdrantUrl ?? ""
		const prevQdrantApiKey = prev?.qdrantApiKey ?? ""

		// 1. Transition from disabled/unconfigured to enabled+configured
		if ((!prevEnabled || !prevConfigured) && this.isEnabled && nowConfigured) {
			return true
		}

		// 2. If was disabled and still is, no restart needed
		if (!prevEnabled && !this.isEnabled) {
			return false
		}

		// 3. If wasn't ready before and isn't ready now, no restart needed
		if (!prevConfigured && !nowConfigured) {
			return false
		}

		// 4. Check for changes in relevant settings if the feature is enabled (or was enabled)
		if (this.isEnabled || prevEnabled) {
			// Provider change
			if (prevProvider !== this.embedderProvider) {
				return true
			}

			if (this._hasVectorDimensionChanged(prevProvider, prevModelId)) {
				return true
			}

			// Authentication changes
			if (this.embedderProvider === "openai") {
				const currentOpenAiKey = this.openAiOptions?.openAiNativeApiKey ?? ""
				if (prevOpenAiKey !== currentOpenAiKey) {
					return true
				}
			}

			if (this.embedderProvider === "ollama") {
				const currentOllamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl ?? ""
				if (prevOllamaBaseUrl !== currentOllamaBaseUrl) {
					return true
				}
			}

			if (this.embedderProvider === "openai-compatible") {
				const currentOpenAiCompatibleBaseUrl = this.openAiCompatibleOptions?.baseUrl ?? ""
				const currentOpenAiCompatibleApiKey = this.openAiCompatibleOptions?.apiKey ?? ""
				const currentOpenAiCompatibleModelDimension = this.openAiCompatibleOptions?.modelDimension
				if (
					prevOpenAiCompatibleBaseUrl !== currentOpenAiCompatibleBaseUrl ||
					prevOpenAiCompatibleApiKey !== currentOpenAiCompatibleApiKey ||
					prevOpenAiCompatibleModelDimension !== currentOpenAiCompatibleModelDimension
				) {
					return true
				}
			}

			// Qdrant configuration changes
			const currentQdrantUrl = this.qdrantUrl ?? ""
			const currentQdrantApiKey = this.qdrantApiKey ?? ""

			if (prevQdrantUrl !== currentQdrantUrl || prevQdrantApiKey !== currentQdrantApiKey) {
				return true
			}
		}

		return false
	}

	/**
	 * Checks if model changes result in vector dimension changes that require restart.
	 */
	private _hasVectorDimensionChanged(prevProvider: EmbedderProvider, prevModelId?: string): boolean {
		const currentProvider = this.embedderProvider
		const currentModelId = this.modelId ?? getDefaultModelId(currentProvider)
		const resolvedPrevModelId = prevModelId ?? getDefaultModelId(prevProvider)

		// If model IDs are the same and provider is the same, no dimension change
		if (prevProvider === currentProvider && resolvedPrevModelId === currentModelId) {
			return false
		}

		// Get vector dimensions for both models
		const prevDimension = getModelDimension(prevProvider, resolvedPrevModelId)
		const currentDimension = getModelDimension(currentProvider, currentModelId)

		// If we can't determine dimensions, be safe and restart
		if (prevDimension === undefined || currentDimension === undefined) {
			return true
		}

		// Only restart if dimensions actually changed
		return prevDimension !== currentDimension
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isEnabled: this.isEnabled,
			isConfigured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			openAiCompatibleOptions: this.openAiCompatibleOptions,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
			searchMinScore: this.searchMinScore,
		}
	}

	/**
	 * Gets whether the code indexing feature is enabled
	 */
	public get isFeatureEnabled(): boolean {
		return this.isEnabled
	}

	/**
	 * Gets whether the code indexing feature is properly configured
	 */
	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Gets the current embedder type (openai or ollama)
	 */
	public get currentEmbedderProvider(): EmbedderProvider {
		return this.embedderProvider
	}

	/**
	 * Gets the current Qdrant configuration
	 */
	public get qdrantConfig(): { url?: string; apiKey?: string } {
		return {
			url: this.qdrantUrl,
			apiKey: this.qdrantApiKey,
		}
	}

	/**
	 * Gets the current model ID being used for embeddings.
	 */
	public get currentModelId(): string | undefined {
		return this.modelId
	}

	/**
	 * Gets the configured minimum search score.
	 */
	public get currentSearchMinScore(): number | undefined {
		return this.searchMinScore
	}
}
