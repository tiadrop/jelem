const $ = require("./index").dom;

module.exports = (spec, defineProperties, triggerEvent) => {
	spec = { ...{
			dragMinimum: 4,
			historySize: 100,
			autoScroll: true
		}, ...spec };
	let mousedownX = null, mousedownY = null;
	let history = [];
	let historyPosition = null;
	let futureText = "";

	const addHistory = s => {
		// remove if exists (and dec histpos)
		let idx = history.indexOf(s);
		if(idx !== -1){
			history.splice(idx, 1);
			if(historyPosition !== null && historyPosition >= idx) historyPosition--;
			// not that historyPos can be < idx but now if that changes this'll be fine
			if(historyPosition === -1 && history.length > 0){
				inEnt.value = history[0];
			}
		}

		history.push(s);
		// cull to historySize
		const diff = history.length - spec.historySize;
		if(diff > 0){
			history = history.slice(diff);
			if(historyPosition !== null) historyPosition -= diff;
		}
		if(historyPosition !== null && historyPosition < 0) historyPosition = 0;
	};

	const layout = $.div({
		classes: ["jel-console", ...spec.classes],
		style: spec.style,
		content: [
			$.div({
				classes: "jel-console-output",
				id: "out",
				events: {
					mousedown: ev => {
						if(ev.button === 0) {
							mousedownX = ev.innerX;
							mousedownY = ev.innerY;
						}
					},
					mouseup: ev => {
						if(ev.button === 0) {
							let dist = Math.sqrt(Math.pow((mousedownX - ev.innerX), 2) + Math.pow((mousedownY - ev.innerY), 2));
							if (dist < spec.dragMinimum) layout.$in.$input.focus();
						}
					}
				}
			}),
			$.div({
				classes: "jel-console-input",
				id: "in",
				content: [
					$.div({
						id: "prompt",
						classes: "jel-console-prompt",
					}),
					$.input({
						id: "input",
						events: {
							mousedown: ev => ev.stopPropagation(),
							keydown: ev => {
								const input = layout.$in.$input;
								if(ev.key === "Enter") {
									ev.preventDefault();
									const text = input.value;
									input.value = "";
									historyPosition = null;
									if (spec.historySize > 0 && text !== history[history.length - 1]) addHistory(text);
									triggerEvent("input", {
										text,
										keyEvent: ev
									});
								} else if(ev.key === "Escape"){
									input.domElement.select();
								} else if(ev.key === "ArrowUp"){
									if(!history.length) return;
									if(historyPosition === null){
										futureText = input.value;
										historyPosition = history.length - 1;
									} else {
										// user edited while in history? consider it `future` and restart history
										if(input.value !== history[historyPosition]){
											historyPosition = history.length; // will be dec'd
											futureText = input.value;
										}
										historyPosition--;
										if(historyPosition < 0) historyPosition = 0;
									}
									input.value = history[historyPosition];
								} else if(ev.key === "ArrowDown"){
									if(historyPosition === null) {
										input.domElement.select();
										return;
									}
									// user edited while in history? consider it `future` and select()
									if(input.value !== history[historyPosition]){
										historyPosition = null;
										input.domElement.select();
										return;
									}
									historyPosition++;
									if(historyPosition >= history.length){
										historyPosition = null;
										input.value = futureText;
									} else {
										input.value = history[historyPosition];
									}
								} else if(ev.key === "Tab"){
									const content = layout.$in.$input.value;
									ev.preventDefault();
									triggerEvent("tab", {
										append: s => {
											if(layout.$in.$input.value === content) { // only if hasn't changed
												layout.$in.$input.value += s
											}
										}
									});
								}

								// else console.log("in k", ev.key)
								ev.stopPropagation();
								triggerEvent("keydown", ev);
							},
							focus: ev => triggerEvent("focus", ev),
							blur: ev => triggerEvent("blur", ev),
							click: ev => triggerEvent("clickInput", ev),
							keyup: ev => triggerEvent("keyup", ev),
							keypress: ev => triggerEvent("keypress", ev),
							paste: ev => triggerEvent("paste", ev)
						}
					}),
					...(Array.isArray(spec.content) ? spec.content : [spec.content])
				]
			})
		]
	});

	const outEnt = layout.$out;
	const inEnt = layout.$in.$input;
	const promptEnt = layout.$in.$prompt;
	const autoScrollThreshold = 12;

	const write = (s, style) => {
		if(Array.isArray(s)) return void s.forEach(ss => write(ss, style));
		const el = outEnt.domElement;
		const atEnd = el.scrollHeight - (el.scrollTop + el.clientHeight) < autoScrollThreshold;
		outEnt.append(style === undefined ? s : $.span({ style, content: s }));
		if(atEnd){
			if(spec.autoScroll){
				el.scrollTop = el.scrollHeight;
			} else {
				triggerEvent("autoscroll", {
					domElement: el,
					target: el.scrollHeight
				});
			}
		}
	};

	const writeHtml = (s, style) => {
		const el = outEnt.domElement;
		const atEnd = el.scrollHeight - (el.scrollTop + el.clientHeight) < autoScrollThreshold;
		layout.$out.append(style ? $.div({ html: s+"", style }) : $.span({html: s}));
		if(atEnd) el.scrollTop = el.scrollHeight;
	};

	const defineValueProperties = props => {
		const map = {};
		Object.keys(props).forEach(k => {
			map[k] = { value: props[k], enumerable: true }
		});
		defineProperties(map);
	};

	defineValueProperties({
		write,
		writeHtml,
		writeLn: (s = "", style) => {
			write(s, style)
			write("\n");
		},
		classes: layout.classes,
		clear: () => outEnt.html = "",
		getBuffer: (asHtml = false) => {
			return asHtml ? outEnt.html : outEnt.content;
		},
		focus: () => layout.$in.$input.focus(),
		blur: () => layout.$in.$input.blur(),
		scrollToEnd: () => {
			layout.$out.domElement.scrollTo(0, layout.$out.domElement.scrollHeight);
		},
		scrollTo: v => {
			layout.$out.domElement.scrollTo(0, v);
		},
		forceInput: text => {
			historyPosition = null;
			if (spec.historySize > 0 && text !== history[history.length - 1]) addHistory(text);
			triggerEvent("input", {
				text,
			});
		}
	});

	const setPrompt = (s, allowHtml) => {
		promptEnt[allowHtml ? "html" : "content"] = s;
		inEnt.style.paddingLeft = promptEnt.domElement.clientWidth + promptEnt.domElement.offsetLeft + "px";
		setTimeout(() => {
			inEnt.style.paddingLeft = promptEnt.domElement.clientWidth + promptEnt.domElement.offsetLeft + "px";
		}, 1)
	};

	if(spec.prompt) setPrompt(spec.prompt);

	defineProperties({
		prompt: {
			get: () => promptEnt.html,
			set: s => setPrompt(s)
		},
		setPrompt: { value: setPrompt },
		inputValue: {
			get: () => inEnt.value,
			set: v => inEnt.value = v
		},
		output: { get: () => layout.$out },
		style: { get: () => layout.style },
		scrollY: {
			get: () => layout.$out.domElement.scrollTop,
			set: v => layout.$out.domElement.scrollTo(0, v),
		},
		scrollHeight: {
			get: () => layout.$out.domElement.scrollHeight,
		}
	});

	return layout;
};