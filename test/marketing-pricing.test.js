import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const page of ['landing', 'pricing']) {
  const html = readFileSync(new URL(`../public/${page}.html`, import.meta.url), 'utf8');
  const start = html.indexOf('      const cycleMeta =');
  const script = html.slice(start, html.indexOf('</script>', start));
  async function render(currency, fail = false) {
    const values = [0, 30, 50, 100].map((usd) => ({ textContent: `$${usd}` }));
    const cards = [1200, 2900, 5900].map((monthly, i) => {
      const nodes = { '[data-price-display]': values[i + 1], '[data-price-unit]': {}, '[data-cycle-note]': {} };
      return { dataset: { monthly }, querySelector: (selector) => nodes[selector], nodes };
    });
    const links = ['Starter', 'Pro', 'Enterprise'].map((plan) => ({
      href: `/signup?plan=${plan}&cycle=monthly`,
      getAttribute() { return this.href; },
      setAttribute(_, value) { this.href = value; }
    }));
    const tabs = [1, 3, 6, 12].map((cycle) => ({
      dataset: { cycle }, classList: { toggle() {} }, setAttribute() {},
      addEventListener(_, callback) { this.click = callback; }
    }));
    const elements = {
      billingToggle: { style: { display: 'none' } }, pricingCurrencySwitch: {},
      pricingCycleNote: { hidden: true }, pricingFooterNote: {}
    };
    vm.runInNewContext(script, {
      URL, window: { location: { origin: 'https://tagioo.example' } },
      fetch: () => fail ? Promise.reject(new Error('offline')) : Promise.resolve({ json: () => Promise.resolve({ currency }) }),
      document: {
        getElementById: (id) => elements[id],
        querySelector: () => values[0],
        querySelectorAll: (selector) => ({ '.billing-tab': tabs, '[data-plan-cta]': links, '.pricing-card[data-monthly]': cards })[selector] || []
      }
    });
    await new Promise((resolve) => setImmediate(resolve));
    return { values, cards, tabs, links, elements };
  }
  test(`${page}: USD and geo failure retain monthly card prices`, async () => {
    for (const fail of [false, true]) {
      const { values, links, elements } = await render('USD', fail);
      assert.deepEqual(values.map((v) => v.textContent), ['$0', '$30', '$50', '$100']);
      assert.equal(elements.billingToggle.style.display, 'none');
      assert.ok(links.every((link) => link.href.endsWith('cycle=monthly')));
    }
  });
  test(`${page}: BDT enables discounted cycles and preserves selected plans`, async () => {
    const { values, tabs, links, cards, elements } = await render('BDT');
    assert.deepEqual(values.map((v) => v.textContent), ['৳0', '৳1,200', '৳2,900', '৳5,900']);
    assert.equal(elements.billingToggle.style.display, '');
    tabs[1].click();
    assert.equal(values[1].textContent, '৳1,080');
    assert.match(cards[0].nodes['[data-cycle-note]'].textContent, /3,240/);
    assert.equal(links[1].href, '/signup?plan=Pro&cycle=quarterly');
    tabs[0].click();
    assert.equal(values[1].textContent, '৳1,200');
    assert.equal(links[1].href, '/signup?plan=Pro&cycle=monthly');
  });
}
