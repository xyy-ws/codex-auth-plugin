import {
  emptyPluginConfigSchema,
  type OpenClawPluginApi,
  type ProviderAuthContext,
  type ProviderAuthResult,
} from "openclaw/plugin-sdk";
import { loginOpenAICodex } from "/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/node_modules/@mariozechner/pi-ai/dist/index.js";
import { chooseProfileCandidates } from "./profile-selector.mjs";

const PROVIDER_ID = "openai-codex";

async function runOAuth(ctx: ProviderAuthContext): Promise<ProviderAuthResult> {
  const configProfileIds = Object.keys((ctx.config as { auth?: { profiles?: Record<string, unknown> } })?.auth?.profiles ?? {});
  const candidates = chooseProfileCandidates(configProfileIds);
  if (candidates.length === 0) {
    throw new Error("No openai-codex auth profiles are configured.");
  }

  let selectedProfileId = candidates[0];
  if (candidates.length > 1) {
    await ctx.prompter.note(
      candidates.map((id, i) => `${i + 1}. ${id}`).join("\n"),
      "Choose target auth profile",
    );
    const rawChoice = (await ctx.prompter.text({
      message: "Enter the profile number or full profile id",
      initialValue: candidates[0],
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "A profile selection is required.";
        if (candidates.includes(trimmed)) return undefined;
        const n = Number(trimmed);
        if (Number.isInteger(n) && n >= 1 && n <= candidates.length) return undefined;
        return `Choose 1-${candidates.length} or one of: ${candidates.join(", ")}`;
      },
    })).trim();

    const n = Number(rawChoice);
    selectedProfileId = Number.isInteger(n) && n >= 1 && n <= candidates.length ? candidates[n - 1] : rawChoice;
    if (!candidates.includes(selectedProfileId)) {
      throw new Error(`Invalid profile selection: ${selectedProfileId}`);
    }
  }

  const progress = ctx.prompter.progress(`Starting OpenAI Codex OAuth for ${selectedProfileId}…`);
  try {
    const oauthHandlers = ctx.oauth.createVpsAwareHandlers({
      isRemote: ctx.isRemote,
      runtime: ctx.runtime,
      prompter: ctx.prompter,
      openUrl: ctx.openUrl,
      spin: progress,
      localBrowserMessage: "Opening ChatGPT OAuth in your browser…",
      manualPromptMessage: "Paste the redirect URL (or authorization code)",
    });

    const creds = await loginOpenAICodex({
      onAuth: oauthHandlers.onAuth,
      onPrompt: oauthHandlers.onPrompt,
      onProgress: (message) => progress.update(message),
    });

    progress.stop("OpenAI Codex OAuth complete");

    return {
      profiles: [
        {
          profileId: selectedProfileId,
          credential: {
            type: "oauth",
            provider: PROVIDER_ID,
            access: creds.access,
            refresh: creds.refresh,
            expires: creds.expires,
            accountId: creds.accountId,
          },
        },
      ],
      notes: [`OAuth profile saved as ${selectedProfileId}`],
    };
  } catch (error) {
    progress.stop("OpenAI Codex OAuth failed");
    throw error;
  }
}

const plugin = {
  id: "openai-codex-auth-plugin",
  name: "OpenAI Codex OAuth",
  description: "Provider auth plugin for openai-codex",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "OpenAI Codex",
      aliases: ["codex", "chatgpt"],
      docsPath: "/providers/openai-codex",
      auth: [
        {
          id: "oauth",
          label: "ChatGPT OAuth",
          hint: "Login with ChatGPT Plus/Pro account",
          kind: "oauth_pkce",
          run: runOAuth,
        },
      ],
    });
  },
};

export default plugin;
