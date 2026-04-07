/**
 * Creates a DOM element with attributes, properties, and children
 * @param {string} tag - HTML tag name
 * @param {Object} [attrs={}] - HTML attributes
 * @param {Object} [props={}] - DOM properties
 * @param {Array|string} [children=[]] - Child elements or text
 * @returns {Element}
 *
 * @example
 * h('button', { class: 'btn' }, {}, 'Click me')
 * h('input', { type: 'text' }, { value: 'hello', disabled: true })
 * h('div', { id: 'app' }, {}, [h('h1', {}, {}, 'Title')])
 */
export function createElement(tag, attrs = {}, props = {}, children = []) {
	const el = document.createElement(tag);

	// Set HTML attributes
	Object.entries(attrs).forEach(([key, value]) => {
		if (key.startsWith("on")) {
			const event = key.slice(2).toLowerCase();
			el.addEventListener(event, value);
		} else if (typeof value === "boolean") {
			if (value) el.setAttribute(key, "");
		} else if (value != null) {
			el.setAttribute(key, value);
		}
	});

	// Set DOM properties
	Object.entries(props).forEach(([key, value]) => {
		if (value != null) {
			el[key] = value;
		}
	});

	// Add children
	const addChild = (child) => {
		if (child instanceof Element) {
			el.appendChild(child);
		} else if (child != null) {
			el.appendChild(document.createTextNode(child));
		}
	};

	if (Array.isArray(children)) {
		children.forEach(addChild);
	} else {
		addChild(children);
	}

	return el;
}

export const h = createElement;
