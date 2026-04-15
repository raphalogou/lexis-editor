export function jsx(type, props) {
  return createElement(type, props);
}

export function jsxs(type, props) {
  return createElement(type, props);
}

/**
 * Creates a DOM element or component with optional props and children
 * @param {string | Function} tag - HTML tag name or component function
 * @param {Object} [props={}] - Element attributes and event listeners
 * @param {string} [props.key] - React-like key prop (ignored)
 * @param {Array<*>} [children] - Child elements or text nodes
 * @returns {Element | DocumentFragment} The created DOM element or fragment
 *
 * @example
 * // Create a simple div
 * h('div', { class: 'container' }, 'Hello')
 *
 * @example
 * // With event handlers
 * h('button', { onClick: () => console.log('clicked') }, 'Click me')
 *
 * @example
 * // With nested elements
 * h('div', { id: 'app' },
 *   h('h1', {}, 'Title'),
 *   h('p', {}, 'Content')
 * )
 *
 * @example
 * // With component function
 * const MyComponent = (props) => h('div', {}, props.message);
 * h(MyComponent, { message: 'Hello' })
 */
export function createElement(tag, { children, ...props }) {
  const el =
    typeof tag === "function" ? tag(props ?? {}) : document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }

  children = Array.isArray(children) ? children : [children];

  for (const child of children.flat()) {
    if (!child) continue;
    el.append(
      typeof child === "string" ? document.createTextNode(child) : child,
    );
  }

  return el;
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

export const h = createElement;
