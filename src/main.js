import "./style.css";

import "./styles/index.css";

document
  .querySelector("lexis-editor")
  ?.addEventListener("editor:initialize", (event) => {
    event.detail.configure({
      markdown: true,
      extensionMode: "append",
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
