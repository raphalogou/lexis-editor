/**
 * Global Controller Registry
 * Holds references to all available controller classes
 * Controllers are registered at startup and reused for all editor instances
 */
const registry = new Map();

/**
 * Register a controller class globally
 * @param {string} id - Unique controller ID
 * @param {class} ControllerClass - Controller class to register
 */
export function register(id, ControllerClass) {
  registry.set(id, ControllerClass);
}

/**
 * Get registered controller class
 * @param {string} id
 * @returns {class|null}
 */
export function get(id) {
  return registry.get(id) ?? null;
}

/**
 * Check if controller is registered
 * @param {string} id
 * @returns {boolean}
 */
export function has(id) {
  return registry.has(id);
}

/**
 * Get all registered controllers as entries
 * @returns {Array<[string, class]>}
 */
export function getAll() {
  return Array.from(registry.entries());
}

/**
 * Clear all registered controllers
 */
export function clear() {
  registry.clear();
}
