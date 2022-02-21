"use strict";

const elementWrapperCache = new WeakMap();
const wrapperSymbol = Symbol();

const Jel = function Jel(type, spec = {}) {
	spec = { ...spec };

	if (type === undefined) throw new Error("Entity type is undefined");
	const eventHandlers = {};
	const triggerEvent = (name, data) => {
		if (eventHandlers[name]) eventHandlers[name].forEach(h => h(data));
	};

	const define = props => Object.defineProperties(this, props);
	define.values = vals => {
		Object.keys(vals).forEach(k => Object.defineProperty(this, k, { value: vals[k] }));
	};
	define.readOnly = vals => {
		Object.keys(vals).forEach(k => Object.defineProperty(this, k, { get: vals[k] }));
	};
	define.writeOnly = vals => {
		Object.keys(vals).forEach(k => Object.defineProperty(this, k, { set: vals[k] }));
	};
	define.importDom = (ent) => {
		["absoluteTop", "absoluteLeft", "style", "attribs", "data", "qsa"].forEach(k => Object.defineProperty(this, k, {
			get: () => {
				return ent[k];
			}
		}))
	}

	// get el/ent from type
	// (the jel-constructor) will return this component's root HTMLElement (or Jel that represents it)
	const domRoot = type(spec, define, triggerEvent);

	this.entityType = type.name;

	let domElement;
	if (domRoot instanceof Jel) {
		domElement = domRoot.domElement;
	} else if (domRoot instanceof HTMLElement) {
		domElement = domRoot;
		elementWrapperCache.set(domRoot, this);
	} else throw new Error("Invalid return type from entity definition");

	if (type !== elementWrapper) {
		const rootJel = (domRoot instanceof Jel) ? domRoot : wrapHTMLElement(domRoot);
		rootJel.entity = this;
	}

	if (!this.on) this.on = (eventName, handler) => {
		if (eventHandlers[eventName] === undefined) eventHandlers[eventName] = [];
		eventHandlers[eventName].push(handler);
	};
	if (!this.off) this.off = (eventName, handler) => {
		if (eventHandlers[eventName] === undefined) return;
		const idx = eventHandlers[eventName].indexOf(handler);
		if (idx !== -1) eventHandlers[eventName].splice(idx)
	};


	if (spec.events) {
		Object.keys(spec.events).forEach(k => {
			if (spec.events[k]) this.on(k, spec.events[k]);
		})
	}

	const id = spec.id;
	Object.defineProperties(this, {
		id: { value: id },
		domElement: { value: domElement, enumerable: true, },
		hasAncestor: {
			value: elOrEnt => {
				let el = elOrEnt instanceof HTMLElement ? elOrEnt : elOrEnt.domElement;
				let p = this.parent;
				while (p) {
					if (p.domElement === el) return true;
					p = p.parent;
				}
				return false;
			}
		}
	});
};

const wrapHTMLElement = node => {
	if (typeof node == "string") node = document.querySelector(node);
	if (!(node instanceof HTMLElement)) throw new Error("Expecting HTMLElement");
	if (!elementWrapperCache.has(node)) {
		// wrap(someNode) == wrap(someNode) should be true so we cache (weakly)
		elementWrapperCache.set(node, new Jel(elementWrapper, {
			id: node.id,
			[wrapperSymbol]: node,
		}));
	}
	return elementWrapperCache.get(node);
};

const parseHtml = html => {
	const result = [];
	const tempElement = document.createElement("div");
	tempElement.innerHTML = html;
	while (tempElement.childNodes.length) {
		let node = tempElement.childNodes[0];
		tempElement.removeChild(node);
		if (!(node instanceof Text)) node = wrapHTMLElement(node);
		result.push(node);
	}
	return result;
};

const attributesAccessorHandler = {
	get: (o, k) => o.getAttribute(k),
	set: (o, k, v) => {
		o.setAttribute(k, v);
		return true;
	},
	has: (o, k) => o.hasAttribute(k),
	deleteProperty: (o, k) => {
		o.removeAttribute(k);
		return true;
	},
	ownKeys: (o) => Array.from(o.attributes).map(a => a.name),
	enumerable: true,
};

const dataAttributesAccessorHandler = {
	get: (o, k) => o.getAttribute("data-" + k),
	set: (o, k, v) => {
		o.setAttribute("data-" + k, v);
		return true;
	},
	has: (o, k) => o.hasAttribute("data-" + k),
	deleteProperty: (o, k) => o.removeAttribute("data-" + k),
	ownKeys: (o) => Reflect.ownKeys(o.dataset),
	enumerable: true,
};

const combineSubStyles = source => {
	return Object.keys(source).map(k => `${k}(${source[k]})`).join(" ");
};

const styleAccessorHandler = {
	set: (o, k, v) => {
		let match;
		if (k == "backgroundImageUrl") {
			k = "backgroundImage";
			v = `url('${v}')`;
		}
		if (match = k.match(/^filter_(\w+)$/)) {
			o.filters[match[1]] = v;
			o.element.style.filter = combineSubStyles(o.filters);
			return true;
		}
		if (match = k.match(/^transform_(\w+)$/)) {
			o.transforms[match[1]] = v;
			o.element.style.transform = combineSubStyles(o.transforms);
			return true;
		}
		if (/^--/.test(k)){
			o.element.style.setProperty(k, v);
		} else {
			o.element.style[k] = v;
		}
		return true;
	},
	get: (o, k) => {
		let match;
		if (match = k.match(/^filter_(\w+)$/)) {
			return o.filters[match[1]];
		}
		if (match = k.match(/^transform_(\w+)$/)) {
			return o.transforms[match[1]];
		}
		return o.element.style[k];
	}
};

const wrapStyles = element => {
	const filters = {};
	const transforms = {};
	return new Proxy({ element, filters, transforms }, styleAccessorHandler);
};

const flattenClasses = source => {
	let classes = [];
	const addClasses = (source) => {
		if (typeof source == "string") {
			source.trim().split(/\s+/).forEach(s => classes.push(s));
		} else if (Array.isArray(source)){
			// array (recurse)
			source.forEach(item => addClasses(item));
		} else if (typeof source == "object"){
			// { myclass: bool }
			addClasses(Object.keys(source).filter(k => source[k]));
		} else if(!source){
			// ignore falsy items
		}	else throw new Error("Invalid type for 'classes': " + typeof source);
	}
	addClasses(source);
	return classes;
};

// elem constructors define entity props and return the domElement they created
const elementWrapper = (spec, define) => {
	spec = { ...spec };

	const element = spec[wrapperSymbol] ? spec[wrapperSymbol] : document.createElement(spec.tag);

	if (spec[wrapperSymbol]) {
		spec.content = Array.from(element.childNodes);
	} else {
		const classes = flattenClasses(spec.classes);
		if (classes.length) {
			element.className = classes.join(" ");
		}
	}

	if (spec.html) {
		if (spec.content) throw new Error("HTML entity spec can include 'content' OR 'html'");
		spec.content = parseHtml(spec.html);
	}

	const attributesAccessor = new Proxy(element, attributesAccessorHandler);
	const dataAttributesAccessor = new Proxy(element, dataAttributesAccessorHandler);
	const styleAccessor = wrapStyles(element);

	if (spec.attribs) Object.keys(spec.attribs).forEach(k => element.setAttribute(k, spec.attribs[k]));
	if (spec.data) Object.keys(spec.data).forEach(k => element.setAttribute("data-" + k, spec.data[k]));

	const getAbsoluteLeft = () => {
		return element.getBoundingClientRect().left;
	};
	const getAbsoluteTop = () => {
		return element.getBoundingClientRect().top;
	};


	const propertyDefs = {
		enabled: {
			get: () => !element.disabled,
			set: v => element.disabled = !v
		}
	};

	// direct pass-through properties
	["value", "name", "checked", "autoplay", "spellcheck", "translate", "autofocus", "contentEditable", "lang",
	"scrollWidth", "scrollHeight", "scrollTop", "scrollLeft", "tabIndex", "width", "height"].forEach(prop => {
		propertyDefs[prop] = {
			get: () => element[prop],
			set: v => element[prop] = v,
			enumerable: true
		}
	});
	// bound methods
	["click", "getContext", "focus", "blur", "play", "pause", "getContext", "requestFullscreen",
	"requestPointerLock"].forEach(prop => {
		propertyDefs[prop] = {
			get: () => element[prop].bind(element)
		}
	});

	const childById = {};

	const addContent = (content, prepend = false) => {
		if (!content && typeof content != "number") return;
		let item;
		if (Array.isArray(content)) {
			if (prepend) {
				content = content.reverse();
			}
			content.forEach(c => addContent(c, prepend));
			return;
		}
		if (content instanceof HTMLElement) {
			item = wrapHTMLElement(content);
		} else if (content instanceof Text || content instanceof Jel) {
			item = content;
		} else if (["string", "number"].includes(typeof content)) {
			item = new Text(content);
		} else if (content.type) {
			item = new Jel(content.type, content);
		} else throw new Error("Invalid content type");

		const append = (!prepend || element.children.length == 0) ? l => element.appendChild(l) : l => element.insertBefore(l, element.children[0]);

		if (item instanceof Text) {
			append(item);
			return;
		}

		if (item instanceof Jel && item.id) {
			if(!childById.hasOwnProperty(item.id)){
				// new id; create accessor
				define({
					["$" + item.id]: {
						get: () => childById[item.id], enumerable: true,
						configurable: true,
					}
				});
			}
			childById[item.id] = item;
		}

		append(item.domElement);
	};

	const eventHandlerWrappers = new WeakMap();
	const wrapEventHandler = fn => {
		if (!eventHandlerWrappers.has(fn)) {
			eventHandlerWrappers.set(fn, ev => {
				if (ev.clientX !== undefined && ev.innerX === undefined) ev.innerX = ev.clientX - getAbsoluteLeft();
				if (ev.clientY !== undefined && ev.innerY === undefined) ev.innerY = ev.clientY - getAbsoluteTop();
				fn(ev);
			});
		}
		return eventHandlerWrappers.get(fn);
	};

	define({
		classes: { value: element.classList, enumerable: true },
		attribs: { value: attributesAccessor, enumerable: true },
		data: { value: dataAttributesAccessor, enumerable: true },
		on: { value: (eventName, handler) => element.addEventListener(eventName, wrapEventHandler(handler)) },
		off: { value: (eventName, handler) => element.removeEventListener(eventName, wrapEventHandler(handler)) },
		absoluteLeft: { get: getAbsoluteLeft },
		absoluteTop: { get: getAbsoluteTop },
		clientWidth: { get: () => element.clientWidth },
		clientHeight: { get: () => element.clientHeight },
		rect: { get: () => element.getBoundingClientRect() },

		qs: { value: query => wrapHTMLElement(element.querySelectorAll(query)) },
		qsa: { value: query => Array.from(element.querySelectorAll(query)).map(wrapHTMLElement) },
		parent: { get: () => element.parentElement && wrapHTMLElement(element.parentElement), },
		style: {
			get: () => styleAccessor,
			set: (k, v) => { element.style[k] = v; },
			enumerable: true
		},
		content: {
			get: () => [...element.childNodes].map(node => node instanceof Text ? node : wrapHTMLElement(node)),
			set: v => {
				element.innerHTML = "";
				addContent(v);
			}, enumerable: true
		},
		html: {
			get: () => element.innerHTML,
			set: v => {
				element.innerHTML = v;
			}, enumerable: true
		},
		text: {
			get: () => element.textContent,
			set: v => {
				element.innerHTML = "";
				addContent(v + "");
			},
			enumerable: true
		},
		append: { value: addContent, enumerable: true },
		prepend: { value: l => addContent(l, true), enumerable: true },
		remove: {
			value: entityToRemove => {
				const elementToRemove = entityToRemove instanceof Jel ? entityToRemove.domElement : entityToRemove;
				if (!(entityToRemove instanceof Jel) && !(entityToRemove instanceof Text)) throw new Error("Invalid type");
				element.removeChild(elementToRemove);
				if (entityToRemove instanceof Jel && entityToRemove.id) {
					delete childById[entityToRemove.id];
				}
			}
		},
		...propertyDefs
	});


	if (spec.content) {
		addContent(spec.content);
	}

	if (spec.style) {
		if (typeof spec.style == "string") {
			element.style = spec.style;
		} else Object.keys(spec.style).forEach(k => styleAccessor[k] = spec.style[k]);
	}

	spec = null;
	return element;
};

const domFunc = source => {
	if (source instanceof HTMLElement) return wrapHTMLElement(source);
	if (typeof source == "string") {
		if (source[0] === "<") {
			return parseHtml(source)[0];
		} else {
			return wrapHTMLElement(document.querySelector(source));
		}
	} else {
		throw new Error("Invalid argument");
	}
};

const createFactory = (entityTypes = {}) => {
	let customTypes = {};
	Object.keys(entityTypes).forEach(k => {
		customTypes[k] = spec => {
			return new Jel(entityTypes[k], spec);
		}
	});

	return customTypes;
};

Jel.factory = createFactory;
Jel.dom =  new Proxy(() => { }, {
	apply: (o, _, args) => domFunc(...args),
	get: (o, k) => {
		return (spec = {}) => {
			if (typeof spec == "string" || Array.isArray(spec)){
				spec = { content: spec };	
			}
			return new Jel(elementWrapper, { ...spec, tag: k });
		}
	}
});
Jel.parseHtml = parseHtml;

module.exports = Jel;