import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/extension";
import {
  $generateNodesFromMarkdownString,
  BOLD_STAR,
  CODE,
  HEADING,
  INLINE_CODE,
  ITALIC_UNDERSCORE,
  isTableRowDivider,
  LINK,
  ORDERED_LIST,
  QUOTE,
  registerMarkdownShortcuts,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from "@lexical/markdown";
import {
  $createTableNodeWithDimensions,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $isParagraphNode,
  defineExtension,
} from "lexical";
import { $createImageNode, $isImageNode, ImageNode } from "../nodes/image-node";
import { LexisExtension } from "./extension";

const DIVIDER_REGEX = /^(?:---|\*\*\*|___)\s?$/;

const DIVIDER = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    if (!$isHorizontalRuleNode(node)) {
      return null;
    }

    return "---";
  },
  regExp: DIVIDER_REGEX,
  replace: (parentNode, _children, _match, isImport) => {
    const divider = $createHorizontalRuleNode();
    parentNode.replace(divider);

    if (isImport) {
      return;
    }

    const paragraph = $createParagraphNode();
    divider.insertAfter(paragraph);
    paragraph.selectStart();
  },
  type: "element",
};

const IMAGE_IMPORT_REGEX =
  /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"((?:[^"\\]|\\.)*)")?\)/;

const IMAGE = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node)) {
      return null;
    }

    const description = escapeMarkdownImageText(node.getDescription());
    const url = node.getUrl();

    return `![${description}](${url} "${description}")`;
  },
  regExp: IMAGE_IMPORT_REGEX,
  replace: (textNode, match) => {
    const [, rawAlt = "", rawUrl = ""] = match;
    if (!rawUrl) {
      return;
    }

    const imageNode = $createImageNode({
      url: rawUrl,
      description: unescapeMarkdownImageText(rawAlt),
    });

    textNode.replace(imageNode);
  },
  trigger: ")",
  type: "text-match",
};

// Legal inline-only subset for parsing a single table cell's text — no
// block-level transformers (headings, quotes, lists, code blocks, nested
// tables), since GFM pipe-table cells can't contain any of those.
const TABLE_CELL_INLINE_TRANSFORMERS = [
  BOLD_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  INLINE_CODE,
  LINK,
];

const TABLE_ROW_TEXT_REGEX = /^\|(.+)\|[ \t]*$/;

const TABLE = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  regExpStart: TABLE_ROW_TEXT_REGEX,

  // GFM pipe tables have no end token — a table ends at the first line that
  // isn't a pipe row. `regExpEnd`-driven matching (built for a start/end
  // token pair like code fences) doesn't fit, so the scan is handled here
  // directly instead. This transformer intentionally only recognizes
  // tables on import/paste/`.value =` load, not while typing — deciding a
  // table exists requires seeing the divider line, which isn't available
  // yet at the moment the header row's Enter keystroke fires.
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const dividerLine = lines[startLineIndex + 1];
    if (dividerLine === undefined || !isTableRowDivider(dividerLine)) {
      return null;
    }

    const rowsCells = [splitTableRowCells(lines[startLineIndex])];
    let endLineIndex = startLineIndex + 1;

    for (let i = startLineIndex + 2; i < lines.length; i++) {
      if (!TABLE_ROW_TEXT_REGEX.test(lines[i])) {
        break;
      }

      rowsCells.push(splitTableRowCells(lines[i]));
      endLineIndex = i;
    }

    const columnCount = rowsCells[0].length;
    const tableNode = $createTableNodeWithDimensions(
      rowsCells.length,
      columnCount,
      { rows: true, columns: false },
    );

    const tableRows = tableNode.getChildren();
    rowsCells.forEach((cellsText, rowIndex) => {
      const cells = tableRows[rowIndex].getChildren();
      cellsText.forEach((cellText, columnIndex) => {
        const cell = cells[columnIndex];
        if (cell) {
          populateTableCell(cell, cellText);
        }
      });
    });

    rootNode.append(tableNode);

    return [true, endLineIndex];
  },

  export: (node, exportChildren) => {
    if (!$isTableNode(node)) {
      return null;
    }

    const rows = node.getChildren().filter($isTableRowNode);
    if (rows.length === 0) {
      return null;
    }

    const rowLines = rows.map((row) => {
      const cells = row.getChildren().filter($isTableCellNode);
      const cellText = cells.map((cell) =>
        escapeTableCellText(exportChildren(cell)),
      );
      return `| ${cellText.join(" | ")} |`;
    });

    const columnCount = rows[0].getChildren().filter($isTableCellNode).length;
    const dividerLine = `| ${Array(columnCount).fill("---").join(" | ")} |`;
    rowLines.splice(1, 0, dividerLine);

    return rowLines.join("\n");
  },

  // Required by the transformer type, but unreachable here — table
  // recognition is fully handled by handleImportAfterStartMatch above, and
  // (per the note there) this transformer doesn't support live-typed
  // markdown shortcuts.
  replace: () => {},

  type: "multiline-element",
};

/** Splits a GFM table row into cell text, respecting `\|` escapes. */
function splitTableRowCells(line) {
  const inner = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|[ \t]*$/, "");
  const cells = [];
  let current = "";

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (char === "\\" && inner[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

/** Parses a cell's inline markdown text into the cell's default paragraph. */
function populateTableCell(cell, text) {
  const unescaped = text.replace(/\\\|/g, "|");
  if (!unescaped) {
    return;
  }

  const parsedNodes = $generateNodesFromMarkdownString(
    unescaped,
    TABLE_CELL_INLINE_TRANSFORMERS,
  );
  const inlineNodes =
    parsedNodes.length === 1 && $isParagraphNode(parsedNodes[0])
      ? parsedNodes[0].getChildren()
      : parsedNodes;

  const paragraph = cell.getFirstChild();
  if ($isParagraphNode(paragraph)) {
    paragraph.append(...inlineNodes);
  } else {
    cell.append(...parsedNodes);
  }
}

/**
 * Escapes text for placement inside a GFM table cell: literal `|` would
 * otherwise be read as a column boundary, and a literal newline would break
 * the one-line-per-row format entirely.
 */
function escapeTableCellText(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

export const MARKDOWN_TRANSFORMERS = [
  HEADING,
  QUOTE,
  DIVIDER,
  CODE,
  TABLE,
  INLINE_CODE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  LINK,
  IMAGE,
];

export class MarkdownExtension extends LexisExtension {
  get name() {
    return "markdown";
  }

  get enabled() {
    return this.editor.supportsMarkdown;
  }

  /**
   * @returns {import('lexical').LexicalExtension}
   */
  get lexicalExtension() {
    return defineExtension({
      name: "lexis/markdown",
      register: (lexicalEditor) => {
        return registerMarkdownShortcuts(lexicalEditor, MARKDOWN_TRANSFORMERS);
      },
    });
  }
}

function escapeMarkdownImageText(value) {
  return value.replace(/([\\"\]])/g, "\\$1");
}

function unescapeMarkdownImageText(value) {
  return value.replace(/\\([\\"\]])/g, "$1");
}
