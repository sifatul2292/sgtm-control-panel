# Set up server-side tracking with Tagioo, step by step

You’ll need your domain settings, Google Tag Manager and one event to test. This guide takes you from a new Tagioo account to a published setup you can check. Keep it open while you work through each step.

## Gather access before starting

Have access to your Tagioo account, Google Tag Manager, your domain's DNS settings and the destination you want to configure. For WooCommerce, you also need permission to install the Tagioo plugin. Keep credentials in the setup interface; do not include access tokens in screenshots, support messages or shared documents.

Choose one business action to test. An order with a known transaction reference is easier to trace than a random page view. For leads, decide what counts as a successfully accepted submission before building its trigger.

## Create the container and connect your domain

Create a Server container in Google Tag Manager and copy its container configuration. Use that configuration when creating the corresponding container in Tagioo. Keep a written record of which Web container, Server container and tracking domain belong together.

Use the DNS target shown in your container setup. Do not copy another customer's target or assume that a screenshot contains the current value. After updating DNS, allow time for the domain to resolve and HTTPS to become ready. Account creation can be quick; domain readiness is a separate step.

## Prepare the tracking configuration

Open Setup Assistant and select the destinations available for your implementation. Enter the required identifiers, then generate the Web and Server GTM import files. Review the import carefully so you do not overwrite unrelated existing tags.

Before publishing, list current plugins and tags that send the same conversion. A store may already have a platform integration, a browser pixel and an older server integration. Decide which remains responsible for each event. Adding another sender without that decision can turn a missing-event problem into a duplicate-event problem.

## Connect the event source

For the supported WooCommerce flow, install the Tagioo plugin and follow its configuration instructions. For a different website or a custom lead form, confirm that it provides the event data your selected tags expect. A generated template cannot infer that a form submission succeeded if the website never exposes that signal.

Use the [documentation](/docs) when a field or import option is unfamiliar. Make one change at a time and note what you changed, particularly when another person maintains the website.

## Preview, test and publish

Preview the relevant GTM containers. Perform your chosen test action and trace it through the Web container, incoming server request, resulting event and destination tag. Google's [server-container debugging guide](https://developers.google.com/tag-platform/tag-manager/server-side/debug) explains the preview workflow.

Check the event name, transaction or submission reference, amount where relevant and destination identifier. Then inspect the destination's test or diagnostic tools. Receipt by Tagioo alone is not confirmation that an advertising platform accepted the event.

Publish the verified configuration and repeat one controlled test against the published versions. Record the time, reference and expected result. Recheck after a plugin update, checkout change or form replacement.

## Know when setup is complete

You can explain where an event originates, identify it in your tracking workspace and confirm its destination behavior. If any link is missing, keep investigating before making performance claims. For a purchase-focused checklist, read [how to check WooCommerce purchase tracking](/blog/woocommerce-purchase-tracking-checklist).
