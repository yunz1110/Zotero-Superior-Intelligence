// Native Gecko exceptions and rejected values need not have a readable message.
var SIError = {
  describe(error) {
    const parts = [], seen = new Set();
    const read = (value, key) => { try { return value?.[key]; } catch (_) { return undefined; } };
    const add = value => { if (typeof value === "string" && value.trim() && !parts.includes(value.trim())) parts.push(value.trim()); };
    let current = error;
    for (let depth = 0; depth < 4 && current != null && !seen.has(current); depth++) {
      seen.add(current);
      add(read(current, "message"));
      const name = read(current, "name");
      if (name !== "Error") add(name);
      for (const key of ["result", "code", "status"]) {
        const value = read(current, key);
        if ((typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value)) add(`${key}=${value}`);
      }
      if (typeof current === "string") add(current);
      else if (typeof current === "number") add(`异常值=${current}`);
      if (!parts.length) {
        try { const value = String(current); if (value !== "[object Object]" && value !== "Error") add(value); } catch (_) {}
      }
      current = read(current, "cause");
    }
    const message = parts.join("；") || "底层组件未提供错误详情";
    // Diagnostics may include provider errors; never persist obvious credentials.
    return message.replace(/Bearer\s+[^\s;；]+/gi, "Bearer [已隐藏]")
      .replace(/\bsk-[\w-]+/g, "[已隐藏]").slice(0, 1800);
  }
};
