/**
 * SINIcare — tests/test-runner.js
 *
 * Lightweight, zero-dependency test framework.
 * Provides describe(), test(), expect() — runs in the browser.
 */

'use strict';

const results = [];
let currentSuite = '';

export function describe(name, fn) {
  currentSuite = name;
  fn();
}

export function test(name, fn) {
  const entry = { suite: currentSuite, name, passed: false, error: null };
  try {
    fn();
    entry.passed = true;
  } catch (err) {
    entry.error = err.message ?? String(err);
  }
  results.push(entry);
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toContain(item) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(`Expected array ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(item)) {
          throw new Error(`Expected "${actual}" to contain "${item}"`);
        }
      } else {
        throw new Error(`Expected string or array, got ${typeof actual}`);
      }
    },
    toBeGreaterThan(n) {
      if (actual <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThanOrEqual(n) {
      if (actual > n) throw new Error(`Expected ${actual} <= ${n}`);
    },
    toHaveLength(n) {
      if (!actual || actual.length !== n) throw new Error(`Expected length ${n}, got ${actual?.length}`);
    },
    not: {
      toBe(expected) {
        if (actual === expected) throw new Error(`Expected not ${JSON.stringify(expected)}`);
      },
      toContain(item) {
        if (Array.isArray(actual)) {
          if (actual.includes(item)) {
            throw new Error(`Expected array NOT to contain ${JSON.stringify(item)}`);
          }
        } else if (typeof actual === 'string') {
          if (actual.includes(item)) {
            throw new Error(`Expected "${actual}" NOT to contain "${item}"`);
          }
        }
      },
    },
  };
}

export function renderResults(containerId = 'test-results') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total  = results.length;

  const summaryEl = document.createElement('div');
  summaryEl.innerHTML = `
    <div style="
      padding: 16px 24px;
      border-radius: 12px;
      background: ${failed === 0 ? '#e6f5ec' : '#fde8e6'};
      border: 2px solid ${failed === 0 ? '#2d8a4e' : '#c0392b'};
      font-size: 18px;
      font-weight: 700;
      color: ${failed === 0 ? '#2d8a4e' : '#c0392b'};
      margin-bottom: 20px;
    ">
      ${failed === 0 ? '✅' : '❌'} ${passed} / ${total} tests passed
      ${failed > 0 ? `(${failed} failed)` : ''}
    </div>
  `;
  container.appendChild(summaryEl);

  // Group by suite
  const suites = {};
  results.forEach(r => {
    if (!suites[r.suite]) suites[r.suite] = [];
    suites[r.suite].push(r);
  });

  Object.entries(suites).forEach(([suite, tests]) => {
    const suiteEl = document.createElement('div');
    suiteEl.style.cssText = 'margin-bottom: 20px;';

    const suiteHeader = document.createElement('h3');
    suiteHeader.style.cssText = 'font-size: 16px; font-weight: 800; color: #1a1a2e; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #d6e8ef;';
    suiteHeader.textContent = suite;
    suiteEl.appendChild(suiteHeader);

    tests.forEach(t => {
      const testEl = document.createElement('div');
      testEl.style.cssText = `
        display: flex; align-items: flex-start; gap: 10px;
        padding: 8px 12px; border-radius: 8px; margin-bottom: 6px;
        background: ${t.passed ? '#f0faf4' : '#fff5f5'};
        border: 1px solid ${t.passed ? '#b7e4c7' : '#f5c6cb'};
      `;

      const icon = document.createElement('span');
      icon.style.cssText = 'font-size: 16px; flex-shrink: 0; margin-top: 1px;';
      icon.textContent = t.passed ? '✅' : '❌';

      const textEl = document.createElement('div');
      textEl.style.cssText = 'flex: 1;';

      const nameEl = document.createElement('div');
      nameEl.style.cssText = `font-size: 14px; font-weight: 600; color: ${t.passed ? '#2d8a4e' : '#c0392b'};`;
      nameEl.textContent = t.name;
      textEl.appendChild(nameEl);

      if (t.error) {
        const errEl = document.createElement('div');
        errEl.style.cssText = 'font-size: 13px; color: #c0392b; font-family: monospace; margin-top: 4px;';
        errEl.textContent = t.error;
        textEl.appendChild(errEl);
      }

      testEl.appendChild(icon);
      testEl.appendChild(textEl);
      suiteEl.appendChild(testEl);
    });

    container.appendChild(suiteEl);
  });
}
