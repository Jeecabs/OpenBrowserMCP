/**
 * ARIA Snapshot Generator for Chrome Extension Content Scripts
 *
 * Adapted from Playwright's ariaSnapshot implementation.
 * Generates accessibility tree snapshots for LLM consumption via TOON encoding.
 *
 * Key features:
 * - Traverses DOM including shadow DOM and aria-owns relationships
 * - Computes accessible roles and names following ARIA spec
 * - Tracks element states (focused, checked, disabled, expanded, etc.)
 * - Assigns stable refs to interactive elements
 * - Handles visibility detection
 */

import type { AriaElement, AriaSnapshot } from "./protocol";

let elementRefCounter = 0;
const elementRefMap = new WeakMap<Element, string>();

/**
 * Generate an ARIA accessibility tree snapshot of the current page.
 *
 * This function traverses the DOM (including shadow DOM and aria-owns relationships)
 * and extracts accessibility information for interactive and semantically meaningful elements.
 *
 * The snapshot includes:
 * - Element references (e1, e2, etc.) for interaction targeting
 * - ARIA roles (both explicit and implicit from HTML semantics)
 * - Accessible names (from aria-label, labels, text content, etc.)
 * - Element states (focused, checked, disabled, expanded, etc.)
 *
 * @returns AriaSnapshot object with page metadata and element list
 */
export function generateAriaSnapshot(): AriaSnapshot {
  // Reset counter for new snapshot
  elementRefCounter = 0;

  const elements: AriaElement[] = [];

  // Walk the DOM tree starting from document.body
  if (document.body) {
    walkAriaTree(document.body, elements);
  }

  return {
    url: window.location.href,
    title: document.title,
    elements
  };
}

/**
 * Recursively walk the DOM tree and build ARIA elements.
 *
 * This function performs a depth-first traversal of the accessibility tree,
 * handling special cases like:
 * - Shadow DOM (traverses shadow roots)
 * - Slot elements (follows slotted content)
 * - aria-owns (includes owned elements)
 * - Hidden elements (skips them and their descendants)
 *
 * @param node - The DOM node to process
 * @param elements - Accumulator array for discovered ARIA elements
 */
function walkAriaTree(node: Node, elements: AriaElement[]): void {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = node as Element;

  // Skip hidden elements
  if (isHidden(element)) {
    return;
  }

  const role = getAriaRole(element);

  // Only include elements with meaningful roles
  if (role && shouldIncludeElement(role, element)) {
    const ref = getOrCreateRef(element);
    const name = getAccessibleName(element);
    const states = getAriaStates(element, role);

    elements.push({
      ref,
      role,
      name,
      states
    });
  }

  // Recursively process children (including shadow DOM and aria-owns)
  const children = getChildren(element);
  for (const child of children) {
    walkAriaTree(child, elements);
  }

  // Handle aria-owns: elements owned by this element but located elsewhere in DOM
  const owns = element.getAttribute('aria-owns');
  if (owns) {
    const ownedIds = owns.split(/\s+/);
    for (const id of ownedIds) {
      if (id) {
        const owned = document.getElementById(id);
        if (owned) {
          walkAriaTree(owned, elements);
        }
      }
    }
  }
}

/**
 * Get or create a stable reference for an element.
 *
 * Refs are cached in a WeakMap so that the same element always gets the same ref
 * within a session (until the element is garbage collected).
 *
 * @param element - The element to get a ref for
 * @returns A unique reference string like "e1", "e2", etc.
 */
function getOrCreateRef(element: Element): string {
  let ref = elementRefMap.get(element);
  if (!ref) {
    elementRefCounter++;
    ref = `e${elementRefCounter}`;
    elementRefMap.set(element, ref);
  }
  return ref;
}

/**
 * Find an element by its reference ID.
 *
 * This is used by the interaction handler to locate elements for clicking, typing, etc.
 *
 * @param ref - The reference string (e.g., "e1")
 * @returns The element with that ref, or null if not found
 */
export function findElementByRef(ref: string): Element | null {
  for (const [element, elementRef] of elementRefMap.entries()) {
    if (elementRef === ref) {
      return element;
    }
  }
  return null;
}

/**
 * Get the ARIA role of an element (explicit or implicit).
 *
 * Priority:
 * 1. Explicit role attribute (takes first if multiple roles specified)
 * 2. Implicit role from HTML semantics
 *
 * Special cases:
 * - <a> without href has no implicit role
 * - <img> without alt is treated as presentational
 * - <input> role depends on type attribute
 * - <select> with multiple attribute is listbox, otherwise combobox
 *
 * @param element - The element to get role for
 * @returns The ARIA role or null if no semantic role
 */
function getAriaRole(element: Element): string | null {
  // Explicit ARIA role (take first if multiple specified)
  const explicitRole = element.getAttribute("role");
  if (explicitRole) {
    return explicitRole.split(/\s+/)[0];
  }

  // Implicit roles based on HTML semantics
  const tagName = element.tagName.toLowerCase();
  const implicitRoles: Record<string, string | null> = {
    "a": element.hasAttribute("href") ? "link" : null,
    "button": "button",
    "input": getInputRole(element as HTMLInputElement),
    "textarea": "textbox",
    "select": element.hasAttribute("multiple") ? "listbox" : "combobox",
    "h1": "heading",
    "h2": "heading",
    "h3": "heading",
    "h4": "heading",
    "h5": "heading",
    "h6": "heading",
    "img": element.hasAttribute("alt") ? "img" : null,
    "nav": "navigation",
    "main": "main",
    "header": "banner",
    "footer": "contentinfo",
    "aside": "complementary",
    "section": "region",
    "article": "article",
    "form": "form",
    "table": "table",
    "ul": "list",
    "ol": "list",
    "li": "listitem",
    "dialog": "dialog",
    "td": "cell",
    "th": "columnheader"
  };

  return implicitRoles[tagName] || null;
}

/**
 * Get the ARIA role for an input element based on its type attribute.
 *
 * @param input - The input element
 * @returns The appropriate ARIA role
 */
function getInputRole(input: HTMLInputElement): string {
  const type = input.type.toLowerCase();
  const typeRoles: Record<string, string> = {
    "button": "button",
    "checkbox": "checkbox",
    "radio": "radio",
    "text": "textbox",
    "email": "textbox",
    "password": "textbox",
    "search": "searchbox",
    "tel": "textbox",
    "url": "textbox",
    "number": "spinbutton",
    "range": "slider"
  };

  return typeRoles[type] || "textbox";
}

/**
 * Computes the accessible name for an element.
 *
 * This is a simplified implementation of the ARIA accessible name computation algorithm.
 * Priority order:
 * 1. aria-labelledby (references to other elements)
 * 2. aria-label (explicit label)
 * 3. Associated <label> elements (for form controls)
 * 4. alt attribute (for images)
 * 5. title attribute
 * 6. placeholder (for inputs)
 * 7. Text content (for buttons, links, headings)
 * 8. Value (for inputs/textareas)
 *
 * @param element - The element to compute name for
 * @returns The accessible name (normalized whitespace)
 */
function getAccessibleName(element: Element): string {
  // aria-labelledby takes precedence
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const names = ids
      .map(id => document.getElementById(id))
      .filter(el => el !== null)
      .map(el => el!.textContent || "")
      .join(" ");
    if (names) {
      return normalizeWhitespace(names);
    }
  }

  // aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return normalizeWhitespace(ariaLabel);
  }

  // For form controls, check associated labels
  if (element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) {
    // Check labels collection
    const labels = (element as any).labels;
    if (labels && labels.length > 0) {
      return normalizeWhitespace(labels[0].textContent || "");
    }

    // Check for wrapping label
    const label = element.closest("label");
    if (label) {
      return normalizeWhitespace(label.textContent || "");
    }
  }

  // For images, use alt text
  if (element instanceof HTMLImageElement) {
    return normalizeWhitespace(element.alt);
  }

  // title attribute
  const title = element.getAttribute("title");
  if (title) {
    return normalizeWhitespace(title);
  }

  // placeholder (for inputs)
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) {
    return normalizeWhitespace(placeholder);
  }

  // For specific elements, use text content
  const role = getAriaRole(element);
  if (role && ["button", "link", "heading", "menuitem", "tab"].includes(role)) {
    return normalizeWhitespace(element.textContent || "");
  }

  // For textareas and inputs with values, use the value
  if (element instanceof HTMLTextAreaElement) {
    return normalizeWhitespace(element.value);
  }

  if (element instanceof HTMLInputElement && element.value) {
    return normalizeWhitespace(element.value);
  }

  // Default to text content (limited to first 100 chars to avoid huge names)
  const textContent = element.textContent || "";
  return normalizeWhitespace(textContent.substring(0, 100));
}

/**
 * Normalizes whitespace in a string (collapses multiple spaces/newlines, trims).
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Extract ARIA states for an element based on its role.
 *
 * States are only extracted for roles that support them. This follows the ARIA spec
 * to avoid reporting meaningless states.
 *
 * Tracked states:
 * - focused: Element has keyboard focus
 * - checked/unchecked: For checkboxes, radios, switches (also supports "mixed")
 * - disabled: Element is disabled
 * - expanded/collapsed: For expandable elements
 * - pressed: For toggle buttons (also supports "mixed")
 * - selected: For selectable items
 * - level: For headings and tree items
 *
 * @param element - The DOM element
 * @param role - The element's ARIA role
 * @returns Space-separated state string
 */
function getAriaStates(element: Element, role: string): string {
  const states: string[] = [];

  // Focus state (for all elements)
  if (element === document.activeElement) {
    states.push("focused");
  }

  // Checked state (checkbox, radio, menuitemcheckbox, menuitemradio, switch)
  const checkedRoles = ["checkbox", "radio", "menuitemcheckbox", "menuitemradio", "switch"];
  if (checkedRoles.includes(role)) {
    const checked = getCheckedState(element);
    if (checked === true) {
      states.push("checked");
    } else if (checked === false) {
      states.push("unchecked");
    } else if (checked === "mixed") {
      states.push("checked=mixed");
    }
  }

  // Disabled state (various interactive roles)
  const disabledRoles = [
    "button", "checkbox", "combobox", "gridcell", "link", "listbox",
    "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio",
    "searchbox", "slider", "spinbutton", "switch", "tab", "textbox"
  ];
  if (disabledRoles.includes(role)) {
    const disabled = getDisabledState(element);
    if (disabled) {
      states.push("disabled");
    }
  }

  // Expanded state (button, combobox, disclosure, etc.)
  const expandedRoles = ["button", "combobox", "disclosure", "menu", "menubar", "navigation", "tab"];
  if (expandedRoles.includes(role)) {
    const ariaExpanded = element.getAttribute("aria-expanded");
    if (ariaExpanded === "true") {
      states.push("expanded");
    } else if (ariaExpanded === "false") {
      states.push("collapsed");
    }
  }

  // Pressed state (button)
  if (role === "button") {
    const ariaPressed = element.getAttribute("aria-pressed");
    if (ariaPressed === "true") {
      states.push("pressed");
    } else if (ariaPressed === "false") {
      states.push("not-pressed");
    } else if (ariaPressed === "mixed") {
      states.push("pressed=mixed");
    }
  }

  // Selected state (option, tab, etc.)
  const selectedRoles = ["option", "tab", "treeitem", "gridcell"];
  if (selectedRoles.includes(role)) {
    const selected = getSelectedState(element);
    if (selected) {
      states.push("selected");
    }
  }

  // Level (for headings and tree items)
  if (role === "heading" || role === "treeitem") {
    const level = getLevel(element);
    if (level !== undefined) {
      states.push(`level=${level}`);
    }
  }

  return states.join(" ");
}

/**
 * Gets the checked state of an element.
 *
 * @param element - Element to check
 * @returns true, false, "mixed", or undefined
 */
function getCheckedState(element: Element): boolean | "mixed" | undefined {
  const ariaChecked = element.getAttribute("aria-checked");
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;
  if (ariaChecked === "mixed") return "mixed";

  if (element instanceof HTMLInputElement) {
    if (element.indeterminate) return "mixed";
    return element.checked;
  }

  return undefined;
}

/**
 * Gets the disabled state of an element.
 *
 * @param element - Element to check
 * @returns true if disabled
 */
function getDisabledState(element: Element): boolean {
  const ariaDisabled = element.getAttribute("aria-disabled");
  if (ariaDisabled === "true") return true;

  if (element instanceof HTMLInputElement ||
      element instanceof HTMLButtonElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) {
    return element.disabled;
  }

  return false;
}

/**
 * Gets the selected state of an element.
 *
 * @param element - Element to check
 * @returns true if selected
 */
function getSelectedState(element: Element): boolean {
  const ariaSelected = element.getAttribute("aria-selected");
  if (ariaSelected === "true") return true;

  if (element instanceof HTMLOptionElement) {
    return element.selected;
  }

  return false;
}

/**
 * Gets the level of a heading or tree item.
 *
 * @param element - Element to check
 * @returns The level number or undefined
 */
function getLevel(element: Element): number | undefined {
  const ariaLevel = element.getAttribute("aria-level");
  if (ariaLevel) {
    const level = parseInt(ariaLevel, 10);
    if (!isNaN(level)) return level;
  }

  // For headings, extract from tag name (h1-h6)
  const match = element.tagName.match(/^H(\d)$/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  return undefined;
}

/**
 * Determines if an element should be included in the snapshot.
 *
 * Includes:
 * - Interactive elements (buttons, links, form controls, etc.)
 * - Structural/landmark elements (headings, navigation, main, etc.)
 * - Images with alt text
 * - Menu items, tabs, tree items
 *
 * This helps reduce noise by excluding purely presentational elements.
 *
 * @param role - The element's ARIA role
 * @param element - The DOM element
 * @returns true if element should be included
 */
function shouldIncludeElement(role: string, element: Element): boolean {
  // Include interactive elements
  const interactiveRoles = [
    "button", "link", "textbox", "checkbox", "radio",
    "combobox", "searchbox", "slider", "spinbutton",
    "menuitem", "menuitemcheckbox", "menuitemradio",
    "tab", "switch", "option", "treeitem"
  ];

  if (interactiveRoles.includes(role)) {
    return true;
  }

  // Include structural/landmark elements
  const structuralRoles = [
    "heading", "navigation", "main", "banner", "contentinfo",
    "complementary", "region", "article", "form", "search"
  ];

  if (structuralRoles.includes(role)) {
    return true;
  }

  // Include images with alt text
  if (role === "img" && element.getAttribute("alt")) {
    return true;
  }

  return false;
}

/**
 * Checks if an element is hidden from the accessibility tree.
 *
 * An element is considered hidden if:
 * - aria-hidden="true" is set
 * - CSS display is "none"
 * - CSS visibility is "hidden"
 * - Element has zero bounding box (width and height both 0)
 *
 * Note: This is a simplified check. The full ARIA spec has more complex rules
 * involving parent visibility, content-visibility, etc.
 *
 * @param element - Element to check
 * @returns true if element is hidden
 */
function isHidden(element: Element): boolean {
  // Check aria-hidden first (most explicit)
  if (element.getAttribute("aria-hidden") === "true") {
    return true;
  }

  // Check computed styles
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return true;
  }

  // Check if element has zero size (could be offscreen or collapsed)
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return true;
  }

  return false;
}

/**
 * Get child nodes including shadow DOM and handling slots.
 *
 * This follows the Playwright approach:
 * 1. If element is a <slot>, use assigned nodes (the slotted content)
 * 2. Otherwise, use regular child nodes (but skip nodes that are slotted elsewhere)
 * 3. Also include shadow root children if present
 *
 * This ensures we traverse the "flattened tree" that users actually see,
 * not just the raw DOM tree.
 *
 * @param element - Parent element
 * @returns Array of child nodes to traverse
 */
function getChildren(element: Element): Node[] {
  const children: Node[] = [];

  // Handle <slot> elements: use assigned nodes (the slotted content)
  if (element.nodeName === "SLOT") {
    const slot = element as HTMLSlotElement;
    const assigned = slot.assignedNodes();
    if (assigned.length > 0) {
      children.push(...assigned);
      return children;
    }
  }

  // Regular children (but skip nodes that are assigned to slots)
  for (let child = element.firstChild; child; child = child.nextSibling) {
    // Skip nodes that are slotted elsewhere
    if (!(child as Element | Text).assignedSlot) {
      children.push(child);
    }
  }

  // Shadow DOM children
  if (element.shadowRoot) {
    for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling) {
      children.push(child);
    }
  }

  return children;
}
