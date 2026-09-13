import { TableExtension as LexicalTableExtension } from "@lexical/table";
import { defineExtension } from "lexical";
import { commands as tableCommands } from "../commands/table";
import { LexisExtension } from "./extension";

export class TableExtension extends LexisExtension {
  name = "table";

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/table",
      // GFM pipe-table markdown (this editor's default output format) has
      // no representation for merged cells, so cell merge is disabled to
      // keep every table losslessly round-trippable through markdown.
      dependencies: [[LexicalTableExtension, { hasCellMerge: false }]],
    });
  }

  get commands() {
    return tableCommands;
  }
}
