import { parseSvgIcon } from "./html";
import { createElement } from "./jsx-runtime";

export class ToolbarTemplateBuilder {
  constructor({
    template = "",
    editor,
    toolbar,
    groups = {},
    buildCustomControl = () => null,
    buildSeparator: buildSeparatorFactory = buildSeparator,
    buildSpacer: buildSpacerFactory = buildSpacer,
  }) {
    this.template = template;
    this.editor = editor;
    this.toolbar = toolbar;
    this.groups = groups;
    this.buildCustomControl = buildCustomControl;
    this.buildSeparatorFactory = buildSeparatorFactory;
    this.buildSpacerFactory = buildSpacerFactory;

    this.commandControls = new Map();
    this.groupControls = new Map();
    this.unknownTokens = [];
  }

  build(toolbarElement) {
    for (const token of parseToolbarTemplate(this.template)) {
      if (token === "|") {
        toolbarElement.append(this.buildSeparatorFactory());
        continue;
      }

      if (token === "~") {
        toolbarElement.append(this.buildSpacerFactory());
        continue;
      }

      const extensionControl = this.resolveExtensionControl(token);
      if (extensionControl) {
        toolbarElement.append(extensionControl);
        continue;
      }

      const groupControl = this.buildGroupControl(token);
      if (groupControl) {
        toolbarElement.append(groupControl.select);
        this.groupControls.set(token, groupControl);
        continue;
      }

      const commandControl = this.buildCommandControl(token);
      if (commandControl) {
        toolbarElement.append(commandControl.control);
        this.commandControls.set(
          commandControl.commandId,
          commandControl.control,
        );
        continue;
      }

      this.unknownTokens.push(token);
    }

    return {
      commandControls: this.commandControls,
      groupControls: this.groupControls,
      unknownTokens: this.unknownTokens,
    };
  }

  resolveExtensionControl(token) {
    const control = this.buildCustomControl(token, this.toolbar);
    if (!control) {
      return null;
    }

    const commandId = control.dataset.command;
    if (commandId) {
      this.commandControls.set(commandId, control);
    }

    return control;
  }

  buildCommandControl(commandId) {
    const command = this.editor.getCommand(commandId);
    if (!command) {
      return null;
    }

    const customRender = command.renderControl || command.render;
    if (typeof customRender === "function") {
      const control = customRender(this.toolbar, this.editor);
      if (!control) {
        return null;
      }

      control.dataset.command = control.dataset.command || commandId;
      return {
        commandId: control.dataset.command,
        control,
      };
    }

    const icon = createToolbarIcon(command.icon, command.label);

    return {
      commandId,
      control: createElement("button", {
        type: "button",
        class: icon ? "lexis-button lexis-button--icon" : "lexis-button",
        "data-command": commandId,
        ...(icon
          ? {
              title: command.label,
              "aria-label": command.label,
            }
          : {}),
        children: [icon || command.label],
      }),
    };
  }

  buildGroupControl(token) {
    const commandIds = this.groups[token];
    if (!Array.isArray(commandIds) || commandIds.length === 0) {
      return null;
    }

    const items = commandIds
      .map((id) => this.editor.getCommand(id))
      .filter(Boolean)
      .map((command) => ({ id: command.id, label: command.label }));

    if (items.length === 0) {
      return null;
    }

    const select = createElement("select", {
      class: "lexis-select",
      "data-command-group": token,
      "aria-label": formatGroupLabel(token),
    });

    const optionsByCommand = new Map();
    for (const item of items) {
      const option = createElement("option", {
        value: item.id,
        children: [item.label],
      });
      select.append(option);
      optionsByCommand.set(item.id, option);
    }

    select.value = items[0].id;

    return {
      select,
      commands: items.map((item) => item.id),
      optionsByCommand,
    };
  }
}

function createToolbarIcon(icon, label) {
  if (!icon) {
    return null;
  }

  let svg = null;

  if (typeof icon === "string") {
    svg = parseSvgIcon(icon);
  } else if (icon instanceof SVGElement) {
    svg = icon.cloneNode(true);
  }

  if (!(svg instanceof SVGElement)) {
    return null;
  }

  svg.setAttribute("data-slot", "toolbar-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("title", label);
  svg.removeAttribute("aria-label");
  svg.removeAttribute("role");

  return svg;
}

function parseToolbarTemplate(template = "") {
  return template.match(/\||~|[^\s|~]+/g) || [];
}

function buildSeparator() {
  return createElement("span", {
    "data-slot": "toolbar-separator",
    "aria-hidden": "true",
  });
}

function buildSpacer() {
  return createElement("span", {
    "data-slot": "toolbar-spacer",
    "aria-hidden": "true",
  });
}

function formatGroupLabel(token) {
  return token
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
