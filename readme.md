# Jelem
## Or, How I Learned To Stop Worrying And Love The DOM

Jelem is a lightweight DOM layer that lets us quickly and cleanly describe and manipulate element structures. Short for "JavaScript element", Jelem eschews markup and presents an interface more in line with JS's blend of objects and functions. HTML describes DOM structures but needn't dictate how we think about them in code.

## Demo

[https://www.aletaloves.me/jel_timeline_demo](https://www.aletaloves.me/jel_timeline_demo)

## Install
```
npm install jelem
```

## Use

```js
const Jel = require("jelem");
const $ = Jel.dom;

const contactForm = $.form({
	classes: "contact-form",
	attribs: {
		action: ".",
		method: "post",
	},
	content: [
		$.label("Name"),
		$.input({ name: "name" }),
		$.label("Email address"),
		$.input({ name: "email", }),
		$.label("Message"),
		$.textarea({ name: "body", }),
		$.input({
			attribs: {
				type: "sumbit",
			},
			content: "Send"
		})
	]
});

$(document.body).append(contactForm);
```

## Jel.dom

```js
const $ = Jel.dom;

// Jel.dom.TAG() creates an element of type TAG.

// create a h1 element
const heading = $.h1("Hello world");
// create a form element
const myForm = $.form({
	// containing said h1 and a button
	content: [
		heading,
		$.button("Click me")
	]
});

// wrap an existing HTMLElement
let thing = Jel.dom(document.getElementById("thing"));
// query the document by selector and wrap the first matching element
let myChild = Jel.dom(".my-container .my-child");
// create an element using a tag string
let link = Jel.dom("<a href='/'>click here</a>");
// to reliably convert HTML to Jel (where the first character might not be '<') use Jel.parseHtml("...")
```

## Element Factory Options

```js
const ui = $.div({
	classes: ["ui", "visible"],
	// or
	classes: "ui visible",
	// or
	classes: {
		ui: true,
		visible: isUiVisible
	},
	// or mix'n'match:
	classes: [
		"ui",
		{
			visible: isUiVisible
		}
	],
	content: "Hello world", // xss-safe; string content is rendered as text
	// or
	content: $.span("hello world"), // string/array param is used as content
	// or mix'n'match
	content: [
		"hello ",
		[
			$.span("world")
		],
		$.ul(posts.map(post => $.li(
			$.a({
				content: post.title,
				attribs: { href=post.url }
			})
		)))
	],
	// html is unsafe, make sure you trust the source yadda yadda
	html: "<p>hi there</p>",
	style: {
		opacity: 0.5,
		cursor: "busy",
		// filter_* and transform_* let us set (and animate) individual filters and transforms without having to keep track of the others. if chaining is required, use `filter` and `transform` as normal
		filter_blur: "5px",
		transform_rotateZ: "15deg",
	},
	attribs: {
		tabindex: 5
	},
	events: {
		click: e => alert("You clicked the div!"),
		mouseenter: e => console.log("You entered the div!"),
	}
});
```

## Element Interface

```js
// traditional
const rawDiv = document.createElement("div");
rawDiv.innerText = "hello world";
// Jel
const wrappedDiv = $.div("world world");

ui.classes.add("my-class");
ui.classes.toggle("my-class");
ui.classes = ["ui", "visible"];
ui.classes.toggle("errors", formErrors.length > 0);

const body = $(document.body);
body.append(wrappedDiv); // append a Jel
body.append("hello world"); // append a text node
body.append(rawDiv); // append an HTMLElement
body.append([rawDiv, wrappedDiv, null, "hello world"]); // append an array
// (falsy items are ignored, for easy mapping and conditional elements)

let areWrappersCached = body === $(document.body); // true

ui.on("click", handleClickEvent);

// qsa returns an array of (Jel-wrapped) elements
let anchors = $(body).qsa("footer a");
anchors.forEach(a => a.attribs.rel = "noopener");
```

## IDs

ID in an element spec does not produce an `id` attribute. It creates a reference to the element, accessible via the parent.

```js
const ui = $.div({
	classes: "ui",
	content: [
		$.input({
			id: "nameInput",
		}),
		$.button({
			content: "Greet me",
			events: {
				click: () => {
					alert(ui.$nameInput.value); // <- ids produce parent.$<id>
				}
			}
		})
	]
});
```

To produce an `id` attribute, use `attribs`:

```js
const ui = $.div({
	attribs: {
		id: "main-ui",
	}
});
```

## Use Components

```js
const Jel = require("jelem");
const j = Jel.factory({
	slidebar: require("jel-slidebar"),
});

const ui = $.form({
	content: [
		$.h3("Min Price"),
		j.slidebar({
			min: 0,
			max: 1000,
			events: {
				change: e => {
					setMinimumPrice(e);
				}
			}
		}),
	],
]);
```

## Author Components

Many components can simply be a function that returns a (Jel-wrapped or not) element:

```js
const Jel = require("jelem");
const $ = Jel.dom;

const labeledInput = (spec) => $.div({
	classes: "labeledInput",
	content: [
		$.label(spec.caption),
		$.input({
			name: spec.name,
			value: spec.value,
			attribs: { type: spec.inputType }
		})
	]
});

$(document.body).append($.form([
	labeledInput({
		caption: "Username or Email address",
		name: "username",
	}),
	labeledInput({
		inputType: "password",
		caption: "Password",
		name: "password",
	})
]));

```

More comprehensive components can take the form `(spec, define, trigger) => HTMLElement|Jel` and, via `Jel.factory()`, create components with an interface consistent with other Jel elements. Use `define()` to define properties on the created component object and `trigger()` to fire an event.

```js
const labeledInput = (spec, define, trigger) => {
	const input = $.input({
		name: spec.name,
		value: spec.value,
		type: spec.inputType,
		events: {
			change: e => trigger("change", e),
		}
	});

	const main = $.div({
		classes: "labeledInput",
		content: [
			$.label(spec.caption),
			input
		]
	});

	define({
		value: { 
			get: () => input.value,
			set: v => input.value = v,
		}
	});

	return main;
};

const j = Jel.factory({
	labeledInput
});
const myLabeledInput = j.labeledInput({
	caption: "Username",
	events: {
		change: e => { ... }
	}
});

```

See [jel-slidebar.js](https://github.com/thecynicslantern/jelem/blob/master/src/jel-slidebar.js) for a fuller example.

