const Jel = require("./index");
const $ = Jel.dom;

// Jel components are functions of this signature:

module.exports = function slidebar(spec, define, trigger){
	spec = { // some defaults
		min: 0,
		max: 1,
		position: 0,
		margin: .1,
		style: {},
		...spec,
	};

	let position;
	// calculate inner bar's starting width
	const startPos = (spec.position - spec.min) / (spec.max - spec.min);

	// create the dom structure
	const outer = $.div({
		style: {
			userSelect: "none",
			...spec.style
		},
		classes: ["jel-slidebar", spec.classes], // let user input {classes: ...} in spec
		content: [
			$.input({ // lets us use slidebar in forms without special effort
				attribs: {
					name: spec.name
				},
				style: {
					opacity: 0,
					pointerEvents: "none",
					position: "absolute"
				}
			}),
			$.div({
				id: "inner",
				classes: "jel-slidebar-inner",
				style: {
					position: "absolute",
					top: 0, left: 0, bottom: 0,
					boxSizing: "border-box",
					width: startPos * 100 + "%"
				}
			}),
			$.div({ // for the hover preview
				id: "preview",
				classes: "jel-slidebar-preview",
				style: {
					position: "absolute",
					top: 0, left: 0, bottom: 0,
					boxSizing: "border-box",
				},
			}),
			$.div({ // the drag area is shown when dragging, to expand the sensitive area
				id: "dragArea",
				style: {
					position: "fixed",
					top: 0, bottom: 0,
					display: "none"
				}
			})
		]
	});

	// id in spec does not produce id attributes. instead it creates parent.$<id>
	// (jel components should generally be self-contained and not reference elements by dom id)
	// (to produce an id attribute use $.div({attribs: {id: "hello"}}))
	const inner = outer.$inner;
	const preview = outer.$preview;
	const dragArea = outer.$dragArea;

	// expand inner when position changes
	const setPosition = p => {
		position = p;
		const progress = (p-spec.min) / (spec.max - spec.min);
		inner.style.width = progress * 100 + "%";
	};

	// we could check dragArea.style.display === "block" but this is cleaner
	let dragging = false;

	const handleMove = ev => {
		// show the hover-preview bar
		preview.style.opacity = 1;
		// calculate position accounting for margin
		const margin = spec.margin;
		const x = ev.innerX - outer.clientWidth * margin;
		const xRange = outer.clientWidth * (1 - margin * 2);
		let pos = Math.max(0, Math.min(1, x / xRange));
		preview.style.width = pos * 100 + "%"; // apply to preview
		if (dragging) { // and position, if dragging
			setPosition(pos * (spec.max - spec.min) + spec.min);
			// call the passed-in trigger() to fire an event
			trigger("change", position);
		}
	};

	// now the mouse events
	outer.on("mousemove", ev => {
		handleMove(ev);
		dragArea.style.width = outer.clientWidth + "px";
	});
	outer.on("mousedown", ev => {
		if (ev.button == 0) {
			dragArea.style.display = "block";
			dragging = true;
			handleMove(ev);
		}
	});
	outer.on("mouseup", ev => {
		if (ev.button == 0) {
			dragging = false;
			dragArea.style.display = "none";
		}
	});
	outer.on("mouseleave", () => {
		preview.style.opacity = 0;
		dragArea.style.display = "none";
		dragging = false;
	});

	// define() produces properties on the resulting jel element
	define({
		position: {
			get: () => position,
			set: setPosition
		}
	});

	// define.importDom() forwards the standard DOM properties of this component to another Jel element
	// for example, now mySlidebar.style refers to outer.style, along with .clientWidth, parent, qsa(), etc
	define.importDom(outer);

	return outer; // jel component functions return the containing element(s)
};
