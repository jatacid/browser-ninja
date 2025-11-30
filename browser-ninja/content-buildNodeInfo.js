window.buildNodeInfoCode = `
const truncateListOrString = (arr) => {
	if (Array.isArray(arr)) {
		let joined = arr.map(s => typeof s === 'string' ? s.replace(/"/g, "'") : s).join(', ');
		if (arr.length > 10 || joined.length > 400) {
			let truncated = arr.slice(0, 10).map(s => typeof s === 'string' ? s.replace(/"/g, "'") : s).join(', ');
			if (truncated.length > 400) truncated = truncated.slice(0, 400);
			return (truncated + " [...truncated, request for more context separately as needed]");
		}
		return joined;
	} else if (typeof arr === 'string') {
		let str = arr.replace(/"/g, "'");
		if (str.length > 400) return (str.slice(0, 400) + " [...truncated, request for more context separately as needed]");
		return str;
	}
	return arr;
};

const getSiblingCount = (el) => {
	if (!el || !el.parentNode) return 0;
	return Array.from(el.parentNode.children).length;
};

const getComputedVisibility = (el) => {
	if (!el || !(el instanceof Element)) return 'none';
	try {
		const style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return 'hidden';
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return 'hidden';
		return 'visible';
	} catch (e) {
		return 'unknown';
	}
};

const getOpacity = (el) => {
	if (!el || !(el instanceof Element)) return undefined;
	try { return window.getComputedStyle(el).opacity; } catch (e) { return undefined; }
};

const isInViewport = (el) => {
	if (!el || !(el instanceof Element)) return false;
	try {
		const rect = el.getBoundingClientRect();
		return (rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0);
	} catch (e) { return false; }
};

const isObfuscatedClass = (cls) => {
	return /^[a-zA-Z0-9-_]{1,6}$/.test(cls) || /^[a-zA-Z]*[0-9-_]+[a-zA-Z0-9-_]*$/.test(cls) || /^[a-zA-Z]{1,2}[0-9-_]/.test(cls);
};

const sanitizeOuterHTML = (el) => {
	if (!el || !el.cloneNode) return '';
	let clone = el.cloneNode(true);
	const allowedAttrs = [
		'href', 'style', 'tabindex', 'title', 'id', 'class', 'hidden'
	];
	const inputAttrs = [
		'type', 'name', 'value', 'placeholder', 'autocomplete', 'autocorrect', 'autocapitalize', 'min', 'max', 'step', 'pattern', 'required', 'checked', 'disabled', 'readonly', 'multiple', 'size', 'maxlength', 'minlength', 'form', 'list', 'accept', 'capture', 'spellcheck', 'inputmode', 'autofocus'
	];
	function clean(node) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			if (node.namespaceURI && node.namespaceURI.includes('svg') && node.tagName.toLowerCase() === 'path') {
				node.parentNode && node.parentNode.removeChild(node);
				return;
			}
			const tag = node.tagName.toLowerCase();
			if (["script", "style", "desc", "metadata"].includes(tag)) {
				node.parentNode && node.parentNode.removeChild(node);
				return;
			}
			Array.from(node.attributes).forEach(attr => {
				const n = attr.name;
				if (
					allowedAttrs.includes(n) ||
					n.startsWith('data-') ||
					n.startsWith('aria-') ||
					(node.tagName === 'INPUT' && inputAttrs.includes(n))
				) {
					if (n === 'class') {
						const classes = (node.getAttribute('class') || '').split(/\\s+/).filter(Boolean);
						if (classes.length > 0) {
							const semanticKeywords = ['content', 'main', 'header', 'footer', 'nav', 'sidebar', 'menu', 'container', 'wrapper', 'row', 'col', 'section', 'article', 'aside', 'body', 'page', 'layout', 'panel', 'card', 'item', 'list', 'grid', 'form', 'button', 'input', 'title', 'text', 'image', 'link', 'modal', 'popup', 'overlay', 'tooltip', 'dropdown', 'tab', 'accordion', 'carousel', 'slider', 'gallery', 'player', 'controls', 'widget', 'component'];
							function isSemanticClass(cls) {
								return semanticKeywords.some(keyword => cls.toLowerCase().includes(keyword));
							}
							const descriptive = [];
							const semantic = [];
							const obfuscated = [];
							classes.forEach(cls => {
								if (isObfuscatedClass(cls)) {
									obfuscated.push(cls);
								} else if (isSemanticClass(cls)) {
									semantic.push(cls);
								} else {
									descriptive.push(cls);
								}
							});
							const keep = [];
							for (let i = 0; i < descriptive.length && keep.length < 5; i++) {
								keep.push(descriptive[i]);
							}
							for (let i = 0; i < semantic.length && keep.length < 5; i++) {
								keep.push(semantic[i]);
							}
							for (let i = 0; i < obfuscated.length && keep.length < 5; i++) {
								keep.push(obfuscated[i]);
							}
							const total = descriptive.length + semantic.length + obfuscated.length;
							if (total > 5) {
								var truncatedCount = total - 5;
								keep.push(truncatedCount + 'MoreClassesTruncated');
							}
							node.setAttribute('class', keep.join(' ').trim());
						}
					}
					return;
				}
				node.removeAttribute(n);
			});
		}
		Array.from(node.childNodes).forEach(clean);
	}
	clean(clone);
	return clone.outerHTML || '';
};

const getCssSelectorChain = (el) => {
	const chain = [];
	let node = el;
	let isFirstElement = true;
	while (node && node.nodeType === Node.ELEMENT_NODE) {
		const selectors = [];
		selectors.push(node.tagName.toLowerCase().replace(/"/g, "'"));
		if (node.id) selectors.push('#' + node.id);
		const dataAttrs = [];
		const otherAttrs = [];
		Array.from(node.attributes).forEach(function(attr) {
			if (/^data-/.test(attr.name)) {
				dataAttrs.push('[' + attr.name + "='" + attr.value.replace(/"/g, "'") + "']");
			} else if (/^aria-/.test(attr.name)) {
				otherAttrs.push('[' + attr.name + "='" + attr.value.replace(/"/g, "'") + "']");
			} else if (["role","type","name","title","href","label"].indexOf(attr.name) !== -1) {
				otherAttrs.push('[' + attr.name + "='" + attr.value.replace(/"/g, "'") + "']");
			} else if (["checked","disabled","selected","required","hidden"].indexOf(attr.name) !== -1) {
				if (node.hasAttribute(attr.name)) otherAttrs.push('[' + attr.name + ']');
			}
		});
		selectors.push.apply(selectors, dataAttrs);
		selectors.push.apply(selectors, otherAttrs);
		var classes = Array.from(node.classList).filter(function(cls) { return cls.trim(); });
		if (classes.length > 0) {
			var classSelectors = classes.map(function(cls) { return '.' + cls.replace(/"/g, "'"); });
			selectors.push.apply(selectors, classSelectors);
		}
		if (isFirstElement) { isFirstElement = false; }
		chain.unshift(selectors);
		node = node.parentElement;
	}
	return { chain };
};

const buildNodeInfo = (node) => {
	if (!node) return null;
	try {
		const selectorData = getCssSelectorChain(node);
		return {
			tagName: node.tagName ? node.tagName.toLowerCase() : null,
			innerText: truncateListOrString(node.innerText || ''),
			outerHTML: truncateListOrString(sanitizeOuterHTML(node)),
			siblingCount: truncateListOrString(getSiblingCount(node)),
			visibility: truncateListOrString(getComputedVisibility(node)),
			opacity: truncateListOrString(getOpacity(node)),
			inViewport: truncateListOrString(isInViewport(node)),
			selectorChain: selectorData.chain,
			timestamp: Date.now()
		};
	} catch (e) { return null; }
};
`;

try {
	eval(window.buildNodeInfoCode);
} catch (e) {
	// console.log('buildNodeInfo eval blocked by CSP - functions already defined',e);
}