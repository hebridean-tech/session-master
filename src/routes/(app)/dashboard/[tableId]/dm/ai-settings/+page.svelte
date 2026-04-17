<script lang="ts">
  import { page } from '$app/stores';

  let { data } = $props();
  const tableId = $derived($page.params.tableId);
  const s = $derived(data.settings as any);
  const safe_settings = $derived(s ? { ...s, tableId } : null);

  // State
  let aiEnabled = $state(s?.aiEnabled ?? false);
  let providerType = $state<'hosted_api' | 'lm_studio' | 'ollama'>(s?.providerType ?? 'hosted_api');
  let hostedProvider = $state(s?.hostedProvider ?? 'openai');
  let endpointUrl = $state(s?.endpointUrl ?? '');
  let apiKey = $state('');
  let modelName = $state(s?.modelName ?? '');
  let permissionLevel = $state(s?.permissionLevel ?? 0);
  let runMode = $state<'manual' | 'event_triggered' | 'scheduled'>(s?.runMode ?? 'manual');
  let frequency = $state<'conservative' | 'normal' | 'aggressive'>(s?.frequency ?? 'normal');
  let previewBeforeSave = $state(s?.previewBeforeSave ?? true);
  let aiInventorySuggestions = $state(s?.aiInventorySuggestions ?? true);
  let onNoteUpload = $state(s?.onNoteUpload ?? false);
  let onRequestSubmit = $state(s?.onRequestSubmit ?? false);
  let onRequestResolve = $state(s?.onRequestResolve ?? false);
  let dailyDigestTime = $state(s?.dailyDigestTime ?? '08:00');
  let weeklySummaryDay = $state(s?.weeklySummaryDay ?? 'monday');
  let showApiKey = $state(false);
  let detectedModels = $state<string[]>([]);
  let connStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let connMessage = $state('');
  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let errorMessage = $state('');
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  function getDefaultEndpoint(): string {
    if (hostedProvider === 'openai') return 'https://api.openai.com/v1';
    if (hostedProvider === 'zai') return 'https://api.z.ai/api/coding/paas/v4';
    if (hostedProvider === 'anthropic') return 'https://api.anthropic.com/v1';
    if (hostedProvider === 'google') return 'https://generativelanguage.googleapis.com/v1';
    return '';
  }

  async function save() {
    saveStatus = 'saving';
    errorMessage = '';
    try {
      const res = await fetch(`/api/ai/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          aiEnabled,
          providerType,
          hostedProvider: providerType === 'hosted_api' ? hostedProvider : null,
          endpointUrl: endpointUrl || null,
          apiKey: apiKey || null,
          modelName,
          permissionLevel,
          runMode,
          frequency,
          previewBeforeSave,
          aiInventorySuggestions,
          onNoteUpload,
          onRequestSubmit,
          onRequestResolve,
          dailyDigestTime,
          weeklySummaryDay,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      saveStatus = 'saved';
      setTimeout(() => { saveStatus = 'idle'; }, 2000);
    } catch (e: any) {
      saveStatus = 'error';
      errorMessage = e.message || 'Failed to save settings';
    }
  }

  async function detectModelsClick() {
    if (!endpointUrl) return;
    try {
      const res = await fetch('/api/ai/detect-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, endpointUrl, providerType }),
      });
      const data = await res.json();
      detectedModels = data.models || [];
    } catch { detectedModels = []; }
  }

  async function testConnection() {
    connStatus = 'testing';
    connMessage = '';
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, endpointUrl, apiKey, modelName, providerType }),
      });
      const data = await res.json();
      if (data.success) {
        connStatus = 'success';
        connMessage = 'Connected successfully';
      } else {
        connStatus = 'error';
        connMessage = data.error || 'Connection failed';
      }
    } catch (e: any) {
      connStatus = 'error';
      connMessage = e.message || 'Connection failed';
    }
  }
</script>

<div class="p-8">
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-stone-100">AI Settings</h1>
      <button onclick={save} disabled={saveStatus === 'saving'} class="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm rounded">
        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>

    {#if saveStatus === 'error'}
      <div class="bg-red-900/30 border border-red-800 rounded p-3 text-red-300 text-sm">{errorMessage}</div>
    {/if}

    <!-- Master Toggle -->
    <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-stone-100 font-semibold">AI Integration</h2>
          <p class="text-stone-500 text-sm mt-0.5">Enable AI features for this table</p>
        </div>
        <button
          onclick={() => { aiEnabled = !aiEnabled; if (aiEnabled && !endpointUrl) endpointUrl = getDefaultEndpoint(); }}
          class="relative w-14 h-7 rounded-full transition-colors {aiEnabled ? 'bg-amber-600' : 'bg-stone-700'}"
        >
          <span class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform {aiEnabled ? 'translate-x-7' : ''}"></span>
        </button>
      </div>
      <p class="text-stone-400 text-xs mt-2">{aiEnabled ? 'AI features are enabled for this table.' : 'All AI features are disabled.'}</p>
    </div>

    <div class="space-y-6 {!aiEnabled ? 'opacity-40 pointer-events-none' : ''}">

      <!-- Provider Connection -->
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-amber-400 mb-4">⚡ Provider Connection</h2>

        <!-- Provider Type Segmented Control -->
        <div class="flex bg-stone-800 rounded p-1 mb-4">
          {#each [
            { value: 'hosted_api', label: 'Hosted API' },
            { value: 'lm_studio', label: 'LM Studio' },
            { value: 'ollama', label: 'Ollama' },
          ] as opt}
            <button
              onclick={() => { providerType = opt.value as any; endpointUrl = ''; connStatus = 'idle'; detectedModels = []; }}
              class="flex-1 py-2 text-sm rounded transition-colors {providerType === opt.value ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>

        <!-- Hosted API options -->
        {#if providerType === 'hosted_api'}
          <div class="space-y-3">
            <div>
              <label class="text-stone-400 text-xs block mb-1">Provider</label>
              <select bind:value={hostedProvider} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm">
                <option value="openai">OpenAI</option>
                <option value="zai">z.ai</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </div>
            {#if hostedProvider === 'custom'}
              <div>
                <label class="text-stone-400 text-xs block mb-1">Endpoint URL</label>
                <input bind:value={endpointUrl} placeholder="https://your-api.example.com/v1" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
              </div>
            {/if}
            <div>
              <label class="text-stone-400 text-xs block mb-1">API Key</label>
              <div class="relative">
                <input bind:value={apiKey} type={showApiKey ? 'text' : 'password'} placeholder={safe_settings?.apiKeyRef ? 'Leave blank to keep current key' : 'sk-...'} class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm pr-20" />
                <button onclick={() => showApiKey = !showApiKey} class="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs">{showApiKey ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div>
              <label class="text-stone-400 text-xs block mb-1">Model Name</label>
              <input bind:value={modelName} placeholder="gpt-4o-mini" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        {/if}

        <!-- LM Studio -->
        {#if providerType === 'lm_studio'}
          <div class="space-y-3">
            <div>
              <label class="text-stone-400 text-xs block mb-1">Endpoint URL</label>
              <input bind:value={endpointUrl} placeholder="http://localhost:1234/v1" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-stone-400 text-xs block mb-1">Model Name</label>
              <div class="flex gap-2">
                <input bind:value={modelName} placeholder="e.g. llama-3.2-1b" class="flex-1 bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
                <button onclick={detectModelsClick} class="px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs rounded whitespace-nowrap">Auto-detect</button>
              </div>
              {#if detectedModels.length > 0}
                <div class="mt-2 flex flex-wrap gap-1">
                  {#each detectedModels.slice(0, 8) as m}
                    <button onclick={() => modelName = m} class="px-2 py-1 text-xs rounded {modelName === m ? 'bg-amber-700 text-amber-100' : 'bg-stone-800 text-stone-400 hover:text-stone-200'}">{m}</button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Ollama -->
        {#if providerType === 'ollama'}
          <div class="space-y-3">
            <div>
              <label class="text-stone-400 text-xs block mb-1">Endpoint URL</label>
              <input bind:value={endpointUrl} placeholder="http://localhost:11434" class="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-stone-400 text-xs block mb-1">Model Name</label>
              <div class="flex gap-2">
                <input bind:value={modelName} placeholder="e.g. llama3.2" class="flex-1 bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
                <button onclick={detectModelsClick} class="px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs rounded whitespace-nowrap">Auto-detect</button>
              </div>
              {#if detectedModels.length > 0}
                <div class="mt-2 flex flex-wrap gap-1">
                  {#each detectedModels.slice(0, 8) as m}
                    <button onclick={() => modelName = m} class="px-2 py-1 text-xs rounded {modelName === m ? 'bg-amber-700 text-amber-100' : 'bg-stone-800 text-stone-400 hover:text-stone-200'}">{m}</button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Test Connection -->
        <div class="flex items-center gap-3 mt-4 pt-3 border-t border-stone-700">
          <button onclick={testConnection} disabled={connStatus === 'testing'} class="px-3 py-2 bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-stone-200 text-sm rounded">
            {connStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
          <span class="text-sm flex items-center gap-1.5">
            {#if connStatus === 'idle'}
              <span class="w-2 h-2 rounded-full bg-stone-600 inline-block"></span>
              <span class="text-stone-500">Not tested</span>
            {:else if connStatus === 'success'}
              <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              <span class="text-green-400">{connMessage}</span>
            {:else if connStatus === 'error'}
              <span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              <span class="text-red-400">{connMessage}</span>
            {/if}
          </span>
        </div>
      </div>

      <!-- Permission Level -->
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-amber-400 mb-4">🛡 Permission Level</h2>
        <div class="space-y-2">
          {#each [
            { level: 0, label: 'Off', desc: 'All AI features disabled regardless of other settings' },
            { level: 1, label: 'Notes & Summaries', desc: 'AI can generate session summaries and help with note organization' },
            { level: 2, label: '+ Organizational Assistant', desc: 'AI can assist with inventory management, downtime planning, and campaign organization' },
            { level: 3, label: '+ DM Co-pilot', desc: 'AI can suggest rulings, help balance encounters, and provide DM guidance' },
          ] as opt}
            <label class="flex items-start gap-3 p-3 rounded cursor-pointer hover:bg-stone-800 {permissionLevel === opt.level ? 'bg-stone-800 ring-1 ring-amber-600/40' : ''}">
              <input type="radio" name="permission" bind:group={permissionLevel} value={opt.level} class="mt-1 accent-amber-600" />
              <div>
                <span class="text-stone-200 text-sm font-medium">{opt.label}</span>
                <p class="text-stone-500 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          {/each}
        </div>
      </div>

      <!-- Run Mode -->
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-amber-400 mb-4">▶ Run Mode</h2>
        <div class="space-y-2">
          {#each [
            { mode: 'manual' as const, label: 'Manual only', desc: 'AI runs only when you explicitly trigger it' },
            { mode: 'event_triggered' as const, label: 'Event-triggered', desc: 'AI runs automatically based on game events' },
            { mode: 'scheduled' as const, label: 'Scheduled', desc: 'AI runs on a recurring schedule' },
          ] as opt}
            <label class="flex items-start gap-3 p-3 rounded cursor-pointer hover:bg-stone-800 {runMode === opt.mode ? 'bg-stone-800 ring-1 ring-amber-600/40' : ''}">
              <input type="radio" name="runMode" bind:group={runMode} value={opt.mode} class="mt-1 accent-amber-600" />
              <div class="flex-1">
                <span class="text-stone-200 text-sm font-medium">{opt.label}</span>
                <p class="text-stone-500 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          {/each}
        </div>

        <!-- Event sub-toggles -->
        {#if runMode === 'event_triggered'}
          <div class="mt-3 ml-7 space-y-2 border-l border-stone-700 pl-4">
            <label class="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
              <input type="checkbox" bind:checked={onNoteUpload} class="accent-amber-600" /> On note upload
            </label>
            <label class="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
              <input type="checkbox" bind:checked={onRequestSubmit} class="accent-amber-600" /> On request submit
            </label>
            <label class="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
              <input type="checkbox" bind:checked={onRequestResolve} class="accent-amber-600" /> On request resolve
            </label>
          </div>
        {/if}

        <!-- Scheduled sub-fields -->
        {#if runMode === 'scheduled'}
          <div class="mt-3 ml-7 space-y-2 border-l border-stone-700 pl-4">
            <div>
              <label class="text-stone-400 text-xs block mb-1">Daily Digest Time</label>
              <input type="time" bind:value={dailyDigestTime} class="bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-stone-400 text-xs block mb-1">Weekly Summary Day</label>
              <select bind:value={weeklySummaryDay} class="bg-stone-800 border border-stone-700 text-stone-200 rounded px-3 py-2 text-sm">
                {#each days as d}
                  <option value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}
      </div>

      <!-- Frequency Control -->
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-amber-400 mb-4">⚡ Frequency Control</h2>
        <div class="flex bg-stone-800 rounded p-1">
          {#each [
            { value: 'conservative' as const, label: 'Conservative' },
            { value: 'normal' as const, label: 'Normal' },
            { value: 'aggressive' as const, label: 'Aggressive' },
          ] as opt}
            <button
              onclick={() => frequency = opt.value}
              class="flex-1 py-2 text-sm rounded transition-colors {frequency === opt.value ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="text-stone-500 text-xs mt-2">
          {frequency === 'conservative' ? 'Minimal AI usage. Processes only critical events.' : frequency === 'normal' ? 'Balanced usage. Processes notable events.' : 'Maximum AI usage. Processes all available events.'}
        </p>
      </div>

      <!-- Safety & Quality -->
      <div class="bg-stone-900 border border-stone-800 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-amber-400 mb-4">🔒 Safety & Quality</h2>
        <div class="space-y-3">
          <label class="flex items-center justify-between">
            <div>
              <span class="text-stone-200 text-sm">Preview before save</span>
              <p class="text-stone-500 text-xs">Review AI output before it's applied</p>
            </div>
            <button
              onclick={() => previewBeforeSave = !previewBeforeSave}
              class="relative w-10 h-5 rounded-full transition-colors {previewBeforeSave ? 'bg-amber-600' : 'bg-stone-700'}"
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {previewBeforeSave ? 'translate-x-5' : ''}"></span>
            </button>
          </label>
          <label class="flex items-center justify-between">
            <div>
              <span class="text-stone-200 text-sm">AI inventory suggestions</span>
              <p class="text-stone-500 text-xs">Allow AI to suggest inventory changes</p>
            </div>
            <button
              onclick={() => aiInventorySuggestions = !aiInventorySuggestions}
              class="relative w-10 h-5 rounded-full transition-colors {aiInventorySuggestions ? 'bg-amber-600' : 'bg-stone-700'}"
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {aiInventorySuggestions ? 'translate-x-5' : ''}"></span>
            </button>
          </label>
        </div>
        <div class="mt-4 pt-3 border-t border-stone-700">
          <a href={`/dashboard/${tableId}/dm/ai-jobs`} class="text-amber-500 hover:text-amber-400 text-sm">View AI Job History →</a>
        </div>
      </div>
    </div>
  </div>
</div>
