/**
 * @param {string} svgMarkup
 * @returns {SVGElement | null}
 */
export function parseSvgIcon(svgMarkup) {
  const template = document.createElement("template");
  template.innerHTML = svgMarkup.trim();
  const firstElement = template.content.firstElementChild;
  return firstElement instanceof SVGElement ? firstElement : null;
}
