import { TabIndentationExtension } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { AutoLinkExtension, createLinkMatcherWithRegExp } from "@lexical/link";
import { ListExtension } from "@lexical/list";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";
import { configExtension, defineExtension, mergeRegister } from "lexical";
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
        );
      },
      dependencies: [
        HistoryExtension,
        TabIndentationExtension,
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
