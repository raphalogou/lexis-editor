import { commands as blockCommands } from "./block";
import { commands as dividerCommands } from "./divider";
import { commands as formatCommands } from "./format";
import { commands as historyCommands } from "./history";
import { commands as linkCommands } from "./link";
import { commands as listCommands } from "./list";

export {
  commands as blockCommands,
  TOGGLE_HEADING_COMMAND,
  TOGGLE_QUOTE_COMMAND,
} from "./block";
export { commands as dividerCommands } from "./divider";
export { commands as formatCommands } from "./format";
export { commands as historyCommands } from "./history";
export { commands as linkCommands } from "./link";
export { commands as listCommands } from "./list";

export const commands = [
  ...formatCommands,
  ...listCommands,
  ...blockCommands,
  ...linkCommands,
  ...historyCommands,
  ...dividerCommands,
];
