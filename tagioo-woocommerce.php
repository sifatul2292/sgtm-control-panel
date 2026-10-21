<?php
/**
 * Plugin Name: Tagioo for WooCommerce
 * Plugin URI:  https://tagioo.com
 * Description: All-in-one server-side tracking — replaces GTM4WP and WooCommerce webhooks. Injects GTM, pushes GA4 ecommerce dataLayer with full user_data, and fires a server-side purchase hit to sGTM for 10/10 Meta EMQ.
 * Version:     2.6.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Author:      Tagioo
 * License:     GPL-2.0+
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 */

defined('ABSPATH') || exit;

define('TAGIOO_VERSION', '2.6.0');
define('TAGIOO_OPTION',  'tagioo_settings');
define('TAGIOO_META_FBP',   '_tagioo_fbp');
define('TAGIOO_META_FBC',   '_tagioo_fbc');
define('TAGIOO_META_UA',    '_tagioo_ua');
define('TAGIOO_META_IP',    '_tagioo_ip');
define('TAGIOO_META_SS_FIRED', '_tagioo_ss_purchase_fired');
define('TAGIOO_META_CONSENT',     '_tagioo_consent');
define('TAGIOO_META_CONSENT_SRC', '_tagioo_consent_src');

// ---------------------------------------------------------------------------
// HPOS compatibility
// ---------------------------------------------------------------------------
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function tagioo_settings(): array {
    static $cache = null;
    if ($cache === null) {
        $cache = wp_parse_args((array) get_option(TAGIOO_OPTION, []), [
            'gtm_id'          => '',
            'inject_gtm'      => '1',
            'custom_loader'   => '0',
            'gtm_placement'   => 'code',
            'consent_mode'    => 'off',
            'consent_text'    => '',
            'sgtm_domain'     => '',
            'measurement_id'  => '',
            'api_secret'      => '',
            'track_view_item' => '1',
            'track_add_cart'  => '1',
            'track_checkout'  => '1',
            'track_purchase'  => '1',
            'track_view_cart'     => '1',
            'track_remove_cart'   => '1',
            'track_view_list'     => '1',
            'track_search'        => '1',
            'track_checkout_steps' => '1',
            'server_hit'      => '1',
        ]);
    }
    return $cache;
}

function tagioo_opt(string $key, string $default = ''): string {
    return (string) (tagioo_settings()[$key] ?? $default);
}

// Cookie consent. Off by default: the plugin behaves exactly like 2.5.x (GTM always
// loads, purchases go to every destination). 'banner' shows Tagioo's own consent banner
// wired to Google Consent Mode v2; 'external' reads an existing banner plugin.
function tagioo_consent_mode(): string {
    $mode = tagioo_opt('consent_mode', 'off');
    return in_array($mode, ['banner', 'external'], true) ? $mode : 'off';
}

function tagioo_consent_enabled(): bool {
    return tagioo_consent_mode() !== 'off';
}

function tagioo_wait_for_consent(): bool {
    return tagioo_consent_enabled() && tagioo_opt('gtm_placement') === 'consent';
}

// ---------------------------------------------------------------------------
// Admin menu
// ---------------------------------------------------------------------------
add_action('admin_menu', function () {
    add_submenu_page('woocommerce', 'Tagioo Settings', 'Tagioo', 'manage_options', 'tagioo-settings', 'tagioo_settings_page');
});

add_action('admin_init', function () {
    register_setting('tagioo_group', TAGIOO_OPTION, ['sanitize_callback' => 'tagioo_sanitize_settings']);
});

function tagioo_sanitize_settings(array $in): array {
    return [
        'gtm_id'          => sanitize_text_field($in['gtm_id'] ?? ''),
        'inject_gtm'      => isset($in['inject_gtm'])      ? '1' : '0',
        'custom_loader'   => isset($in['custom_loader'])   ? '1' : '0',
        'gtm_placement'   => ($in['gtm_placement'] ?? '') === 'consent' ? 'consent' : 'code',
        'consent_mode'    => in_array($in['consent_mode'] ?? '', ['banner', 'external'], true) ? $in['consent_mode'] : 'off',
        'consent_text'    => sanitize_textarea_field($in['consent_text'] ?? ''),
        'sgtm_domain'     => esc_url_raw(rtrim($in['sgtm_domain'] ?? '', '/')),
        'measurement_id'  => sanitize_text_field($in['measurement_id'] ?? ''),
        'api_secret'      => sanitize_text_field($in['api_secret'] ?? ''),
        'track_view_item' => isset($in['track_view_item']) ? '1' : '0',
        'track_add_cart'  => isset($in['track_add_cart'])  ? '1' : '0',
        'track_checkout'  => isset($in['track_checkout'])  ? '1' : '0',
        'track_purchase'  => isset($in['track_purchase'])  ? '1' : '0',
        'track_view_cart'      => isset($in['track_view_cart'])      ? '1' : '0',
        'track_remove_cart'    => isset($in['track_remove_cart'])    ? '1' : '0',
        'track_view_list'      => isset($in['track_view_list'])      ? '1' : '0',
        'track_search'         => isset($in['track_search'])         ? '1' : '0',
        'track_checkout_steps' => isset($in['track_checkout_steps']) ? '1' : '0',
        'server_hit'      => isset($in['server_hit'])      ? '1' : '0',
    ];
}

function tagioo_settings_page(): void {
    $s = tagioo_settings();
    $sgtm = tagioo_opt('sgtm_domain');
    $collect_url = $sgtm ? $sgtm . '/g/collect?measurement_id=' . urlencode(tagioo_opt('measurement_id')) : '(set sGTM domain + Measurement ID first)';
    ?>
    <div class="wrap">
        <h1>Tagioo — Server-Side Tracking</h1>
        <p style="max-width:700px;color:#555">Single plugin replaces <strong>GTM4WP</strong> and <strong>WooCommerce webhooks</strong>.
        Injects GTM, pushes GA4 ecommerce events with full <code>user_data</code>, and fires a server-side GA4 hit to sGTM on every payment — giving <strong>10/10 Meta EMQ</strong>.</p>

        <form method="post" action="options.php">
            <?php settings_fields('tagioo_group'); ?>
            <h2 class="title">GTM</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label for="t_gtm">GTM Container ID</label></th>
                    <td>
                        <input name="<?= TAGIOO_OPTION ?>[gtm_id]" id="t_gtm" type="text"
                               value="<?= esc_attr($s['gtm_id']) ?>" class="regular-text" placeholder="GTM-XXXXXXX" />
                    </td>
                </tr>
                <tr>
                    <th>Inject GTM snippet</th>
                    <td>
                        <label><input type="checkbox" name="<?= TAGIOO_OPTION ?>[inject_gtm]" value="1"
                               <?= checked('1', $s['inject_gtm'], false) ?> />
                        Add &lt;head&gt; + &lt;noscript&gt; tags automatically</label>
                        <p class="description">Disable only if you already inject GTM manually.</p>
                    </td>
                </tr>
                <tr>
                    <th>Custom Loader</th>
                    <td>
                        <label><input type="checkbox" name="<?= TAGIOO_OPTION ?>[custom_loader]" value="1"
                               <?= checked('1', $s['custom_loader'], false) ?> />
                        Load gtm.js first-party through the sGTM domain</label>
                        <p class="description">Serves gtm.js via <code>&lt;sGTM domain&gt;/tagioo-loader/gtm.js</code> instead of googletagmanager.com, to bypass domain-based blockers (Brave, uBlock). Requires the sGTM domain below and the Custom Loader power-up enabled on the server.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="t_consent">Cookie consent</label></th>
                    <td>
                        <select name="<?= TAGIOO_OPTION ?>[consent_mode]" id="t_consent">
                            <option value="off" <?= selected('off', $s['consent_mode'], false) ?>>Off — consent not required (default)</option>
                            <option value="banner" <?= selected('banner', $s['consent_mode'], false) ?>>Show Tagioo consent banner</option>
                            <option value="external" <?= selected('external', $s['consent_mode'], false) ?>>Use my own cookie banner plugin</option>
                        </select>
                        <p class="description"><strong>Off:</strong> no banner; tracking and server-side purchases work for every visitor.<br>
                        <strong>Tagioo banner:</strong> shoppers see Accept / Reject. Uses Google Consent Mode v2 (denied until accepted), sets Meta cookies only after Accept, and Meta/TikTok skip purchases from shoppers who rejected.<br>
                        <strong>Own banner plugin:</strong> reads CookieYes, Complianz, Cookiebot, OneTrust or the WP Consent API instead.<br>
                        Check with your privacy notice and legal advice which option your store needs.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="t_consent_text">Banner text</label></th>
                    <td>
                        <textarea name="<?= TAGIOO_OPTION ?>[consent_text]" id="t_consent_text" rows="2" class="large-text" placeholder="<?= esc_attr(tagioo_default_consent_text()) ?>"><?= esc_textarea($s['consent_text']) ?></textarea>
                        <p class="description">Optional. Used only with the Tagioo banner. Your privacy policy page (Settings → Privacy) is linked automatically. Shoppers can reopen the banner with a link to <code>#tagioo-cookie-settings</code> or the <code>[tagioo_cookie_settings]</code> shortcode.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="t_place">GTM loading</label></th>
                    <td>
                        <select name="<?= TAGIOO_OPTION ?>[gtm_placement]" id="t_place">
                            <option value="code" <?= selected('code', $s['gtm_placement'], false) ?>>Always load GTM (default)</option>
                            <option value="consent" <?= selected('consent', $s['gtm_placement'], false) ?>>Wait for consent (Google Consent Mode)</option>
                        </select>
                        <p class="description">Only applies when Cookie consent is on. “Wait for consent” keeps GTM paused until the banner grants <code>ad_storage</code> or <code>analytics_storage</code>. “Always” loads GTM straight away and lets Consent Mode control what Google tags send (recommended).</p>
                    </td>
                </tr>
            </table>

            <h2 class="title">Server-Side GTM (sGTM)</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label for="t_sgtm">sGTM Domain</label></th>
                    <td>
                        <input name="<?= TAGIOO_OPTION ?>[sgtm_domain]" id="t_sgtm" type="url"
                               value="<?= esc_attr($s['sgtm_domain']) ?>" class="regular-text"
                               placeholder="https://sgtm.yourdomain.com" />
                        <p class="description">Used for the server-side purchase hit and first-party data collection. Also the host for Custom Loader (gtm.js served via /tagioo-loader/).</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="t_mid">GA4 Measurement ID</label></th>
                    <td>
                        <input name="<?= TAGIOO_OPTION ?>[measurement_id]" id="t_mid" type="text"
                               value="<?= esc_attr($s['measurement_id']) ?>" class="regular-text" placeholder="G-XXXXXXXXXX" />
                        <p class="description">GA4 property ID (G-XXX). Required for server-side purchase hit.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="t_sec">GA4 API Secret</label></th>
                    <td>
                        <input name="<?= TAGIOO_OPTION ?>[api_secret]" id="t_sec" type="password"
                               value="<?= esc_attr($s['api_secret']) ?>" class="regular-text" />
                        <p class="description">GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets.</p>
                    </td>
                </tr>
                <tr>
                    <th>Server-side purchase hit</th>
                    <td>
                        <label><input type="checkbox" name="<?= TAGIOO_OPTION ?>[server_hit]" value="1"
                               <?= checked('1', $s['server_hit'], false) ?> />
                        POST to sGTM on payment complete (replaces WooCommerce webhook)</label>
                        <p class="description">Fires even if browser is closed / pixel blocked. Endpoint: <code><?= esc_html($collect_url) ?></code></p>
                        <p class="description">When Cookie consent is on, the shopper's choice at checkout is sent with the hit as <code>consent_marketing</code>. Tagioo's Meta and TikTok server tags skip purchases marked denied; GA4 still records the order. Developers can change or skip the hit with the <code>tagioo_server_purchase_params</code> filter.</p>
                    </td>
                </tr>
            </table>

            <h2 class="title">DataLayer Events</h2>
            <table class="form-table" role="presentation">
                <?php
                $events = [
                    'track_view_item' => ['view_item', 'Single product page'],
                    'track_add_cart'  => ['add_to_cart', 'Add to cart button'],
                    'track_view_list'      => ['view_item_list', 'Shop, category, tag and product search pages'],
                    'track_search'         => ['search', 'Product search results page'],
                    'track_view_cart'      => ['view_cart', 'Cart page load'],
                    'track_remove_cart'    => ['remove_from_cart', 'Item removed from the cart (cart page, mini cart, Cart Block)'],
                    'track_checkout'  => ['begin_checkout', 'Checkout page load'],
                    'track_checkout_steps' => ['add_shipping_info + add_payment_info', 'When the shopper clicks Place order (chosen shipping and payment method)'],
                    'track_purchase'  => ['purchase', 'Thank-you page — includes customer data for Meta matching'],
                ];
                foreach ($events as $key => [$event, $desc]) : ?>
                    <tr>
                        <th><?= esc_html($event) ?></th>
                        <td>
                            <label><input type="checkbox" name="<?= TAGIOO_OPTION ?>[<?= $key ?>]" value="1"
                                   <?= checked('1', $s[$key], false) ?> />
                            <?= esc_html($desc) ?></label>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </table>
            <?php submit_button('Save Settings'); ?>
        </form>
    </div>
    <?php
}

// ---------------------------------------------------------------------------
// GTM injection — replaces GTM4WP
// ---------------------------------------------------------------------------
add_action('wp_head', function () {
    $id = tagioo_opt('gtm_id');
    if (!$id || tagioo_opt('inject_gtm') !== '1') return;
    // Loader source. Default: Google. Custom Loader on (+ sGTM domain set): serve
    // gtm.js first-party via <sGTM>/tagioo-loader/gtm.js, which nginx proxies to
    // googletagmanager.com. First-party path dodges domain-based blockers (Brave,
    // uBlock) that block the googletagmanager.com host outright.
    $sgtm = tagioo_opt('sgtm_domain');
    if (tagioo_opt('custom_loader') === '1' && $sgtm) {
        $loader = rtrim($sgtm, '/') . '/tagioo-loader/gtm.js?id=' . esc_js($id);
    } else {
        $loader = 'https://www.googletagmanager.com/gtm.js?id=' . esc_js($id);
    }
    $id_e   = esc_js($id);
    if (tagioo_wait_for_consent()) {
        // Same idea as Stape's "Load GTM with consent": keep GTM paused until the
        // cookie banner reports Consent Mode ad_storage or analytics_storage
        // granted, checking pushes made before and after this script runs.
        $src = $loader;
        echo "\n<!-- Tagioo GTM (waits for consent) -->\n";
        echo "<script>(function(w,d,l,src){w[l]=w[l]||[];var done=false;function load(){if(done)return;done=true;w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName('script')[0],j=d.createElement('script');j.async=true;j.src=src;f.parentNode.insertBefore(j,f);}function ok(e){if(!e||e[0]!=='consent'||(e[1]!=='default'&&e[1]!=='update'))return false;var c=e[2]||{};return c.ad_storage==='granted'||c.analytics_storage==='granted';}var q=w[l];for(var i=0;i<q.length;i++){if(ok(q[i])){load();break;}}if(!done){var p=q.push;q.push=function(){var r=p.apply(q,arguments);for(var k=0;k<arguments.length;k++){if(ok(arguments[k]))load();}return r;};}})(window,document,'dataLayer','{$src}');</script>\n";
        echo "<!-- End Tagioo GTM -->\n";
        return;
    }
    echo "\n<!-- Tagioo GTM -->\n";
    echo "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='{$loader}'+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','{$id_e}');</script>\n";
    echo "<!-- End Tagioo GTM -->\n";
}, 1);

// Tagioo banner: Google Consent Mode v2 defaults must be set before GTM loads.
add_action('wp_head', function () {
    if (tagioo_consent_mode() !== 'banner' || is_admin()) return;
    echo "\n<!-- Tagioo consent defaults -->\n";
    echo "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}(function(){var all={ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'};gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});var m=document.cookie.match(/(?:^|; )tagioo_consent=([^;]*)/);if(m&&m[1]==='granted')gtag('consent','update',all);})();</script>\n";
}, 0);

function tagioo_default_consent_text(): string {
    return 'We use cookies to measure our ads and improve your shopping experience. You can accept or reject them.';
}

add_action('wp_footer', function () {
    if (tagioo_consent_mode() !== 'banner' || is_admin()) return;
    $text    = tagioo_opt('consent_text') ?: tagioo_default_consent_text();
    $privacy = function_exists('get_privacy_policy_url') ? get_privacy_policy_url() : '';
    $link    = $privacy ? ' <a href="' . esc_url($privacy) . '">Privacy policy</a>' : '';
    ?>
<div id="tagioo-consent" class="tagioo-consent" role="dialog" aria-live="polite" aria-label="Cookie consent" hidden>
  <div class="tagioo-consent-inner">
    <p><?= esc_html($text) ?><?= $link ?></p>
    <div class="tagioo-consent-actions">
      <button type="button" data-tagioo-consent="denied">Reject</button>
      <button type="button" data-tagioo-consent="granted">Accept</button>
    </div>
  </div>
</div>
<style>.tagioo-consent,.tagioo-consent *{box-sizing:border-box}.tagioo-consent{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:2147483647;margin:0;padding:16px 20px calc(16px + env(safe-area-inset-bottom));background:#fff;color:#1d2327;border-top:1px solid #dcdcde;box-shadow:0 -8px 30px rgba(0,0,0,.12);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;transform:none}.tagioo-consent[hidden]{display:none}.tagioo-consent-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:20px}.tagioo-consent p{margin:0;flex:1}.tagioo-consent a{color:inherit;text-decoration:underline}.tagioo-consent-actions{display:flex;gap:10px;flex:none}.tagioo-consent button{min-width:120px;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #1d2327;background:#fff;color:#1d2327;font-family:inherit;font-size:15px;font-weight:600;line-height:1;cursor:pointer}.tagioo-consent button[data-tagioo-consent=granted]{background:#1d2327;color:#fff}.tagioo-consent button:focus-visible{outline:3px solid #2271b1;outline-offset:2px}@media(max-width:640px){.tagioo-consent-inner{flex-direction:column;align-items:stretch;gap:12px}.tagioo-consent-actions button{flex:1;min-width:0}}</style>
<script>(function(){var box=document.getElementById('tagioo-consent');if(!box)return;if(box.parentNode!==document.body)document.body.appendChild(box);var all={ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'};var none={ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'};function saved(){var m=document.cookie.match(/(?:^|; )tagioo_consent=([^;]*)/);return m?m[1]:'';}function choose(v){document.cookie='tagioo_consent='+v+';path=/;max-age=15552000;SameSite=Lax'+(location.protocol==='https:'?';Secure':'');window.dataLayer=window.dataLayer||[];if(typeof gtag==='function')gtag('consent','update',v==='granted'?all:none);window.dataLayer.push({event:'tagioo_consent_update',tagioo_consent:v});box.hidden=true;}box.addEventListener('click',function(e){var b=e.target.closest('[data-tagioo-consent]');if(b)choose(b.getAttribute('data-tagioo-consent'));});document.addEventListener('click',function(e){var a=e.target.closest('a[href$="#tagioo-cookie-settings"]');if(a){e.preventDefault();box.hidden=false;}});if(!saved())box.hidden=false;})();</script>
    <?php
}, 100);

add_shortcode('tagioo_cookie_settings', function () {
    return tagioo_consent_mode() === 'banner' ? '<a href="#tagioo-cookie-settings">Cookie settings</a>' : '';
});

add_action('wp_body_open', function () {
    $id = tagioo_opt('gtm_id');
    if (!$id || tagioo_opt('inject_gtm') !== '1') return;
    if (tagioo_wait_for_consent()) return;   // no JS means no consent signal
    $id_e = esc_attr($id);
    $sgtm = tagioo_opt('sgtm_domain');
    $ns   = (tagioo_opt('custom_loader') === '1' && $sgtm)
        ? rtrim($sgtm, '/') . '/tagioo-loader/ns.html?id=' . $id_e
        : 'https://www.googletagmanager.com/ns.html?id=' . $id_e;
    echo "\n<!-- Tagioo GTM noscript -->\n";
    echo "<noscript><iframe src=\"{$ns}\" height=\"0\" width=\"0\" style=\"display:none;visibility:hidden\"></iframe></noscript>\n";
    echo "<!-- End Tagioo GTM noscript -->\n";
}, 1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function tagioo_currency(): string {
    return function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'BDT';
}

function tagioo_price(string $price): float {
    return round((float) $price, 2);
}

function tagioo_item_from_product(\WC_Product $product, int $qty = 1): array {
    $cats = get_the_terms($product->get_id(), 'product_cat');
    $cat  = (!empty($cats) && !is_wp_error($cats)) ? reset($cats)->name : '';
    return array_filter([
        'item_id'       => (string) ($product->get_sku() ?: $product->get_id()),
        'item_name'     => $product->get_name(),
        'item_category' => $cat,
        'price'         => tagioo_price($product->get_price()),
        'currency'      => tagioo_currency(),
        'quantity'      => $qty,
    ]);
}

function tagioo_items_from_order(\WC_Order $order): array {
    $items = [];
    foreach ($order->get_items() as $item) {
        /** @var \WC_Order_Item_Product $item */
        $product = $item->get_product();
        if (!$product) continue;
        $cats    = get_the_terms($product->get_id(), 'product_cat');
        $cat     = (!empty($cats) && !is_wp_error($cats)) ? reset($cats)->name : '';
        $items[] = array_filter([
            'item_id'       => (string) ($product->get_sku() ?: $product->get_id()),
            'item_name'     => $item->get_name(),
            'item_category' => $cat,
            'price'         => tagioo_price((string) $order->get_item_subtotal($item, false)),
            'currency'      => $order->get_currency(),
            'quantity'      => $item->get_quantity(),
        ]);
    }
    return $items;
}

// E.164 dial code per country, used to normalize phone numbers for Meta hashing.
// Unknown country falls back to the store's Bangladesh default (+88).
function tagioo_dial_code(string $cc): string {
    $map = [
        'BD'=>'88','US'=>'1','CA'=>'1','GB'=>'44','IN'=>'91','PK'=>'92','AU'=>'61',
        'AE'=>'971','SA'=>'966','MY'=>'60','SG'=>'65','DE'=>'49','FR'=>'33','IT'=>'39',
        'ES'=>'34','NL'=>'31','SE'=>'46','NO'=>'47','DK'=>'45','BR'=>'55','MX'=>'52',
        'ID'=>'62','PH'=>'63','TH'=>'66','VN'=>'84','JP'=>'81','CN'=>'86','KR'=>'82',
        'TR'=>'90','EG'=>'20','ZA'=>'27','NG'=>'234','KE'=>'254','NP'=>'977','LK'=>'94',
    ];
    return $map[strtoupper($cc)] ?? '88';
}

// Normalize a raw phone to E.164 (+<cc><number>) so the Meta hash matches.
// Honors an already-international number (+ or 00 prefix); else prepends the
// dial code for the order's billing country.
function tagioo_normalize_phone(string $raw, string $country = ''): string {
    $phone = preg_replace('/[^0-9+]/', '', $raw);
    if (!$phone) return '';
    if (str_starts_with($phone, '+'))  return $phone;
    if (str_starts_with($phone, '00')) return '+' . substr($phone, 2);
    return '+' . tagioo_dial_code($country) . ltrim($phone, '0');
}

/**
 * Build user_data using exact field names the Tagioo sGTM CAPI template reads.
 * Passes plain text — sGTM hashes server-side (SHA-256).
 */
function tagioo_user_data_from_order(\WC_Order $order): array {
    $phone = tagioo_normalize_phone($order->get_billing_phone(), $order->get_billing_country());

    $external_id = '';
    if ($order->get_customer_id()) {
        $external_id = (string) $order->get_customer_id();
    } elseif ($order->get_billing_email()) {
        // Guest: use hashed email as stable external_id
        $external_id = hash('sha256', strtolower(trim($order->get_billing_email())));
    }

    return array_filter([
        'email_address' => strtolower(trim($order->get_billing_email())),
        'phone_number'  => $phone,
        'first_name'    => strtolower(trim($order->get_billing_first_name())),
        'last_name'     => strtolower(trim($order->get_billing_last_name())),
        'city'          => strtolower(trim($order->get_billing_city())),
        'region'        => strtolower(trim($order->get_billing_state())),
        'postal_code'   => trim($order->get_billing_postcode()),
        'country'       => strtolower(trim($order->get_billing_country())),
        'external_id'   => $external_id,
    ]);
}

// Unique event_id for a dataLayer push. The browser Meta/TikTok pixel and the
// server-side CAPI (via the GA4 event_id param) both read this same value, so
// the two hits for one action deduplicate instead of double-counting.
function tagioo_event_id(string $prefix): string {
    return 'tagioo-' . $prefix . '-' . str_replace('.', '', uniqid('', true));
}

// Purchase dedup key. Deliberately the RAW WooCommerce order ID (not the
// customer-facing order number, which sequential-order-number plugins change,
// and no "tagioo-purchase-" prefix): the Tagioo panel's order-webhook purchase
// recovery sends event_id = the Woo webhook's `id` field. Any other format makes
// Meta treat the recovery hit as a separate Purchase → double counting.
function tagioo_purchase_event_id(\WC_Order $order): string {
    return (string) $order->get_id();
}

function tagioo_push_script(array $data, bool $echo = true): string {
    $out = '';
    // GTM v2 merges nested objects — always clear stale ecommerce before each event.
    if (isset($data['ecommerce'])) {
        $out .= "\n<script>window.dataLayer=window.dataLayer||[];dataLayer.push({ecommerce:null});</script>\n";
    }
    $json = wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $out .= "\n<script>window.dataLayer=window.dataLayer||[];dataLayer.push({$json});</script>\n";
    if ($echo) echo $out;
    return $out;
}

/**
 * Returns user_data for the currently logged-in user.
 * Reads WooCommerce billing meta so field names match what the order provides.
 * Used to enrich non-purchase events for better Meta audience + attribution.
 */
function tagioo_current_user_data(): array {
    $user_id = get_current_user_id();
    if (!$user_id) return [];
    $user    = get_userdata($user_id);
    $country = (string) get_user_meta($user_id, 'billing_country', true);
    $phone   = tagioo_normalize_phone((string) get_user_meta($user_id, 'billing_phone', true), $country);
    return array_filter([
        'email_address' => strtolower(trim($user->user_email ?? '')),
        'phone_number'  => $phone,
        'first_name'    => strtolower(trim((string) (get_user_meta($user_id, 'billing_first_name', true) ?: $user->first_name))),
        'last_name'     => strtolower(trim((string) (get_user_meta($user_id, 'billing_last_name',  true) ?: $user->last_name))),
        'city'          => strtolower(trim((string) get_user_meta($user_id, 'billing_city',     true))),
        'region'        => strtolower(trim((string) get_user_meta($user_id, 'billing_state',    true))),
        'postal_code'   => trim((string) get_user_meta($user_id, 'billing_postcode', true)),
        'country'       => strtolower(trim((string) get_user_meta($user_id, 'billing_country',  true))),
        'external_id'   => (string) $user_id,
    ]);
}

// ---------------------------------------------------------------------------
// Real client IP, preferring IPv6.
// Meta sees the user's IPv6 via the browser pixel; WooCommerce's
// get_customer_ip_address() often returns the proxy/edge IPv4 (REMOTE_ADDR),
// which mismatches and lowers match quality. Read the true-client headers and
// pick an IPv6 address when one is present.
// ---------------------------------------------------------------------------
function tagioo_client_ip(): string {
    // Header priority: Cloudflare / CDN true-client headers first, then proxy
    // chain, then the raw connection. X-Forwarded-For may be a comma list with
    // the client first.
    $candidates = [];
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_TRUE_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $h) {
        if (empty($_SERVER[$h])) continue;
        foreach (explode(',', (string) wp_unslash($_SERVER[$h])) as $part) {
            $ip = trim($part);
            if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) $candidates[] = $ip;
        }
    }
    // Prefer the first valid IPv6, else first valid IP.
    foreach ($candidates as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) return $ip;
    }
    return $candidates[0] ?? '';
}

// ---------------------------------------------------------------------------
// Meta identifier persistence (_fbp / _fbc) — beat Safari ITP + capture fbclid
// on the LANDING hit (not at checkout, where the param is long gone), so the
// server-side purchase hit always has them for 10/10 EMQ.
// ---------------------------------------------------------------------------

// Meta-format _fbp value, generated when the Pixel hasn't set one yet.
function tagioo_new_fbp(): string {
    return 'fb.1.' . (string) round(microtime(true) * 1000) . '.' . (string) wp_rand(1000000000, 9999999999);
}

// On every front-end request: capture fbclid → _fbc, ensure _fbp exists, then
// re-emit both as first-party cookies with a 90-day expiry. Server-set
// Set-Cookie headers survive Safari ITP's 7-day cap on JS-set cookies, so
// returning visitors keep a stable match. Same value re-emitted each request →
// never clobbers the value the Pixel itself wrote.
add_action('init', function () {
    if (is_admin()) return;
    if (defined('DOING_CRON') && DOING_CRON) return;
    if (defined('REST_REQUEST') && REST_REQUEST) return;
    if (defined('DOING_AJAX') && DOING_AJAX) return;
    if (headers_sent()) return;
    if (tagioo_consent_enabled()) {
        [$consent] = tagioo_marketing_consent();
        if (tagioo_consent_mode() === 'banner' ? $consent !== 'granted' : $consent === 'denied') return;
    }

    $fbp = isset($_COOKIE['_fbp']) ? sanitize_text_field(wp_unslash($_COOKIE['_fbp'])) : '';
    $fbc = isset($_COOKIE['_fbc']) ? sanitize_text_field(wp_unslash($_COOKIE['_fbc'])) : '';

    // fbclid in the landing URL → build _fbc now. Only when no _fbc cookie set.
    if (!$fbc && !empty($_GET['fbclid'])) {
        $fbclid = sanitize_text_field(wp_unslash($_GET['fbclid']));
        $fbc = 'fb.1.' . (string) round(microtime(true) * 1000) . '.' . $fbclid;
    }

    // No _fbp yet (first hit, before the Pixel runs) → generate a stable one.
    if (!$fbp) $fbp = tagioo_new_fbp();

    $opts = [
        'expires'  => time() + 90 * DAY_IN_SECONDS,
        'path'     => (defined('COOKIEPATH') && COOKIEPATH) ? COOKIEPATH : '/',
        'domain'   => defined('COOKIE_DOMAIN') ? COOKIE_DOMAIN : '',
        'secure'   => is_ssl(),
        'httponly' => false,            // Meta Pixel reads these via document.cookie
        'samesite' => 'Lax',
    ];
    setcookie('_fbp', $fbp, $opts);
    $_COOKIE['_fbp'] = $fbp;           // visible to the same request
    if ($fbc) {
        setcookie('_fbc', $fbc, $opts);
        $_COOKIE['_fbc'] = $fbc;
    }
}, 1);

// Attach Meta identifiers + real client IP/UA to the order. Reads cookies and
// server vars directly → works on BOTH classic and block (Store API) checkout,
// with no hidden form fields to depend on.
function tagioo_attach_meta_identifiers(\WC_Order $order): void {
    $fbp = isset($_COOKIE['_fbp']) ? sanitize_text_field(wp_unslash($_COOKIE['_fbp'])) : '';
    $fbc = isset($_COOKIE['_fbc']) ? sanitize_text_field(wp_unslash($_COOKIE['_fbc'])) : '';
    $ua  = isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '';
    if ($fbp && !$order->get_meta(TAGIOO_META_FBP)) $order->update_meta_data(TAGIOO_META_FBP, $fbp);
    if ($fbc && !$order->get_meta(TAGIOO_META_FBC)) $order->update_meta_data(TAGIOO_META_FBC, $fbc);
    if ($ua  && !$order->get_meta(TAGIOO_META_UA))  $order->update_meta_data(TAGIOO_META_UA,  $ua);
    // Real client IP (prefer IPv6) so the server-side hit forwards the same IP
    // family Meta saw via the pixel — even when payment_complete later fires
    // from a server context (COD, webhook).
    $ip = tagioo_client_ip();
    if ($ip && !$order->get_meta(TAGIOO_META_IP)) $order->update_meta_data(TAGIOO_META_IP, $ip);
    // Consent at the moment of purchase; the backend hit runs later from cron,
    // where the shopper's cookies are no longer available.
    if (tagioo_consent_enabled() && !$order->get_meta(TAGIOO_META_CONSENT)) {
        [$consent, $source] = tagioo_marketing_consent();
        $order->update_meta_data(TAGIOO_META_CONSENT, $consent);
        $order->update_meta_data(TAGIOO_META_CONSENT_SRC, $source);
    }
}

// Shopper's marketing consent for the current request: 'granted', 'denied' or
// 'unknown', plus where it came from. Like Stape, the plugin never blocks on it;
// it is passed to Server GTM, which decides per tag. Prefers the WP Consent API
// (Complianz, CookieYes, Cookiebot and others implement it), then common banner cookies.
function tagioo_marketing_consent(): array {
    if (tagioo_consent_mode() === 'banner') {
        $v = isset($_COOKIE['tagioo_consent']) ? sanitize_text_field(wp_unslash($_COOKIE['tagioo_consent'])) : '';
        return [$v === 'granted' ? 'granted' : 'denied', 'tagioo_banner'];
    }
    if (function_exists('wp_has_consent') && function_exists('wp_get_consent_type') && wp_get_consent_type()) {
        return [wp_has_consent('marketing') ? 'granted' : 'denied', 'wp_consent_api'];
    }
    $c = static fn(string $name): string => isset($_COOKIE[$name]) ? strtolower(rawurldecode(wp_unslash((string) $_COOKIE[$name]))) : '';
    if (($v = $c('cookieyes-consent')) !== '') {
        if (strpos($v, 'advertisement:yes') !== false) return ['granted', 'cookieyes'];
        if (strpos($v, 'advertisement:no') !== false) return ['denied', 'cookieyes'];
    }
    if (($v = $c('cmplz_marketing')) !== '') return [$v === 'allow' ? 'granted' : 'denied', 'complianz'];
    if (($v = $c('CookieConsent')) !== '') {
        if (strpos($v, 'marketing:true') !== false) return ['granted', 'cookiebot'];
        if (strpos($v, 'marketing:false') !== false) return ['denied', 'cookiebot'];
    }
    if (($v = $c('OptanonConsent')) !== '' && preg_match('/groups=([^&]*)/', $v, $m)) {
        if (strpos($m[1], 'c0004:1') !== false) return ['granted', 'onetrust'];
        if (strpos($m[1], 'c0004:0') !== false) return ['denied', 'onetrust'];
    }
    // IAB US Privacy string, e.g. "1YYN": third character Y = opted out of sale/sharing.
    if (($v = $c('usprivacy')) !== '' && strlen($v) === 4 && $v[2] === 'y') return ['denied', 'usprivacy'];
    return ['unknown', ''];
}

// Classic (shortcode) checkout.
add_action('woocommerce_checkout_create_order', function (\WC_Order $order, array $data) {
    tagioo_attach_meta_identifiers($order);
}, 10, 2);

// Block (Store API) checkout — fires while the browser request cookies are live.
add_action('woocommerce_store_api_checkout_update_order_from_request', function (\WC_Order $order) {
    tagioo_attach_meta_identifiers($order);
}, 10, 1);

// ---------------------------------------------------------------------------
// view_item
// ---------------------------------------------------------------------------
add_action('wp_footer', function () {
    if (tagioo_opt('track_view_item') !== '1' || !is_product()) return;
    $product = wc_get_product(get_the_ID());
    if (!$product) return;
    $item = tagioo_item_from_product($product);
    $push = ['event' => 'view_item', 'event_id' => tagioo_event_id('vi'), 'ecommerce' => [
        'currency' => tagioo_currency(),
        'value'    => $item['price'],
        'items'    => [$item],
    ]];
    $ud = tagioo_current_user_data();
    if ($ud) $push['user_data'] = $ud;
    tagioo_push_script($push);
}, 20);

// ---------------------------------------------------------------------------
// add_to_cart
//
// The Woo hook runs inside both normal page requests and wc-ajax requests. A
// wc-ajax response has no wp_footer, so merely storing the push in the session
// delays it until the shopper loads another page. The browser bridge below
// drains that same queued push immediately after Woo reports AJAX success.
// Normal form/redirect carts keep the wp_footer fallback.
// ---------------------------------------------------------------------------
add_action('woocommerce_add_to_cart', function (string $key, int $product_id, int $qty, int $variation_id) {
    if (tagioo_opt('track_add_cart') !== '1') return;
    $product = wc_get_product($variation_id ?: $product_id);
    if (!$product) return;
    $item = tagioo_item_from_product($product, $qty);
    $push = ['event' => 'add_to_cart', 'event_id' => tagioo_event_id('atc'), 'ecommerce' => [
        'currency' => tagioo_currency(),
        'value'    => tagioo_price((string) ($product->get_price() * $qty)),
        'items'    => [$item],
    ]];
    $ud = tagioo_current_user_data();
    if ($ud) $push['user_data'] = $ud;
    tagioo_queue_event('tagioo_atc', $push);
}, 10, 4);

// Return and atomically clear only the current shopper's queued cart event.
// A nonce prevents another site from draining the session with a forged POST.
function tagioo_ajax_take_add_to_cart(): void {
    check_ajax_referer('tagioo_take_add_to_cart', 'nonce');
    $session = WC()->session ?? null;
    $events  = [];
    foreach (['tagioo_atc' => 'track_add_cart', 'tagioo_rfc' => 'track_remove_cart'] as $slot => $option) {
        $pending = $session?->get($slot);
        if (!$pending) continue;
        $session->set($slot, null);
        if (tagioo_opt($option) === '1') $events[] = $pending;
    }
    tagioo_clear_queue_flag();
    // `event` kept for pages still running the 2.4 bridge script from cache.
    wp_send_json_success(['event' => $events[0] ?? null, 'events' => $events]);
}
add_action('wp_ajax_tagioo_take_add_to_cart', 'tagioo_ajax_take_add_to_cart');
add_action('wp_ajax_nopriv_tagioo_take_add_to_cart', 'tagioo_ajax_take_add_to_cart');

// Classic WooCommerce dispatches the jQuery `added_to_cart` event; Cart and
// Checkout Blocks dispatch the native `wc-blocks_added_to_cart` event. Listen
// for both, fetch the server-built ecommerce payload, and push it immediately.
add_action('wp_footer', function () {
    if (tagioo_opt('track_add_cart') !== '1' && tagioo_opt('track_remove_cart') !== '1') return;
    $endpoint = esc_url(admin_url('admin-ajax.php'));
    $nonce    = esc_js(wp_create_nonce('tagioo_take_add_to_cart'));
    ?>
    <script>
    (function () {
        if (window.__tagiooAtcBridge) return;
        window.__tagiooAtcBridge = true;
        var endpoint = <?= wp_json_encode($endpoint) ?>;
        var nonce = <?= wp_json_encode($nonce) ?>;
        var busy = false;

        function pushEvent(payload) {
            if (!payload || (payload.event !== 'add_to_cart' && payload.event !== 'remove_from_cart')) return;
            var id = String(payload.event_id || '');
            var sent = window.__tagiooDataLayerSent = window.__tagiooDataLayerSent || {};
            var key = payload.event + '|' + id;
            if (id && sent[key]) return;
            if (id) sent[key] = true;
            var layer = window.dataLayer = window.dataLayer || [];
            layer.push({ecommerce: null});
            layer.push(payload);
        }

        function takeQueuedEvent(e) {
            var passive = e && /^(wc_fragments_refreshed|updated_checkout|updated_wc_div|updated_cart_totals)$/.test(e.type);
            if (passive && document.cookie.indexOf('tagioo_q=1') === -1) return;
            if (busy) return;
            busy = true;
            fetch(endpoint, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
                body: 'action=tagioo_take_add_to_cart&nonce=' + encodeURIComponent(nonce)
            })
                .then(function (response) { return response.ok ? response.json() : null; })
                .then(function (result) {
                    if (!result || !result.success || !result.data) return;
                    var list = result.data.events || (result.data.event ? [result.data.event] : []);
                    list.forEach(pushEvent);
                })
                .catch(function () {})
                .then(function () { busy = false; });
        }

        function bind() {
            if (window.jQuery) {
                // added/removed_from_cart: mini cart; updated_wc_div / updated_cart_totals: cart
                // page; wc_fragments_refreshed / updated_checkout: side carts and checkout
                // quantity controls (e.g. FunnelKit) that refresh cart fragments.
                window.jQuery(document.body).on('added_to_cart.tagioo removed_from_cart.tagioo updated_wc_div.tagioo updated_cart_totals.tagioo wc_fragments_refreshed.tagioo updated_checkout.tagioo', takeQueuedEvent);
            }
            document.body.addEventListener('wc-blocks_added_to_cart', takeQueuedEvent);
            document.body.addEventListener('wc-blocks_removed_from_cart', takeQueuedEvent);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bind, {once: true});
        } else {
            bind();
        }
    })();
    </script>
    <?php
}, 5);

add_action('wp_footer', function () {
    if (tagioo_opt('track_add_cart') !== '1') return;
    $pending = WC()->session?->get('tagioo_atc');
    if (!$pending) return;
    WC()->session->set('tagioo_atc', null);
    tagioo_push_script($pending);
}, 25);

// Queue a cart event for the browser. The tagioo_q cookie tells the bridge
// script there is something to collect, so passive cart refreshes don't cost an
// admin-ajax request on every page load.
function tagioo_queue_event(string $slot, array $push): void {
    WC()->session?->set($slot, $push);
    if (!headers_sent()) setcookie('tagioo_q', '1', ['expires' => time() + 600, 'path' => COOKIEPATH ?: '/', 'domain' => COOKIE_DOMAIN, 'samesite' => 'Lax', 'secure' => is_ssl()]);
}
function tagioo_clear_queue_flag(): void {
    if (!empty($_COOKIE['tagioo_q']) && !headers_sent()) setcookie('tagioo_q', '', ['expires' => time() - 3600, 'path' => COOKIEPATH ?: '/', 'domain' => COOKIE_DOMAIN, 'samesite' => 'Lax', 'secure' => is_ssl()]);
}

// Current cart as GA4 ecommerce {currency, value, items}; null when empty.
function tagioo_cart_ecommerce(): ?array {
    $cart = function_exists('WC') ? WC()->cart : null;
    if (!$cart || $cart->is_empty()) return null;
    $items = [];
    $value = 0.0;
    foreach ($cart->get_cart() as $ci) {
        $product = $ci['data'] ?? null;
        if (!$product instanceof \WC_Product) continue;
        $qty     = (int) $ci['quantity'];
        $items[] = tagioo_item_from_product($product, $qty);
        $value  += ((float) $product->get_price() * $qty);
    }
    if (!$items) return null;
    return ['currency' => tagioo_currency(), 'value' => round($value, 2), 'items' => $items];
}

// ---------------------------------------------------------------------------
// begin_checkout
// Classic checkout fires woocommerce_before_checkout_form; the Checkout Block
// and some page builders never do, so wp_footer is the fallback. A static flag
// keeps it to one push per page.
// ---------------------------------------------------------------------------
function tagioo_emit_begin_checkout(): void {
    static $done = false;
    if ($done || tagioo_opt('track_checkout') !== '1') return;
    if (!function_exists('is_checkout') || !is_checkout() || (function_exists('is_order_received_page') && is_order_received_page())) return;
    $ecommerce = tagioo_cart_ecommerce();
    if (!$ecommerce) return;
    $done = true;
    $push = ['event' => 'begin_checkout', 'event_id' => tagioo_event_id('bc'), 'ecommerce' => $ecommerce];
    // Logged-in: billing address known already → include for Meta audience matching.
    $ud = tagioo_current_user_data();
    if ($ud) $push['user_data'] = $ud;
    tagioo_push_script($push);
}
add_action('woocommerce_before_checkout_form', 'tagioo_emit_begin_checkout', 5);
add_action('wp_footer', 'tagioo_emit_begin_checkout', 22);

// ---------------------------------------------------------------------------
// view_cart — cart page (classic shortcode and Cart Block)
// ---------------------------------------------------------------------------
add_action('wp_footer', function () {
    if (tagioo_opt('track_view_cart') !== '1' || !function_exists('is_cart') || !is_cart()) return;
    $ecommerce = tagioo_cart_ecommerce();
    if (!$ecommerce) return;
    $push = ['event' => 'view_cart', 'event_id' => tagioo_event_id('vc'), 'ecommerce' => $ecommerce];
    $ud = tagioo_current_user_data();
    if ($ud) $push['user_data'] = $ud;
    tagioo_push_script($push);
}, 21);

// ---------------------------------------------------------------------------
// view_item_list + search — shop, category, tag and product search pages
// ---------------------------------------------------------------------------
add_action('wp_footer', function () {
    if (!function_exists('is_shop')) return;
    $is_search = is_search() && (get_query_var('post_type') === 'product' || (function_exists('is_product_taxonomy') && is_product_taxonomy()) || is_post_type_archive('product'));
    $is_list   = is_shop() || is_product_category() || is_product_tag() || $is_search;
    if (!$is_list) return;

    if ($is_search && tagioo_opt('track_search') === '1') {
        $term = trim((string) get_search_query());
        if ($term !== '') tagioo_push_script(['event' => 'search', 'event_id' => tagioo_event_id('se'), 'search_term' => $term]);
    }
    if (tagioo_opt('track_view_list') !== '1') return;

    global $wp_query;
    $list_name = $is_search ? 'Search results' : (is_shop() ? 'Shop' : single_term_title('', false));
    $items = [];
    foreach (array_slice((array) ($wp_query->posts ?? []), 0, 30) as $index => $post) {
        $product = wc_get_product($post);
        if (!$product) continue;
        $item = tagioo_item_from_product($product);
        $item['index'] = $index;
        $item['item_list_name'] = (string) $list_name;
        unset($item['quantity']);
        $items[] = $item;
    }
    if (!$items) return;
    tagioo_push_script(['event' => 'view_item_list', 'event_id' => tagioo_event_id('vil'), 'ecommerce' => [
        'currency'       => tagioo_currency(),
        'item_list_name' => (string) $list_name,
        'items'          => $items,
    ]]);
}, 21);

// ---------------------------------------------------------------------------
// remove_from_cart — queued like add_to_cart and drained by the same bridge
// ---------------------------------------------------------------------------
add_action('woocommerce_remove_cart_item', function (string $key, $cart) {
    if (tagioo_opt('track_remove_cart') !== '1' || !$cart) return;
    $ci = $cart->get_cart_item($key);
    $product = $ci['data'] ?? null;
    if (!$product instanceof \WC_Product) return;
    $qty  = max(1, (int) ($ci['quantity'] ?? 1));
    $push = ['event' => 'remove_from_cart', 'event_id' => tagioo_event_id('rfc'), 'ecommerce' => [
        'currency' => tagioo_currency(),
        'value'    => tagioo_price((string) ((float) $product->get_price() * $qty)),
        'items'    => [tagioo_item_from_product($product, $qty)],
    ]];
    tagioo_queue_event('tagioo_rfc', $push);
}, 10, 2);

// Quantity changes (cart page, mini/side carts, FunnelKit checkout −/+ buttons)
// never call woocommerce_remove_cart_item unless the quantity reaches zero.
// GA4 treats a lower quantity as remove_from_cart and a higher one as
// add_to_cart for the difference. Woo's own add_to_cart() also calls
// set_quantity() for an item already in the cart; its woocommerce_add_to_cart
// hook runs afterwards and overwrites this slot, so that path isn't doubled.
add_action('woocommerce_after_cart_item_quantity_update', function (string $key, $quantity, $old_quantity, $cart) {
    $quantity = (int) $quantity;
    $old_quantity = (int) $old_quantity;
    if ($quantity <= 0 || $quantity === $old_quantity || !$cart) return;
    $increase = $quantity > $old_quantity;
    if (tagioo_opt($increase ? 'track_add_cart' : 'track_remove_cart') !== '1') return;
    $ci = $cart->get_cart_item($key);
    $product = $ci['data'] ?? null;
    if (!$product instanceof \WC_Product) return;
    $diff = abs($quantity - $old_quantity);
    $name = $increase ? 'add_to_cart' : 'remove_from_cart';
    $push = ['event' => $name, 'event_id' => tagioo_event_id($increase ? 'atc' : 'rfc'), 'ecommerce' => [
        'currency' => tagioo_currency(),
        'value'    => tagioo_price((string) ((float) $product->get_price() * $diff)),
        'items'    => [tagioo_item_from_product($product, $diff)],
    ]];
    if ($increase) {
        $ud = tagioo_current_user_data();
        if ($ud) $push['user_data'] = $ud;
    }
    tagioo_queue_event($increase ? 'tagioo_atc' : 'tagioo_rfc', $push);
}, 10, 4);

add_action('wp_footer', function () {
    if (tagioo_opt('track_remove_cart') !== '1') return;
    $pending = WC()->session?->get('tagioo_rfc');
    if (!$pending) return;
    WC()->session->set('tagioo_rfc', null);
    tagioo_push_script($pending);
}, 25);

// ---------------------------------------------------------------------------
// add_shipping_info + add_payment_info — when the shopper clicks Place order.
// The cart snapshot is rendered with the page; the chosen shipping and payment
// method are read from the form at click time (classic checkout and Block).
// ---------------------------------------------------------------------------
add_action('wp_footer', function () {
    if (tagioo_opt('track_checkout_steps') !== '1' || !function_exists('is_checkout') || !is_checkout()) return;
    if (function_exists('is_order_received_page') && is_order_received_page()) return;
    $ecommerce = tagioo_cart_ecommerce();
    if (!$ecommerce) return;
    $needs_shipping = WC()->cart && WC()->cart->needs_shipping();
    ?>
    <script>
    (function () {
        if (window.__tagiooCheckoutSteps) return;
        window.__tagiooCheckoutSteps = true;
        var base = <?= wp_json_encode($ecommerce, JSON_UNESCAPED_UNICODE) ?>;
        var needsShipping = <?= $needs_shipping ? 'true' : 'false' ?>;
        var sent = {};
        function id(prefix) { return 'tagioo-' + prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
        function checked(selector) {
            var el = document.querySelector(selector);
            if (!el) return '';
            var label = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
            return String((label && label.textContent) || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        }
        function push(name, extra) {
            if (sent[name]) return;
            sent[name] = true;
            var ecommerce = {currency: base.currency, value: base.value, items: base.items};
            for (var k in extra) if (extra[k]) ecommerce[k] = extra[k];
            var layer = window.dataLayer = window.dataLayer || [];
            layer.push({ecommerce: null});
            layer.push({event: name, event_id: id(name === 'add_payment_info' ? 'api' : 'asi'), ecommerce: ecommerce});
        }
        function onPlaceOrder() {
            if (needsShipping) push('add_shipping_info', {shipping_tier: checked('input[name^="shipping_method"]:checked, .wc-block-components-shipping-rates-control input:checked')});
            push('add_payment_info', {payment_type: checked('input[name="payment_method"]:checked, input[name="radio-control-wc-payment-method-options"]:checked')});
        }
        function bind() {
            if (window.jQuery) window.jQuery('form.checkout').on('checkout_place_order.tagioo', function () { onPlaceOrder(); return true; });
            document.addEventListener('click', function (e) {
                var t = e.target && e.target.closest && e.target.closest('#place_order, .wc-block-components-checkout-place-order-button');
                if (t) onPlaceOrder();
            }, true);
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once: true}); else bind();
    })();
    </script>
    <?php
}, 23);

// ---------------------------------------------------------------------------
// purchase — thank-you / order-received page (browser hit)
// event_id = raw WooCommerce order ID → matches the plugin's own server hit AND
// the panel's order-webhook purchase recovery (which keys on the Woo order id),
// so Meta deduplicates all of them to a single Purchase.
// ---------------------------------------------------------------------------
function tagioo_emit_browser_purchase(int $order_id): void {
    static $rendered = [];
    if (tagioo_opt('track_purchase') !== '1' || !$order_id) return;
    if (isset($rendered[$order_id])) return;
    $order = wc_get_order($order_id);
    if (!$order) return;
    $rendered[$order_id] = true;
    $event_id = tagioo_purchase_event_id($order);
    $payload = [
        'event'    => 'purchase',
        'event_id' => $event_id,    // used by GTM browser pixel for dedup eventID
        'user_data' => tagioo_user_data_from_order($order),
        'ecommerce' => [
            'transaction_id' => (string) $order->get_order_number(),
            'value'          => tagioo_price((string) $order->get_total()),
            'tax'            => tagioo_price((string) $order->get_total_tax()),
            'shipping'       => tagioo_price((string) $order->get_shipping_total()),
            'currency'       => $order->get_currency(),
            'coupon'         => implode(',', $order->get_coupon_codes()),
            'items'          => tagioo_items_from_order($order),
        ],
    ];

    // PHP cannot know whether the browser actually executed its response. An
    // order-meta "sent" flag written before JavaScript runs permanently lost
    // Purchase when the first response was interrupted or GTM loaded late.
    // Dedup inside the current browser session only after dataLayer accepts the
    // event; the raw order ID still deduplicates browser/server hits at Meta.
    $json = wp_json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    echo "\n<script>(function(){var p={$json},k='tagioo_purchase_'+String(p.event_id||''),s=window.__tagiooDataLayerSent=window.__tagiooDataLayerSent||{};if(s[k])return;try{if(window.sessionStorage&&sessionStorage.getItem(k))return;}catch(e){}var d=window.dataLayer=window.dataLayer||[];d.push({ecommerce:null});d.push(p);s[k]=1;try{if(window.sessionStorage)sessionStorage.setItem(k,'1');}catch(e){}})();</script>\n";
}
add_action('woocommerce_thankyou', 'tagioo_emit_browser_purchase', 10, 1);

// Custom themes and some block-based confirmation pages omit the classic
// woocommerce_thankyou action. Recover the same event from the authenticated
// order-received URL without exposing an order selected by ID alone.
add_action('wp_footer', function () {
    if (tagioo_opt('track_purchase') !== '1' || !function_exists('is_order_received_page') || !is_order_received_page()) return;
    $order_key = isset($_GET['key']) ? sanitize_text_field(wp_unslash($_GET['key'])) : '';
    if ($order_key === '') return;

    $order_id = absint(get_query_var('order-received'));
    if (!$order_id && function_exists('wc_get_order_id_by_order_key')) {
        $order_id = absint(wc_get_order_id_by_order_key($order_key));
    }
    if (!$order_id) return;

    $order = wc_get_order($order_id);
    if (!$order || !hash_equals((string) $order->get_order_key(), $order_key)) return;
    tagioo_emit_browser_purchase($order_id);
}, 30);

// ---------------------------------------------------------------------------
// Server-side purchase hit → sGTM /g/collect  (replaces WooCommerce webhook)
// Runs on a scheduled job, NOT inline: a slow/down sGTM never blocks checkout,
// and a transient sGTM outage (container restart) is retried with backoff
// instead of silently dropping the conversion. event_id matches browser hit →
// Meta deduplicates both to 1; GA4 dedups by transaction_id.
// ---------------------------------------------------------------------------
define('TAGIOO_SS_MAX_RETRY', 5);
define('TAGIOO_SS_LOCK_TTL', 300);

// WP-Cron may start two workers when payment_complete and the processing status
// transition happen in overlapping requests. add_option() is an atomic insert,
// so this lock prevents both workers from transmitting the same server Purchase.
// A stale lock expires to preserve recovery after a PHP crash.
function tagioo_server_purchase_lock(int $order_id): string {
    return 'tagioo_ss_purchase_lock_' . $order_id;
}

function tagioo_claim_server_purchase(int $order_id): bool {
    $key = tagioo_server_purchase_lock($order_id);
    if (add_option($key, (string) time(), '', false)) return true;
    $claimed_at = (int) get_option($key, 0);
    if ($claimed_at > 0 && $claimed_at >= time() - TAGIOO_SS_LOCK_TTL) return false;
    delete_option($key);
    return add_option($key, (string) time(), '', false);
}

function tagioo_release_server_purchase(int $order_id): void {
    delete_option(tagioo_server_purchase_lock($order_id));
}

// Meta rejects server events whose event_time is more than 7 days old. Keep the
// order-placed time while it is recent enough (best attribution). For orders paid
// later — bank transfer or on-hold orders confirmed after a week — use the moment
// payment was confirmed, which is when the sale actually completed; otherwise now.
// One hour of margin covers the retry backoff.
function tagioo_purchase_event_time(\WC_Order $order, ?int $now = null): int {
    $now   = $now ?? time();
    $limit = $now - (7 * DAY_IN_SECONDS - HOUR_IN_SECONDS);
    $created    = $order->get_date_created();
    $created_ts = $created ? $created->getTimestamp() : 0;
    if ($created_ts >= $limit && $created_ts <= $now) return $created_ts;
    $paid    = $order->get_date_paid();
    $paid_ts = $paid ? $paid->getTimestamp() : 0;
    if ($paid_ts >= $limit && $paid_ts <= $now) return $paid_ts;
    return $now;
}

// Enqueue the send out-of-band. Idempotent: skips if already sent or queued.
function tagioo_enqueue_server_purchase(int $order_id): void {
    if (tagioo_opt('server_hit') !== '1') return;
    $order = wc_get_order($order_id);
    if (!$order) return;
    if ($order->get_meta(TAGIOO_META_SS_FIRED)) return;
    if (wp_next_scheduled('tagioo_server_purchase', [$order_id, 1])) return;
    wp_schedule_single_event(time(), 'tagioo_server_purchase', [$order_id, 1]);
}
add_action('woocommerce_payment_complete', 'tagioo_enqueue_server_purchase', 10);
// COD / BACS reach "processing" without payment_complete.
add_action('woocommerce_order_status_processing', 'tagioo_enqueue_server_purchase', 10);

// Worker: build + send the gtag hit, blocking so the HTTP status is readable;
// mark SS_FIRED only on 2xx; retry with linear backoff up to the cap; log fails.
add_action('tagioo_server_purchase', function (int $order_id, int $attempt = 1) {
    if (tagioo_opt('server_hit') !== '1') return;

    if (!tagioo_claim_server_purchase($order_id)) {
        // Another cron worker owns this order. Recheck later so a PHP crash
        // cannot strand the Purchase behind the stale lock.
        if (!wp_next_scheduled('tagioo_server_purchase', [$order_id, $attempt])) {
            wp_schedule_single_event(time() + 60, 'tagioo_server_purchase', [$order_id, $attempt]);
        }
        return;
    }

    $sgtm   = tagioo_opt('sgtm_domain');
    $mid    = tagioo_opt('measurement_id');
    $secret = tagioo_opt('api_secret');
    if (!$sgtm || !$mid || !$secret) {
        tagioo_release_server_purchase($order_id);
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order) {
        tagioo_release_server_purchase($order_id);
        return;
    }
    if ($order->get_meta(TAGIOO_META_SS_FIRED)) {
        tagioo_release_server_purchase($order_id);
        return;   // already sent
    }

    $order_num = (string) $order->get_order_number();
    $event_id  = tagioo_purchase_event_id($order);         // same as browser hit
    $user_data = tagioo_user_data_from_order($order);

    // fbp/fbc/UA captured from the browser at checkout; IP prefers the IPv6 the
    // browser sent (falls back to whatever WooCommerce stored).
    $fbp = $order->get_meta(TAGIOO_META_FBP);
    $fbc = $order->get_meta(TAGIOO_META_FBC);
    $ua  = $order->get_meta(TAGIOO_META_UA);
    $ip  = $order->get_meta(TAGIOO_META_IP) ?: $order->get_customer_ip_address();

    // event_time = order placed time (not send time) so COD orders sent days
    // later still attribute to the real conversion moment — unless that is
    // older than Meta's 7-day limit (see tagioo_purchase_event_time()).
    $ts = tagioo_purchase_event_time($order);

    // sGTM's GA4 client only claims the gtag wire format on /g/collect — an MP
    // JSON body returns HTTP 400. Build a gtag query string so the GA4 client
    // claims it, forwards to GA4, and fires Meta CAPI.
    $params = [
        'v'                => '2',
        'tid'              => $mid,
        'cid'              => 'tagioo_server.' . $order_num,
        'en'               => 'purchase',
        '_et'              => '100',                 // engagement, so GA4 records it
        'sid'              => (string) $ts,
        '_p'               => (string) wp_rand(1, 2147483647),
        'cu'               => $order->get_currency(),
        'epn.value'        => tagioo_price((string) $order->get_total()),
        'epn.tax'          => tagioo_price((string) $order->get_total_tax()),
        'epn.shipping'     => tagioo_price((string) $order->get_shipping_total()),
        'ep.transaction_id'=> $order_num,
        'ep.coupon'        => implode(',', $order->get_coupon_codes()),
        'ep.event_id'      => $event_id,
        'ep.event_time'    => (string) $ts,         // Meta CAPI event_time
        // page_location → Meta event_source_url + GA4 page path (not the homepage).
        'dl'               => $order->get_checkout_order_received_url(),
        // Tagioo CAPI template reads eventData.fbp / eventData.fbc.
        'ep.fbp'           => $fbp ?: '',
        'ep.fbc'           => $fbc ?: '',
    ];
    // Explicit ip_override so the Tagioo CAPI template uses this exact IP (prefer
    // IPv6) for client_ip_address — avoids depending on nginx's X-Forwarded-For
    // chain (which appends the WP server IP).
    if ($ip) $params['ep.ip_override'] = $ip;
    // Flat user_data params — the Tagioo CAPI template reads these off eventData
    // when no nested user_data object is present (server recovery path).
    foreach ($user_data as $k => $v) {
        if ($v !== '' && $v !== null) $params['ep.' . $k] = $v;
    }
    // Items as gtag product params: prN=id..~nm..~pr..~qt..~ca.. (~ is the delimiter).
    $i = 1;
    foreach (tagioo_items_from_order($order) as $it) {
        $pr  = 'id' . str_replace('~', '-', (string) ($it['item_id'] ?? ''));
        $pr .= '~nm' . str_replace('~', '-', (string) ($it['item_name'] ?? ''));
        $pr .= '~pr' . (string) ($it['price'] ?? 0);
        $pr .= '~qt' . (string) ($it['quantity'] ?? 1);
        if (!empty($it['item_category'])) $pr .= '~ca' . str_replace('~', '-', (string) $it['item_category']);
        $params['pr' . $i] = $pr;
        $i++;
    }

    // Consent captured at checkout travels with the hit and Server GTM decides
    // per tag (Tagioo's Meta/TikTok tags skip 'denied'). No Consent Mode gcs:
    // "marketing denied" says nothing about analytics, and this server-to-server
    // hit sets no cookies and carries no ad click ID.
    if (tagioo_consent_enabled()) {
        $params['ep.consent_marketing'] = (string) ($order->get_meta(TAGIOO_META_CONSENT) ?: 'unknown');
        if ($src = (string) $order->get_meta(TAGIOO_META_CONSENT_SRC)) $params['ep.consent_source'] = $src;
    }

    // Developers can adjust the hit, or return false to skip it (e.g. stricter consent rules).
    $params = apply_filters('tagioo_server_purchase_params', $params, $order);
    if ($params === false) {
        error_log("[tagioo] server purchase #{$order_num} skipped by tagioo_server_purchase_params filter");
        tagioo_release_server_purchase($order_id);
        return;
    }

    $url = $sgtm . '/g/collect?' . http_build_query($params);

    // Forward customer IP and UA so sGTM CAPI has them for EMQ.
    $headers = [];
    if ($ip) $headers['X-Forwarded-For'] = $ip;
    if ($ua) $headers['User-Agent']      = $ua;

    // Blocking: we're in a scheduled job, not the checkout request, so we can
    // wait for the status and decide whether to retry.
    $res  = wp_remote_post($url, ['headers' => $headers, 'timeout' => 15, 'blocking' => true]);
    $code = is_wp_error($res) ? 0 : (int) wp_remote_retrieve_response_code($res);

    if ($code >= 200 && $code < 300) {
        $order->update_meta_data(TAGIOO_META_SS_FIRED, '1');
        $order->save();
        tagioo_release_server_purchase($order_id);
        return;
    }

    // Failure → log + retry with linear backoff (60s, 120s, ...), capped.
    $err = is_wp_error($res) ? $res->get_error_message() : ('HTTP ' . $code);
    error_log("[tagioo] server purchase #{$order_num} attempt {$attempt} failed: {$err}");
    if ($attempt < TAGIOO_SS_MAX_RETRY) {
        wp_schedule_single_event(time() + 60 * $attempt, 'tagioo_server_purchase', [$order_id, $attempt + 1]);
    } else {
        error_log("[tagioo] server purchase #{$order_num} gave up after {$attempt} attempts");
    }
    tagioo_release_server_purchase($order_id);
}, 10, 2);
