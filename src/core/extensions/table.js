import {
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowNodeFromTableCellNodeOrThrow,
  TableExtension as LexicalTableExtension,
} from "@lexical/table";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  defineExtension,
  KEY_ARROW_DOWN_COMMAND,
  mergeRegister,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { parseSvgIcon } from "../../helper/html";
import { ListenerRegistry, registerEventListener } from "../../helper/listener";
import { commands as tableCommands } from "../commands/table";
import { LexisExtension } from "./extension";

const TABLE_CONTROLS = [
  {
    id: "table-add-row",
    label: "Add row below",
    highlight: "insert-row-after",
  },
  { id: "table-remove-row", label: "Remove row", highlight: "row" },
  {
    id: "table-add-column",
    label: "Add column right",
    highlight: "insert-column-after",
  },
  { id: "table-remove-column", label: "Remove column", highlight: "column" },
  { id: "table-delete", label: "Delete table", highlight: "table" },
];

export class TableExtension extends LexisExtension {
  name = "table";

  /** @type {import('../../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /** @type {HTMLElement | null} */
  #controls = null;

  /** @type {string} */
  #lastVisibleCellKey = "";

  /** @type {string} */
  #lastVisibleTableKey = "";

  /** @type {HTMLElement[]} */
  #highlightedElements = [];

  /** @type {HTMLElement | null} */
  #activeCellElement = null;

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/table",
      // GFM pipe-table markdown (this editor's default output format) has
      // no representation for merged cells, so cell merge is disabled to
      // keep every table losslessly round-trippable through markdown.
      dependencies: [[LexicalTableExtension, { hasCellMerge: false }]],
      register: (lexicalEditor) => {
        return mergeRegister(
          // A click that only moves the selection (no content dirtied)
          // doesn't reliably fire registerUpdateListener on its own.
          lexicalEditor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
              this.#syncControls(lexicalEditor);
              return false;
            },
            COMMAND_PRIORITY_EDITOR,
          ),
          lexicalEditor.registerUpdateListener(() => {
            lexicalEditor.read(() => {
              this.#syncControls(lexicalEditor);
            });
          }),
          // Higher than the default fallback: Lexical's own arrow-key
          // handling for tables (at COMMAND_PRIORITY_EDITOR) otherwise runs
          // first and settles for a root-level "block cursor" selection
          // past the table instead of a real paragraph — matching the
          // decorator-node precedent in rich-text.js, which needs the same
          // priority for the same reason.
          lexicalEditor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            (event) => this.#handleArrowDownAtTableBoundary(event),
            COMMAND_PRIORITY_HIGH,
          ),
        );
      },
    });
  }

  get commands() {
    return tableCommands;
  }

  /**
   * @param {import('lexical').LexicalEditor} lexicalEditor
   */
  #syncControls(lexicalEditor) {
    const selection = $getSelection();
    const cellNode = $isRangeSelection(selection)
      ? $getTableCellNodeFromLexicalNode(selection.focus.getNode())
      : null;

    if (!cellNode) {
      this.#hideControls();
      return;
    }

    const cellKey = cellNode.getKey();
    this.#lastVisibleCellKey = cellKey;
    this.#setActiveCellElement(lexicalEditor.getElementByKey(cellKey));

    const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
    const tableKey = tableNode.getKey();
    const tableElement = lexicalEditor.getElementByKey(tableKey);
    if (!tableElement) {
      this.#hideControls();
      return;
    }

    this.#showControls(tableElement, tableKey);
  }

  /**
   * @param {HTMLElement} tableElement
   * @param {string} tableKey
   */
  #showControls(tableElement, tableKey) {
    const controls = this.#getControls();
    controls.hidden = false;

    if (this.#lastVisibleTableKey === tableKey) {
      return;
    }

    this.#lastVisibleTableKey = tableKey;
    this.#clearHighlights();

    const hostElement = this.hostElement;
    if (!hostElement) return;

    const hostBounds = hostElement.getBoundingClientRect();
    // The scrollable wrapper (not the <table> itself) carries the actual
    // outer box when hasHorizontalScroll wraps every table in a div.
    const anchorElement = tableElement.closest("div") ?? tableElement;
    const tableBounds = anchorElement.getBoundingClientRect();

    controls.style.top = `${tableBounds.top - hostBounds.top - controls.offsetHeight - 4}px`;
    controls.style.left = `${
      tableBounds.left -
      hostBounds.left +
      (tableBounds.width - controls.offsetWidth) / 2
    }px`;
  }

  #hideControls() {
    this.#lastVisibleCellKey = "";
    this.#lastVisibleTableKey = "";
    this.#clearHighlights();
    this.#setActiveCellElement(null);

    if (!this.#controls) return;
    this.#controls.hidden = true;
  }

  /**
   * @param {HTMLElement | null} cellElement
   */
  #setActiveCellElement(cellElement) {
    if (this.#activeCellElement === cellElement) return;

    this.#activeCellElement?.classList.remove("lexis-table-active-cell");
    this.#activeCellElement = cellElement ?? null;
    this.#activeCellElement?.classList.add("lexis-table-active-cell");
  }

  /**
   * @returns {HTMLElement}
   */
  #getControls() {
    if (this.#controls) {
      return this.#controls;
    }

    const hostElement = this.hostElement;
    if (!hostElement) {
      throw new Error("TableExtension requires hostElement");
    }

    const controls = document.createElement("div");
    controls.dataset.slot = "table-controls";
    controls.className = "lexis-table-controls";
    controls.hidden = true;
    controls.style.position = "absolute";
    controls.style.zIndex = "5";

    for (const { id, label, highlight } of TABLE_CONTROLS) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label);

      const icon = parseSvgIcon(this.editor.getCommand(id)?.icon ?? "", {
        "data-slot": "toolbar-icon",
        "aria-hidden": "true",
      });
      if (icon) {
        button.append(icon);
      }

      this.#listeners.track(
        registerEventListener(button, "click", (event) => {
          event.preventDefault();
          this.editor.runCommand(id);
        }),
        registerEventListener(button, "mouseenter", () => {
          this.#applyHighlight(highlight);
        }),
        registerEventListener(button, "mouseleave", () => {
          this.#clearHighlights();
        }),
      );

      controls.append(button);
    }

    this.#listeners.track(
      // A click/mousedown on a toolbar-style button elsewhere within the
      // host doesn't blur (LexisEditorElement only fires editor:blur once
      // focus truly leaves the host), but this still catches focus moving
      // to an unrelated part of the page while the table remains selected.
      registerEventListener(hostElement, "editor:blur", () =>
        this.#hideControls(),
      ),
      // Also catches OS/window-level focus loss (alt-tab, devtools, another
      // browser tab) — document.activeElement never changes in that case,
      // so no focusout/editor:blur fires at all.
      registerEventListener(window, "blur", () => this.#hideControls()),
      // Re-clicking back into the same cell after either of the above can
      // leave the browser selection unchanged, so no selectionchange fires
      // to naturally re-show the panel — force a re-sync on refocus.
      registerEventListener(hostElement, "editor:focus", () => {
        const lexicalEditor = this.editor?.lexicalEditor;
        if (!lexicalEditor) return;
        lexicalEditor.read(() => this.#syncControls(lexicalEditor));
      }),
    );

    hostElement.append(controls);
    this.#controls = controls;
    return controls;
  }

  /**
   * Mirrors ImageExtension/rich-text's decorator handling: exiting the last
   * row of a trailing table (no next sibling) creates a paragraph and moves
   * the caret into it, rather than leaving ArrowDown a no-op.
   *
   * @param {KeyboardEvent | null} event
   * @returns {boolean}
   */
  #handleArrowDownAtTableBoundary(event) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;

    const cellNode = $getTableCellNodeFromLexicalNode(
      selection.focus.getNode(),
    );
    if (!cellNode) return false;

    const rowNode = $getTableRowNodeFromTableCellNodeOrThrow(cellNode);
    const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);

    if (rowNode.getKey() !== tableNode.getLastChild()?.getKey()) {
      return false;
    }

    if (tableNode.getNextSibling()) {
      return false;
    }

    const paragraph = $createParagraphNode();
    tableNode.insertAfter(paragraph);
    paragraph.selectStart();

    event?.preventDefault();
    return true;
  }

  /**
   * @param {"row" | "column" | "table" | "insert-row-after" | "insert-column-after"} kind
   */
  #applyHighlight(kind) {
    this.#clearHighlights();

    const lexicalEditor = this.editor?.lexicalEditor;
    if (!lexicalEditor || !this.#lastVisibleCellKey) return;

    lexicalEditor.read(() => {
      const cellNode = $getNodeByKey(this.#lastVisibleCellKey);
      if (!cellNode) return;

      switch (kind) {
        case "row": {
          const rowNode = $getTableRowNodeFromTableCellNodeOrThrow(cellNode);
          this.#markElement(
            lexicalEditor,
            rowNode.getKey(),
            "lexis-table-target-row",
          );
          for (const cell of rowNode.getChildren()) {
            this.#markElement(
              lexicalEditor,
              cell.getKey(),
              "lexis-table-target-cell",
            );
          }
          break;
        }
        case "column": {
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
          const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode);
          for (const row of tableNode.getChildren()) {
            const cell = row.getChildren()[columnIndex];
            if (cell) {
              this.#markElement(
                lexicalEditor,
                cell.getKey(),
                "lexis-table-target-cell",
              );
            }
          }
          break;
        }
        case "table": {
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
          this.#markElement(
            lexicalEditor,
            tableNode.getKey(),
            "lexis-table-target-table",
          );
          for (const row of tableNode.getChildren()) {
            for (const cell of row.getChildren()) {
              this.#markElement(
                lexicalEditor,
                cell.getKey(),
                "lexis-table-target-cell",
              );
            }
          }
          break;
        }
        case "insert-row-after": {
          const rowNode = $getTableRowNodeFromTableCellNodeOrThrow(cellNode);
          // Marked on each cell rather than the <tr> itself: box-shadow on
          // a table-row is painted behind its cells, so it gets hidden by
          // any cell with an opaque background (e.g. the header row).
          // Marking each cell's own bottom edge instead avoids that.
          for (const cell of rowNode.getChildren()) {
            this.#markElement(
              lexicalEditor,
              cell.getKey(),
              "lexis-table-insert-after-bottom",
            );
          }
          break;
        }
        case "insert-column-after": {
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
          const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode);
          for (const row of tableNode.getChildren()) {
            const cell = row.getChildren()[columnIndex];
            if (cell) {
              this.#markElement(
                lexicalEditor,
                cell.getKey(),
                "lexis-table-insert-after-right",
              );
            }
          }
          break;
        }
      }
    });
  }

  /**
   * @param {import('lexical').LexicalEditor} lexicalEditor
   * @param {string} nodeKey
   * @param {string} className
   */
  #markElement(lexicalEditor, nodeKey, className) {
    const element = lexicalEditor.getElementByKey(nodeKey);
    if (!element) return;
    element.classList.add(className);
    this.#highlightedElements.push(element);
  }

  #clearHighlights() {
    for (const element of this.#highlightedElements) {
      element.classList.remove(
        "lexis-table-target-row",
        "lexis-table-target-cell",
        "lexis-table-target-table",
        "lexis-table-insert-after-bottom",
        "lexis-table-insert-after-right",
      );
    }
    this.#highlightedElements = [];
  }

  dispose() {
    this.#listeners.cleanup();
    this.#clearHighlights();
    this.#setActiveCellElement(null);

    if (this.#controls?.isConnected) {
      this.#controls.remove();
    }

    this.#controls = null;
    this.#lastVisibleCellKey = "";
    this.#lastVisibleTableKey = "";
  }
}
