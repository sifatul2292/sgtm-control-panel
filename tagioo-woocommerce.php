<?php
/**
 * Plugin Name: Tagioo for WooCommerce
 * Plugin URI:  https://tagioo.com
 * Description: All-in-one server-side tracking — replaces GTM4WP and WooCommerce webhooks. Injects GTM, pushes GA4 ecommerce dataLayer with full user_data, and fires a server-side purchase hit to sGTM for 10/10 Meta EMQ.
 * Version:     2.4.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Author:      Tagioo
 * License:     GPL-2.0+
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 */

defined('ABSPATH') || exit;

define('TAGIOO_VERSION', '2.4.0');
define('TAGIOO_OPTION',  'tagioo_settings');
define('TAGIOO_META_FBP',   '_tagioo_fbp');
define('TAGIOO_META_FBC',   '_tagioo_fbc');
define('TAGIOO_META_UA',    '_tagioo_ua');
define('TAGIOO_META_IP',    '_tagioo_ip');
define('TAGIOO_META_FIRED', '_tagioo_purchase_fired');
define('TAGIOO_META_SS_FIRED', '_tagioo_ss_purchase_fired');

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
            'sgtm_domain'     => '',
            'measurement_id'  => '',
            'api_secret'      => '',
            'track_view_item' => '1',
            'track_add_cart'  => '1',
            'track_checkout'  => '1',
            'track_purchase'  => '1',
            'server_hit'      => '1',
        ]);
    }
    return $cache;
}

function tagioo_opt(string $key, string $default = ''): string {
    return (string) (tagioo_settings()[$key] ?? $default);
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
        'sgtm_domain'     => esc_url_raw(rtrim($in['sgtm_domain'] ?? '', '/')),
        'measurement_id'  => sanitize_text_field($in['measurement_id'] ?? ''),
        'api_secret'      => sanitize_text_field($in['api_secret'] ?? ''),
        'track_view_item' => isset($in['track_view_item']) ? '1' : '0',
        'track_add_cart'  => isset($in['track_add_cart'])  ? '1' : '0',
        'track_checkout'  => isset($in['track_checkout'])  ? '1' : '0',
        'track_purchase'  => isset($in['track_purchase'])  ? '1' : '0',
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
                    </td>
                </tr>
            </table>

            <h2 class="title">DataLayer Events</h2>
            <table class="form-table" role="presentation">
                <?php
                $events = [
                    'track_view_item' => ['view_item', 'Single product page'],
                    'track_add_cart'  => ['add_to_cart', 'Add to cart button'],
                    'track_checkout'  => ['begin_checkout', 'Checkout page load'],
                    'track_purchase'  => ['purchase', 'Thank-you page — includes full user_data for 10/10 Meta EMQ'],
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
    echo "\n<!-- Tagioo GTM -->\n";
    echo "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='{$loader}'+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','{$id_e}');</script>\n";
    echo "<!-- End Tagioo GTM -->\n";
}, 1);

add_action('wp_body_open', function () {
    $id = tagioo_opt('gtm_id');
    if (!$id || tagioo_opt('inject_gtm') !== '1') return;
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
            'currency'      => tagioo_currency(),
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
// add_to_cart (session-queued, survives AJAX redirect)
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
    WC()->session?->set('tagioo_atc', $push);
}, 10, 4);

add_action('wp_footer', function () {
    if (tagioo_opt('track_add_cart') !== '1') return;
    $pending = WC()->session?->get('tagioo_atc');
    if (!$pending) return;
    WC()->session->set('tagioo_atc', null);
    tagioo_push_script($pending);
}, 25);

// ---------------------------------------------------------------------------
// begin_checkout
// ---------------------------------------------------------------------------
add_action('woocommerce_before_checkout_form', function () {
    if (tagioo_opt('track_checkout') !== '1') return;
    $cart = WC()->cart;
    if (!$cart || $cart->is_empty()) return;
    $items = [];
    $value = 0.0;
    foreach ($cart->get_cart() as $ci) {
        $product = $ci['data'];
        if (!$product instanceof \WC_Product) continue;
        $qty     = (int) $ci['quantity'];
        $item    = tagioo_item_from_product($product, $qty);
        $items[] = $item;
        $value  += ($product->get_price() * $qty);
    }
    $push = ['event' => 'begin_checkout', 'event_id' => tagioo_event_id('bc'), 'ecommerce' => [
        'currency' => tagioo_currency(),
        'value'    => round($value, 2),
        'items'    => $items,
    ]];
    // Logged-in: billing address known already → include for Meta audience matching.
    $ud = tagioo_current_user_data();
    if ($ud) $push['user_data'] = $ud;
    tagioo_push_script($push);
}, 5);

// ---------------------------------------------------------------------------
// purchase — thank-you page (browser hit)
// event_id = order number → matches server-side hit so Meta deduplicates to 1
// ---------------------------------------------------------------------------
add_action('woocommerce_thankyou', function (int $order_id) {
    if (tagioo_opt('track_purchase') !== '1' || !$order_id) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    // Dedup: fire browser hit once per order.
    if ($order->get_meta(TAGIOO_META_FIRED)) return;
    $order->update_meta_data(TAGIOO_META_FIRED, '1');
    $order->save();

    $event_id = 'tagioo-purchase-' . $order->get_order_number();

    tagioo_push_script([
        'event'    => 'purchase',
        'event_id' => $event_id,    // used by GTM browser pixel for dedup eventID
        'user_data' => tagioo_user_data_from_order($order),
        'ecommerce' => [
            'transaction_id' => (string) $order->get_order_number(),
            'value'          => tagioo_price((string) $order->get_total()),
            'tax'            => tagioo_price((string) $order->get_total_tax()),
            'shipping'       => tagioo_price((string) $order->get_shipping_total()),
            'currency'       => tagioo_currency(),
            'coupon'         => implode(',', $order->get_coupon_codes()),
            'items'          => tagioo_items_from_order($order),
        ],
    ]);
}, 10);

// ---------------------------------------------------------------------------
// Server-side purchase hit → sGTM /g/collect  (replaces WooCommerce webhook)
// Runs on a scheduled job, NOT inline: a slow/down sGTM never blocks checkout,
// and a transient sGTM outage (container restart) is retried with backoff
// instead of silently dropping the conversion. event_id matches browser hit →
// Meta deduplicates both to 1; GA4 dedups by transaction_id.
// ---------------------------------------------------------------------------
define('TAGIOO_SS_MAX_RETRY', 5);

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

    $sgtm   = tagioo_opt('sgtm_domain');
    $mid    = tagioo_opt('measurement_id');
    $secret = tagioo_opt('api_secret');
    if (!$sgtm || !$mid || !$secret) return;

    $order = wc_get_order($order_id);
    if (!$order) return;
    if ($order->get_meta(TAGIOO_META_SS_FIRED)) return;   // already sent

    $order_num = (string) $order->get_order_number();
    $event_id  = 'tagioo-purchase-' . $order_num;          // same as browser hit
    $user_data = tagioo_user_data_from_order($order);

    // fbp/fbc/UA captured from the browser at checkout; IP prefers the IPv6 the
    // browser sent (falls back to whatever WooCommerce stored).
    $fbp = $order->get_meta(TAGIOO_META_FBP);
    $fbc = $order->get_meta(TAGIOO_META_FBC);
    $ua  = $order->get_meta(TAGIOO_META_UA);
    $ip  = $order->get_meta(TAGIOO_META_IP) ?: $order->get_customer_ip_address();

    // event_time = order placed time (not send time) so COD orders sent days
    // later still attribute to the real conversion moment.
    $created = $order->get_date_created();
    $ts      = $created ? $created->getTimestamp() : time();

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
        'cu'               => tagioo_currency(),
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
}, 10, 2);
