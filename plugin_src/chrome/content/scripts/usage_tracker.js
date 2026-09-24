// Daily totals from provider-reported Chat Completions usage. No token estimates.
var LLMUsage = {
  key: "extensions.zoteromineru.llmUsage",

  read() {
    try {
      const data = JSON.parse(Zotero.Prefs.get(this.key, true) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (_error) {
      return {};
    }
  },

  record(usage, slot = 1, date = new Date()) {
    const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-");
    const data = this.read();
    const item = data[day] || { prompt: 0, completion: 0, total: 0, requests: 0, unreported: 0 };
    const profileKey = String(Number.isInteger(Number(slot)) && Number(slot) >= 1 && Number(slot) <= 8 ? Number(slot) : 1);
    item.profiles ||= {};
    const profile = item.profiles[profileKey] || { prompt: 0, completion: 0, total: 0, cached: 0, cachePrompt: 0, requests: 0, unreported: 0 };
    const count = (value) => Number.isFinite(Number(value)) && Number(value) >= 0
      ? Math.floor(Number(value)) : 0;
    const hasUsage = usage && (usage.total_tokens != null || usage.prompt_tokens != null ||
      usage.completion_tokens != null || usage.input_tokens != null || usage.output_tokens != null);
    if (hasUsage) {
      const prompt = count(usage.prompt_tokens ?? usage.input_tokens);
      const completion = count(usage.completion_tokens ?? usage.output_tokens);
      const cacheValue = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? usage.input_tokens_details?.cached_tokens;
      const cached = count(cacheValue);
      item.prompt += prompt;
      item.completion += completion;
      item.total += count(usage.total_tokens ?? prompt + completion);
      item.cached = (item.cached || 0) + cached;
      if (cacheValue != null) item.cachePrompt = (item.cachePrompt || 0) + prompt;
      profile.prompt += prompt;
      profile.completion += completion;
      profile.total += count(usage.total_tokens ?? prompt + completion);
      profile.cached = (profile.cached || 0) + cached;
      if (cacheValue != null) profile.cachePrompt = (profile.cachePrompt || 0) + prompt;
    } else {
      item.unreported += 1;
      profile.unreported += 1;
    }
    item.requests += 1;
    profile.requests += 1;
    item.profiles[profileKey] = profile;
    data[day] = item;
    Zotero.Prefs.set(this.key, JSON.stringify(data), true);
    return item;
  }
};
