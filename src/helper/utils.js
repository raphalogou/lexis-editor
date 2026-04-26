export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepMergeObjects(base, overrides) {
  const output = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(output[key]) && isPlainObject(value)) {
      output[key] = deepMergeObjects(output[key], value);
      continue;
    }

    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

export function createShortId(length = 8) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}
