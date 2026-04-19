import {
  HorizontalRuleExtension,
  TabIndentationExtension,
} from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { AutoLinkExtension, createLinkMatcherWithRegExp } from "@lexical/link";
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
  configExtension,
  defineExtension,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  mergeRegister,
} from "lexical";
import { registerHeading, registerQuote } from "../commands/block";
import { LexisExtension } from "./extension";

const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)(?<![-.+():%])/;

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

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

              if ($isNodeSelection(selection)) {
                const nodes = selection.getNodes();
                if (nodes.length !== 1 || !$isDecoratorNode(nodes[0])) {
                  return false;
                }

                const [decoratorNode] = nodes;
                let nextSibling = decoratorNode.getNextSibling();
                if (!nextSibling) {
                  nextSibling = $createParagraphNode();
                  decoratorNode.insertAfter(nextSibling);
                }

                selectNodeStart(nextSibling);
                event?.preventDefault();
                return true;
              }

              if (!$isRangeSelection(selection)) {
                return false;
              }

              const focusNode = selection.focus.getNode();
              const topLevelElement = focusNode.getTopLevelElement();
              const nextSibling = topLevelElement?.getNextSibling();
              if (!$isDecoratorNode(nextSibling)) {
                return false;
              }

              const nodeSelection = $createNodeSelection();
              nodeSelection.add(nextSibling.getKey());
              $setSelection(nodeSelection);
              event?.preventDefault();
              return true;
            },
            COMMAND_PRIORITY_HIGH,
          ),

          lexicalEditor.registerCommand(
            KEY_ARROW_UP_COMMAND,
            (event) => {
              const selection = $getSelection();

              if ($isNodeSelection(selection)) {
                const nodes = selection.getNodes();
                if (nodes.length !== 1 || !$isDecoratorNode(nodes[0])) {
                  return false;
                }

                const [decoratorNode] = nodes;
                const previousSibling = decoratorNode.getPreviousSibling();
                if (!previousSibling) {
                  return false;
                }

                selectNodeEnd(previousSibling);
                event?.preventDefault();
                return true;
              }

              if (!$isRangeSelection(selection)) {
                return false;
              }

              const focusNode = selection.focus.getNode();
              const topLevelElement = focusNode.getTopLevelElement();
              const previousSibling = topLevelElement?.getPreviousSibling();
              if (!$isDecoratorNode(previousSibling)) {
                return false;
              }

              const nodeSelection = $createNodeSelection();
              nodeSelection.add(previousSibling.getKey());
              $setSelection(nodeSelection);
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
        configExtension(AutoLinkExtension, {
          matchers: [
            createLinkMatcherWithRegExp(URL_REGEX, (text) => {
              return text.startsWith("http") ? text : `https://${text}`;
            }),
            createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => {
              return `mailto:${text}`;
            }),
          ],
        }),
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
