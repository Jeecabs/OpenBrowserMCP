/**
 * Browser interaction implementations
 *
 * Provides functions for clicking, typing, hovering, selecting, and pressing keys
 * using different element selection strategies.
 */

import { ElementSelector, ErrorCode } from "./protocol";
import { findElementByRef } from "./aria-snapshot";

/**
 * Find an element using the provided selector
 */
export function findElement(selector: ElementSelector): Element {
  let elements: Element[] = [];

  if ("ref" in selector) {
    // Find by ARIA snapshot reference
    const element = findElementByRef(selector.ref);
    if (element) {
      elements = [element];
    }
  } else if ("css" in selector) {
    // Find by CSS selector
    elements = Array.from(document.querySelectorAll(selector.css));
  } else if ("role" in selector) {
    // Find by ARIA role and optional name
    elements = findByRole(selector.role, selector.name);
  }

  if (elements.length === 0) {
    throw new Error(JSON.stringify({
      code: ErrorCode.ELEMENT_NOT_FOUND,
      message: `No element found matching selector: ${JSON.stringify(selector)}`
    }));
  }

  if (elements.length > 1) {
    throw new Error(JSON.stringify({
      code: ErrorCode.ELEMENT_AMBIGUOUS,
      message: `Multiple elements (${elements.length}) found matching selector: ${JSON.stringify(selector)}`
    }));
  }

  return elements[0];
}

/**
 * Find elements by ARIA role and optional name
 */
function findByRole(role: string, name?: string): Element[] {
  const elements: Element[] = [];

  // Walk all elements in the document
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT
  );

  let node: Node | null = walker.currentNode;
  while (node) {
    const element = node as Element;
    const elementRole = getElementRole(element);

    if (elementRole === role) {
      // If name is specified, check accessible name
      if (name === undefined || getAccessibleName(element) === name) {
        elements.push(element);
      }
    }

    node = walker.nextNode();
  }

  return elements;
}

/**
 * Get the computed ARIA role for an element
 */
function getElementRole(element: Element): string | null {
  // Explicit role
  const explicitRole = element.getAttribute("role");
  if (explicitRole) {
    return explicitRole;
  }

  // Implicit role from tag name
  const tagName = element.tagName.toLowerCase();
  const implicitRoles: Record<string, string> = {
    "button": "button",
    "a": "link",
    "input": element instanceof HTMLInputElement ? getInputRole(element) : "textbox",
    "textarea": "textbox",
    "select": "combobox",
    "h1": "heading",
    "h2": "heading",
    "h3": "heading",
    "h4": "heading",
    "h5": "heading",
    "h6": "heading"
  };

  return implicitRoles[tagName] || null;
}

/**
 * Get role for input element based on type
 */
function getInputRole(input: HTMLInputElement): string {
  const type = input.type.toLowerCase();
  const typeRoles: Record<string, string> = {
    "button": "button",
    "checkbox": "checkbox",
    "radio": "radio",
    "search": "searchbox"
  };

  return typeRoles[type] || "textbox";
}

/**
 * Get accessible name for an element
 */
function getAccessibleName(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const labels = element.labels;
    if (labels && labels.length > 0) {
      return labels[0].textContent?.trim() || "";
    }

    const placeholder = element.getAttribute("placeholder");
    if (placeholder) {
      return placeholder.trim();
    }
  }

  return element.textContent?.trim() || "";
}

/**
 * Click on an element
 */
export async function click(selector: ElementSelector): Promise<void> {
  const element = findElement(selector);

  // Ensure element is visible
  ensureVisible(element);

  // Simulate click with mouse events
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  // For buttons and links, also trigger the default action
  if (element instanceof HTMLElement) {
    element.click();
  }

  // Wait a bit for any resulting navigation or state changes
  await waitForStability();
}

/**
 * Type text into an element
 */
export async function type(selector: ElementSelector, text: string): Promise<void> {
  const element = findElement(selector);

  // Ensure element is visible and focusable
  ensureVisible(element);

  // Focus the element
  if (element instanceof HTMLElement) {
    element.focus();
  }

  // For input elements, set the value
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = text;

    // Trigger input and change events
    element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  } else {
    // For content-editable, set text content
    if (element instanceof HTMLElement && element.isContentEditable) {
      element.textContent = text;
    }
  }

  await waitForStability();
}

/**
 * Hover over an element
 */
export async function hover(selector: ElementSelector): Promise<void> {
  const element = findElement(selector);

  ensureVisible(element);

  // Dispatch mouse events
  element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true }));

  await waitForStability();
}

/**
 * Select an option in a select element
 */
export async function select(selector: ElementSelector, value: string): Promise<void> {
  const element = findElement(selector);

  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(JSON.stringify({
      code: ErrorCode.INVALID_REQUEST,
      message: "Select action requires a <select> element"
    }));
  }

  ensureVisible(element);

  // Set the value
  element.value = value;

  // Trigger change event
  element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

  await waitForStability();
}

/**
 * Press a keyboard key
 */
export async function press(key: string): Promise<void> {
  // Focus the active element or body
  const target = document.activeElement || document.body;

  // Dispatch keyboard events
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true
  }));

  target.dispatchEvent(new KeyboardEvent("keypress", {
    key,
    bubbles: true,
    cancelable: true
  }));

  target.dispatchEvent(new KeyboardEvent("keyup", {
    key,
    bubbles: true,
    cancelable: true
  }));

  await waitForStability();
}

/**
 * Ensure an element is visible by scrolling it into view
 */
function ensureVisible(element: Element): void {
  if (element instanceof HTMLElement) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center"
    });
  }
}

/**
 * Wait for DOM stability after an interaction
 */
async function waitForStability(timeout: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}
