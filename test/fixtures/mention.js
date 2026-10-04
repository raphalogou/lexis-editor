import "../../src/styles/editor.css";
import "../../src/styles/content.css";
import { MentionExtension } from "../../src/index.js";

const USERS = [
  { id: "ada", label: "Ada Lovelace" },
  { id: "alan", label: "Alan Turing" },
  { id: "grace", label: "Grace Hopper" },
];

const editor = document.querySelector("lexis-editor");

editor.addEventListener("editor:initialize", (event) => {
  event.detail.configure({ extensions: [MentionExtension] });
});

window.mentionSearches = [];

editor.addEventListener("editor:mention:search", (event) => {
  const { query, respond } = event.detail;
  window.mentionSearches.push(query);
  // Async on purpose: the extension must cope with late responses.
  setTimeout(() => {
    respond(
      USERS.filter((u) => u.label.toLowerCase().includes(query.toLowerCase())),
    );
  }, 10);
});
