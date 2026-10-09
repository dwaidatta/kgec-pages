// Minimal browser-global stubs so page/lib modules can be imported under plain Node.
// Real DOM rendering isn't exercised here — only the pure logic functions are under test,
// and each module's "if (document.getElementById(...)) init()" guards need `document` to exist.

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

if (!globalThis.localStorage) {
  globalThis.localStorage = new MemoryStorage();
}

// Just enough element surface for the ui.js toasts. Shown toasts are recorded in
// globalThis.__toasts (their class names) so tests can assert a warning appeared.
class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.className = "";
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  addEventListener() {}
  querySelector() {
    return new FakeElement("div");
  }
  remove() {}
}

if (!globalThis.document) {
  globalThis.document = {
    body: new FakeElement("body"),
    getElementById: () => null,
    createElement: (tag) => new FakeElement(tag),
  };
}

globalThis.__toasts = [];
if (!globalThis.bootstrap) {
  globalThis.bootstrap = {
    Toast: class {
      constructor(el) {
        this.el = el;
      }
      show() {
        globalThis.__toasts.push(this.el.className);
      }
      hide() {}
    },
  };
}
