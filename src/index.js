import { defineElements } from "./elements";
import "./styles/index.css";

export * from "./core/extensions";
export { logger } from "./core/logger";
export * from "./core/nodes";

export * from "./helper/listener";
export * from "./helper/sanitizer";

setTimeout(defineElements, 0);
