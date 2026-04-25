import { createElement } from "./html";

export function jsx(type, props) {
  return createElement(type, props);
}

export function jsxs(type, props) {
  return createElement(type, props);
}

/**
 * Creates a document fragment to render multiple children without a wrapper element
 * @param {Object} props - Component props
 * @param {Array<*>} props.children - Child elements or text nodes to append to fragment
 * @returns {DocumentFragment} A document fragment containing the children
 *
 * @example
 * // Render multiple elements without a wrapper
 * h(Fragment, {},
 *   h('h1', {}, 'Title'),
 *   h('p', {}, 'Content'),
 *   h('footer', {}, 'Footer')
 * )
 */
export const Fragment = ({ children }) => {
  const fragment = document.createDocumentFragment();

  for (const child of children.flat()) {
    fragment.append(child);
  }

  return fragment;
};
