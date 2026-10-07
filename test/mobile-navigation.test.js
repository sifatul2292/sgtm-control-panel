import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function closeMobileMenu()");
const end = source.indexOf("\nels.navItems.forEach", start);
const menuSource = source.slice(start, end);

function fixture(focusInside = false) {
  let open = false, expanded = "false", focused = false;
  const callbacks = {};
  const toggle = {
    focus: () => { focused = true; },
    setAttribute: (_, value) => { expanded = value; },
    addEventListener: (event, callback) => { callbacks[event] = callback; }
  };
  const sidebar = {
    contains: () => focusInside,
    classList: {
      contains: () => open,
      remove: () => { open = false; },
      toggle: () => { open = !open; return open; }
    }
  };
  const context = {
    mobileMenuToggle: toggle, mobileSidebar: sidebar,
    mobileLayout: { addEventListener: (_, callback) => { callbacks.resize = callback; } },
    document: {
      activeElement: {},
      querySelector: (selector) => selector === ".sidebar" ? sidebar : toggle,
      addEventListener: (_, callback) => { callbacks.keydown = callback; }
    }
  };
  runInNewContext(menuSource, context);
  return { callbacks, state: () => ({ open, expanded, focused }) };
}

test("mobile menu exposes its open state and closes on repeated tap", () => {
  const f = fixture();
  f.callbacks.click();
  assert.deepEqual(f.state(), { open: true, expanded: "true", focused: false });
  f.callbacks.click();
  assert.equal(f.state().expanded, "false");
});

test("Escape closes navigation and returns focus from a hidden navigation item", () => {
  const f = fixture(true);
  f.callbacks.click();
  f.callbacks.keydown({ key: "Escape" });
  assert.deepEqual(f.state(), { open: false, expanded: "false", focused: true });
});

test("breakpoint changes clear open navigation state", () => {
  const f = fixture();
  f.callbacks.click();
  f.callbacks.resize();
  assert.equal(f.state().open, false);
  assert.equal(f.state().expanded, "false");
});

test("view changes close the menu without changing routing or container submission", () => {
  assert.match(source, /function setView\(name, options = \{\}\) \{\s+closeMobileMenu\(\);/);
  assert.match(source, /item\.addEventListener\("click", \(\) => setView\(item\.dataset\.viewTarget\)\)/);
});
