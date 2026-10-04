import "./styles/editor.css";
import "./style.css";

import { MentionExtension } from "./index";

document
  .querySelector("lexis-editor")
  ?.addEventListener("editor:initialize", (event) => {
    event.detail.configure({
      markdown: true,
      extensionMode: "append",
      extensions: [MentionExtension],
      lexical: {
        theme: {
          text: {
            underline: "underline text-underline",
          },
        },
      },
    });
  });

document.addEventListener("editor:image:insert", (event) => {
  console.debug("Insert image", event.detail);
  // event.preventDefault();
});

document.addEventListener("editor:image:upload", (event) => {
  console.debug("Upload image", event.detail);

  const { file, upload } = event.detail;

  let progress = 0;
  const timer = window.setInterval(() => {
    progress = Math.min(progress + 20, 100);
    upload.progress(progress);

    if (progress < 100) {
      return;
    }

    window.clearInterval(timer);
    upload.success({
      url: `https://picsum.photos/seed/${encodeURIComponent(file.name)}/1200/800`,
    });
  }, 160);
});

document.addEventListener("editor:image:remove", (event) => {
  console.debug("Remove image", event.detail);
});

const DEMO_USERS = [
  { id: "ada", label: "Ada Lovelace", description: "Analytical Engine" },
  { id: "alan", label: "Alan Turing", description: "Computability" },
  { id: "grace", label: "Grace Hopper", description: "COBOL" },
  { id: "linus", label: "Linus Torvalds", description: "Linux" },
  { id: "margaret", label: "Margaret Hamilton", description: "Apollo" },
];

document.addEventListener("editor:mention:search", (event) => {
  const { query, respond } = event.detail;
  const needle = query.toLowerCase();

  // Simulated network latency.
  setTimeout(() => {
    respond(
      DEMO_USERS.filter((user) => user.label.toLowerCase().includes(needle)),
    );
  }, 80);
});
