import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';

// Runtime LLM Fallback Manager with error handling
export class RuntimeLLMFallbackManager {
  private currentProvider: any = null;
  private currentProviderName = '';
  private currentProviderIndex = 0;
  private fallbackProviders: Array = [];
  private failedProviders = new Set<string>();
  private retryDelay = 5000; // 5 seconds
  private maxRetries = 3;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize fallback providers in order of preference
    if (process.env.OPENROUTER_API_KEY) {
      this.fallbackProviders.push({
        name: 'OpenRouter',
        create: () =>
          new openai.LLM({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            model: 'anthropic/claude-3.5-sonnet',
            temperature: 0.7,
          }),
      });
    }

    if (process.env.GOOGLE_API_KEY) {
      this.fallbackProviders.push({
        name: 'Google',
        create: () =>
          new google.LLM({
            model: 'gemini-2.0-flash-exp',
            temperature: 0.7,
          }),
      });
    }

    if (process.env.OPENAI_API_KEY) {
      this.fallbackProviders.push({
        name: 'OpenAI',
        create: () =>
          new openai.LLM({
            model: 'gpt-4o',
            temperature: 0.7,
          }),
      });
    }
  }

  async getHealthyLLMProvider(): Promise {
    // Try to get a working provider
    for (let i = 0; i < this.fallbackProviders.length; i++) {
      const provider = this.fallbackProviders[i];

      // Skip if this provider has failed recently
      if (this.failedProviders.has(provider.name)) {
        continue;
      }

      try {
        const llm = provider.create();
        this.currentProvider = llm;
        this.currentProviderName = provider.name;
        this.currentProviderIndex = i;
        console.log(`✅ Using ${provider.name} LLM provider`);
        return llm;
      } catch (error) {
        console.log(`⚠️ ${provider.name} LLM failed to initialize: ${error}`);
        this.failedProviders.add(provider.name);
        continue;
      }
    }

    throw new Error('No healthy LLM providers available');
  }

  async handleLLMError(error: any): Promise {
    console.log(`❌ LLM Error with ${this.currentProviderName}: ${error.message || error}`);

    // Mark current provider as failed
    this.failedProviders.add(this.currentProviderName);

    // Try to switch to next available provider
    for (let i = this.currentProviderIndex + 1; i < this.fallbackProviders.length; i++) {
      const provider = this.fallbackProviders[i];

      if (this.failedProviders.has(provider.name)) {
        continue;
      }

      try {
        console.log(`🔄 Switching to ${provider.name} LLM provider...`);
        const llm = provider.create();
        this.currentProvider = llm;
        this.currentProviderName = provider.name;
        this.currentProviderIndex = i;
        console.log(`✅ Successfully switched to ${provider.name} LLM provider`);
        return llm;
      } catch (switchError) {
        console.log(`⚠️ Failed to switch to ${provider.name}: ${switchError}`);
        this.failedProviders.add(provider.name);
        continue;
      }
    }

    // If all providers failed, try to reset and retry
    console.log(`🔄 All providers failed, attempting to reset and retry...`);
    this.failedProviders.clear();

    try {
      return await this.getHealthyLLMProvider();
    } catch (retryError) {
      console.error(`❌ All LLM providers exhausted: ${retryError}`);
      throw new Error(
        'All LLM providers are currently unavailable. Please check your API keys and try again later.',
      );
    }
  }

  getCurrentProviderName(): string {
    return this.currentProviderName;
  }

  getAvailableProviders(): string[] {
    return this.fallbackProviders.map((p) => p.name);
  }

  getFailedProviders(): string[] {
    return Array.from(this.failedProviders);
  }

  // Reset failed providers after a delay
  async resetFailedProviders(): Promise {
    setTimeout(() => {
      console.log(`🔄 Resetting failed providers: ${Array.from(this.failedProviders).join(', ')}`);
      this.failedProviders.clear();
    }, this.retryDelay);
  }
}

// Wrapper for LLM that handles runtime fallbacks
export class FallbackLLMWrapper {
  private fallbackManager: RuntimeLLMFallbackManager;
  private currentLLM: any;

  constructor() {
    this.fallbackManager = new RuntimeLLMFallbackManager();
  }

  async initialize(): Promise {
    this.currentLLM = await this.fallbackManager.getHealthyLLMProvider();
  }

  async generate(prompt: string, options?: any): Promise {
    let attempts = 0;

    while (attempts < this.fallbackManager['maxRetries']) {
      try {
        return await this.currentLLM.generate(prompt, options);
      } catch (error) {
        attempts++;
        console.log(`🔄 LLM attempt ${attempts} failed, trying fallback...`);

        try {
          this.currentLLM = await this.fallbackManager.handleLLMError(error);
        } catch (fallbackError) {
          console.error(`❌ Fallback failed: ${fallbackError}`);
          throw fallbackError;
        }
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  async stream(prompt: string, options?: any): Promise {
    let attempts = 0;

    while (attempts < this.fallbackManager['maxRetries']) {
      try {
        return await this.currentLLM.stream(prompt, options);
      } catch (error) {
        attempts++;
        console.log(`🔄 LLM stream attempt ${attempts} failed, trying fallback...`);

        try {
          this.currentLLM = await this.fallbackManager.handleLLMError(error);
        } catch (fallbackError) {
          console.error(`❌ Fallback failed: ${fallbackError}`);
          throw fallbackError;
        }
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  getCurrentProviderName(): string {
    return this.fallbackManager.getCurrentProviderName();
  }

  getAvailableProviders(): string[] {
    return this.fallbackManager.getAvailableProviders();
  }

  getFailedProviders(): string[] {
    return this.fallbackManager.getFailedProviders();
  }
}
