import {
  HorizontalRuleExtension,
  TabIndentationExtension,
} from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { LinkExtension } from "@lexical/link";
import { ListExtension } from "@lexical/list";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";
import {
  $createNodeSelection,
  $createParagraphNode,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  defineExtension,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  mergeRegister,
} from "lexical";
import { registerHeading, registerQuote } from "../commands/block";
import { LexisExtension } from "./extension";

export class RichTextExtension extends LexisExtension {
  name = "rich-text";

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/rich-text",
      nodes: [HeadingNode, QuoteNode],
      register: (lexicalEditor) => {
        return mergeRegister(
          registerRichText(lexicalEditor),
          registerHeading(lexicalEditor),
          registerQuote(lexicalEditor),
          lexicalEditor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            (event) => {
              const selection = $getSelection();
              let currentNode;

              if ($isNodeSelection(selection)) {
                const nodes = selection.getNodes();
                currentNode = nodes.length === 1 ? nodes[0] : null;
              } else if ($isRangeSelection(selection)) {
                currentNode = selection.focus.getNode().getTopLevelElement();
              }

              if (!currentNode) {
                return false;
              }

              let nextSibling = currentNode.getNextSibling();
              if (!nextSibling && $isDecoratorNode(currentNode)) {
                nextSibling = $createParagraphNode();
                currentNode.insertAfter(nextSibling);
              }

              if (!nextSibling) {
                return false;
              }

              if ($isDecoratorNode(nextSibling)) {
                const nodeSelection = $createNodeSelection();
                nodeSelection.add(nextSibling.getKey());
                $setSelection(nodeSelection);
              } else {
                selectNodeStart(nextSibling);
              }

              event?.preventDefault();
              return true;
            },
            COMMAND_PRIORITY_HIGH,
          ),

          lexicalEditor.registerCommand(
            KEY_ARROW_UP_COMMAND,
            (event) => {
              const selection = $getSelection();
              let currentNode;

              if ($isNodeSelection(selection)) {
                const nodes = selection.getNodes();
                currentNode = nodes.length === 1 ? nodes[0] : null;
              } else if ($isRangeSelection(selection)) {
                currentNode = selection.focus.getNode().getTopLevelElement();
              }

              const previousSibling = currentNode?.getPreviousSibling();
              if (!currentNode || !previousSibling) {
                return false;
              }

              if ($isDecoratorNode(previousSibling)) {
                const nodeSelection = $createNodeSelection();
                nodeSelection.add(previousSibling.getKey());
                $setSelection(nodeSelection);
              } else {
                selectNodeEnd(previousSibling);
              }

              event?.preventDefault();
              return true;
            },
            COMMAND_PRIORITY_HIGH,
          ),
        );
      },
      dependencies: [
        HistoryExtension,
        TabIndentationExtension,
        HorizontalRuleExtension,
        ListExtension,
        LinkExtension,
      ],
    });
  }
}

function selectNodeStart(node) {
  let targetNode = node;

  while ($isElementNode(targetNode)) {
    const firstChild = targetNode.getFirstChild();
    if (!firstChild) {
      break;
    }

    targetNode = firstChild;
  }

  if ($isTextNode(targetNode)) {
    targetNode.select(0, 0);
    return;
  }

  targetNode.selectStart();
}

function selectNodeEnd(node) {
  let targetNode = node;

  while ($isElementNode(targetNode)) {
    const lastChild = targetNode.getLastChild();
    if (!lastChild) {
      break;
    }

    targetNode = lastChild;
  }

  if ($isTextNode(targetNode)) {
    const size = targetNode.getTextContentSize();
    targetNode.select(size, size);
    return;
  }

  targetNode.selectEnd();
}
