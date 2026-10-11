# What is server-side tracking? Follow one sale from checkout to your ads

Your store says the order went through. Your ad report says nothing happened. Server-side tracking gives you another way to send that purchase—and a place to check where the signal went. Here’s what changes, what still depends on your website, and how to test it.

Server-side tracking adds a controlled processing step between an event source and its destinations. It can help you inspect and route information from your website or a supported backend integration. It does not create sales, replace a good event definition or make every report agree.

## Follow one event through the system

Imagine a customer places order DEMO-104. Your order system records it. A browser tag may also send a purchase event. With a server-side setup, eligible signals reach your tracking server before configured tags forward them to analytics or advertising tools.

The useful question is not simply whether the server received traffic. Check whether that traffic represents the right action, includes the expected order reference and value, and reaches the intended destination. In Tagioo, incoming event logs and purchase inspection give you a place to investigate the first part of that journey. Use the destination's own diagnostics for the final part.

## What changes for your team?

You gain a place to examine incoming activity without treating an advertising dashboard as your only source of evidence. You can keep tracking on a domain you control and manage destination configuration through Google Tag Manager. Managed hosting also removes the need to maintain the server infrastructure yourself.

Browser tracking still matters. It can capture actions and context that a backend order alone does not contain. A backend purchase signal can complement it when your supported integration supplies one. Decide what each source contributes before enabling overlapping implementations.

## Ecommerce and lead generation need different events

For a store, start with a completed purchase and work backwards through checkout, cart additions and product views. For a service business, start with a successfully accepted enquiry or booking. A click on a submit button is weaker evidence than the system confirming that the submission succeeded.

Write a small measurement plan: business action, event name, source, destination and success check. Include which data your implementation is allowed to send. Hosting is a technical capability; it does not automatically supply every website integration or consent decision.

## Is it time to add server-side tracking?

Consider it when you spend enough on advertising to investigate missing signals, need backend purchases alongside browser activity, or want a repeatable workflow across client sites. First fix obvious problems such as a missing tag or a purchase firing twice. A more elaborate architecture will not rescue an incorrect event.

For a first rollout, choose one conversion and one destination. Confirm a known action end to end, record the evidence and expand only after that path works. Keep an ordinary browser path available while you test an isolated setup.

## Start with a test you can explain

Create a Tagioo account, follow the [setup guide](/how-it-works) and inspect one known event. Compare [hosting plans](/pricing) using your expected traffic rather than choosing a plan from an assumed improvement in ROAS.

Read Google's [introduction to server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/intro) for the container model. Then continue with [Tagioo's setup checklist](/blog/tagioo-server-side-tracking-setup).
