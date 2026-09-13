const SVG_PROPS =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

// Table icons below are adapted from Lexxy (https://github.com/basecamp/lexxy),
// MIT licensed, to match its filled 18x18 style.
const SVG_PROPS_FILLED =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="currentColor"';

/** @type {Record<string, string>} */
export const COMMAND_ICONS = {
  bold: `<svg ${SVG_PROPS}><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
  italic: `<svg ${SVG_PROPS}><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
  underline: `<svg ${SVG_PROPS}><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>`,
  strikethrough: `<svg ${SVG_PROPS}><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>`,
  code: `<svg ${SVG_PROPS}><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`,
  divider: `<svg ${SVG_PROPS}><path d="M5 8V5c0-1 1-2 2-2h10c1 0 2 1 2 2v3"/><path d="M19 16v3c0 1-1 2-2 2H7c-1 0-2-1-2-2v-3"/><line x1="4" x2="20" y1="12" y2="12"/></svg>`,
  paragraph: `<svg  ${SVG_PROPS}><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>`,
  quote: `<svg  ${SVG_PROPS}><path d="M17 5H3"/><path d="M21 12H8"/><path d="M21 19H8"/><path d="M3 12v7"/></svg>`,
  "heading-1": `<svg ${SVG_PROPS}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>`,
  "heading-2": `<svg ${SVG_PROPS}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
  "heading-3": `<svg ${SVG_PROPS}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`,
  "heading-4": `<svg ${SVG_PROPS}><path d="M12 18V6"/><path d="M17 10v3a1 1 0 0 0 1 1h3"/><path d="M21 10v8"/><path d="M4 12h8"/><path d="M4 18V6"/></svg>`,
  "bullet-list": `<svg ${SVG_PROPS}><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>`,
  "number-list": `<svg ${SVG_PROPS}><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>`,
  link: `<svg ${SVG_PROPS}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  image: `<svg aria-hidden="true" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
  unlink: `<svg ${SVG_PROPS}><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/></svg>`,
  undo: `<svg ${SVG_PROPS}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  redo: `<svg ${SVG_PROPS}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`,
  "code-block": `<svg ${SVG_PROPS}><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>`,
  table: `<svg ${SVG_PROPS}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`,
  "table-add-row": `<svg ${SVG_PROPS_FILLED}><path fill-rule="evenodd" clip-rule="evenodd" d="M7.86804e-07 13.5C7.50592e-07 14.3284 0.671574 15 1.5 15H3V13.5H1.5L1.5 9L15 9V13.5H13.5V15H15C15.7767 15 16.4154 14.4097 16.4922 13.6533L16.5 13.5V3L16.4922 2.84668C16.4205 2.14069 15.8593 1.57949 15.1533 1.50781L15 1.5L1.5 1.5C0.671574 1.5 1.28803e-06 2.17157 1.24577e-06 3L7.86804e-07 13.5ZM15 3V7.5L1.5 7.5L1.5 3L15 3Z"/><path d="M7.5 15V18H9V15H12V13.5H9V10.5H7.5V13.5H4.5V15H7.5Z"/></svg>`,
  "table-remove-row": `<svg ${SVG_PROPS_FILLED}><path d="M16.4922 12.1533C16.4154 12.9097 15.7767 13.5 15 13.5L12 13.5V12H15V6L1.5 6L1.5 12H4.5V13.5H1.5C0.723337 13.5 0.0846104 12.9097 0.00781328 12.1533L7.86804e-07 12L1.04907e-06 6C1.17362e-06 5.22334 0.590278 4.58461 1.34668 4.50781L1.5 4.5L15 4.5C15.8284 4.5 16.5 5.17157 16.5 6V12L16.4922 12.1533Z"/><path d="M10.3711 15.9316L8.25 13.8096L6.12793 15.9316L5.06738 14.8711L7.18945 12.75L5.06738 10.6289L6.12793 9.56836L8.25 11.6895L10.3711 9.56836L11.4316 10.6289L9.31055 12.75L11.4316 14.8711L10.3711 15.9316Z"/></svg>`,
  "table-add-column": `<svg ${SVG_PROPS_FILLED}><path fill-rule="evenodd" clip-rule="evenodd" d="M13.5 0C14.3284 0 15 0.671573 15 1.5V3H13.5V1.5H9V15H13.5V13.5H15V15C15 15.7767 14.4097 16.4154 13.6533 16.4922L13.5 16.5H3L2.84668 16.4922C2.14069 16.4205 1.57949 15.8593 1.50781 15.1533L1.5 15V1.5C1.5 0.671573 2.17157 6.03989e-09 3 0H13.5ZM3 15H7.5V1.5H3V15Z"/><path d="M15 7.5H18V9H15V12H13.5V9H10.5V7.5H13.5V4.5H15V7.5Z"/></svg>`,
  "table-remove-column": `<svg ${SVG_PROPS_FILLED}><path d="M12.1533 0.0078125C12.9097 0.0846097 13.5 0.723336 13.5 1.5V4.5H12V1.5H6V15H12V12H13.5V15C13.5 15.7767 12.9097 16.4154 12.1533 16.4922L12 16.5H6C5.22334 16.5 4.58461 15.9097 4.50781 15.1533L4.5 15V1.5C4.5 0.671573 5.17157 2.41596e-08 6 0H12L12.1533 0.0078125Z"/><path d="M15.9316 6.12891L13.8105 8.24902L15.9326 10.3711L14.8711 11.4316L12.75 9.31055L10.6289 11.4316L9.56738 10.3711L11.6885 8.24902L9.56836 6.12891L10.6289 5.06836L12.75 7.18848L14.8711 5.06836L15.9316 6.12891Z"/></svg>`,
  "table-delete": `<svg ${SVG_PROPS}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
};

export const UI_ICONS = {
  error: `<svg data-slot="icon" aria-hidden="true" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
};
