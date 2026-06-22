<?php
/**
 * Plugin Name: Tagioo for WooCommerce
 * Plugin URI:  https://tagioo.com
 * Description: All-in-one server-side tracking — replaces GTM4WP and WooCommerce webhooks. Injects GTM, pushes GA4 ecommerce dataLayer with full user_data, and fires a server-side purchase hit to sGTM for 10/10 Meta EMQ.
 * Version:     2.1.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Author:      Tagioo
 * License:     GPL-2.0+
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 */

defined('ABSPATH') || exit;

define('TAGIOO_VERSION', '2.1.0');
define('TAGIOO_OPTION',  'tagioo_settings');
define('TAGIOO_META_FBP',   '_tagioo_fbp');
define('TAGIOO_META_FBC',   '_tagioo_fbc');
define('TAGIOO_META_UA',    '_tagioo_ua');
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
            </table>

            <h2 class="title">Server-Side GTM (sGTM)</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th><label for="t_sgtm">sGTM Domain</label></th>
                    <td>
                        <input name="<?= TAGIOO_OPTION ?>[sgtm_domain]" id="t_sgtm" type="url"
                               value="<?= esc_attr($s['sgtm_domain']) ?>" class="regular-text"
                               placeholder="https://sgtm.yourdomain.com" />
                        <p class="description">Used for the server-side purchase hit and first-party data collection. gtm.js always loads from google.com.</p>
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
    // Always load gtm.js from Google. First-party data collection is handled by the
    // web container's GA4 config (server_container_url → sGTM), not the loader script.
    // Serving gtm.js first-party would require a Web Container client in the server
    // container, which Google does not expose for JSON import.
    $loader = 'https://www.googletagmanager.com/gtm.js?id=' . esc_js($id);
    $id_e   = esc_js($id);
    echo "\n<!-- Tagioo GTM -->\n";
    echo "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='{$loader}'+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','{$id_e}');</script>\n";
    echo "<!-- End Tagioo GTM -->\n";
}, 1);

add_action('wp_body_open', function () {
    $id = tagioo_opt('gtm_id');
    if (!$id || tagioo_opt('inject_gtm') !== '1') return;
    $id_e = esc_attr($id);
    echo "\n<!-- Tagioo GTM noscript -->\n";
    echo "<noscript><iframe src=\"https://www.googletagmanager.com/ns.html?id={$id_e}\" height=\"0\" width=\"0\" style=\"display:none;visibility:hidden\"></iframe></noscript>\n";
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

/**
 * Build user_data using exact field names the Tagioo sGTM CAPI template reads.
 * Passes plain text — sGTM hashes server-side (SHA-256).
 */
function tagioo_user_data_from_order(\WC_Order $order): array {
    $phone = preg_replace('/[^0-9+]/', '', $order->get_billing_phone());
    if ($phone && !str_starts_with($phone, '+')) {
        $phone = '+88' . ltrim($phone, '0');
    }

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
    $user  = get_userdata($user_id);
    $phone = preg_replace('/[^0-9+]/', '', (string) get_user_meta($user_id, 'billing_phone', true));
    if ($phone && !str_starts_with($phone, '+')) {
        $phone = '+88' . ltrim($phone, '0');
    }
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
// Capture _fbp, _fbc, User-Agent at checkout — store in order meta
// Gives server-side hit the cookies it needs for 10/10 EMQ
// ---------------------------------------------------------------------------

// 1. Inject JS that reads cookies + UA and stores in hidden checkout fields.
add_action('woocommerce_before_checkout_form', function () {
    ?>
    <input type="hidden" id="tagioo_fbp" name="tagioo_fbp" value="" />
    <input type="hidden" id="tagioo_fbc" name="tagioo_fbc" value="" />
    <input type="hidden" id="tagioo_ua"  name="tagioo_ua"  value="" />
    <script>
    (function(){
        function getCookie(n){var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');return m?decodeURIComponent(m[2]):''}
        var fbp=getCookie('_fbp'), fbc=getCookie('_fbc');
        // _fbc can also come from fbclid URL param
        if(!fbc){var u=new URLSearchParams(window.location.search);if(u.get('fbclid'))fbc='fb.1.'+Date.now()+'.'+u.get('fbclid');}
        document.getElementById('tagioo_fbp').value=fbp;
        document.getElementById('tagioo_fbc').value=fbc;
        document.getElementById('tagioo_ua').value=navigator.userAgent;
    })();
    </script>
    <?php
}, 1);

// 2. Save to order meta on order creation.
add_action('woocommerce_checkout_create_order', function (\WC_Order $order, array $data) {
    $fbp = sanitize_text_field(wp_unslash($_POST['tagioo_fbp'] ?? ''));
    $fbc = sanitize_text_field(wp_unslash($_POST['tagioo_fbc'] ?? ''));
    $ua  = sanitize_text_field(wp_unslash($_POST['tagioo_ua']  ?? ''));
    if ($fbp) $order->update_meta_data(TAGIOO_META_FBP, $fbp);
    if ($fbc) $order->update_meta_data(TAGIOO_META_FBC, $fbc);
    if ($ua)  $order->update_meta_data(TAGIOO_META_UA,  $ua);
}, 10, 2);

// ---------------------------------------------------------------------------
// view_item
// ---------------------------------------------------------------------------
add_action('wp_footer', function () {
    if (tagioo_opt('track_view_item') !== '1' || !is_product()) return;
    $product = wc_get_product(get_the_ID());
    if (!$product) return;
    $item = tagioo_item_from_product($product);
    $push = ['event' => 'view_item', 'ecommerce' => [
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
    $push = ['event' => 'add_to_cart', 'ecommerce' => [
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
    $push = ['event' => 'begin_checkout', 'ecommerce' => [
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
// Fires on payment complete — works even if browser is closed / pixel blocked.
// event_id matches browser hit → Meta deduplicates both to 1 conversion.
// ---------------------------------------------------------------------------
add_action('woocommerce_payment_complete', function (int $order_id) {
    if (tagioo_opt('server_hit') !== '1') return;

    $sgtm       = tagioo_opt('sgtm_domain');
    $mid        = tagioo_opt('measurement_id');
    $secret     = tagioo_opt('api_secret');

    if (!$sgtm || !$mid || !$secret) return;

    $order = wc_get_order($order_id);
    if (!$order) return;

    // Dedup: fire server hit once per order.
    if ($order->get_meta(TAGIOO_META_SS_FIRED)) return;
    $order->update_meta_data(TAGIOO_META_SS_FIRED, '1');
    $order->save();

    $order_num  = (string) $order->get_order_number();
    $event_id   = 'tagioo-purchase-' . $order_num; // same as browser hit

    $user_data  = tagioo_user_data_from_order($order);

    // Add stored fbp/fbc captured from browser at checkout
    $fbp = $order->get_meta(TAGIOO_META_FBP);
    $fbc = $order->get_meta(TAGIOO_META_FBC);
    $ua  = $order->get_meta(TAGIOO_META_UA);
    $ip  = $order->get_customer_ip_address();

    // sGTM's GA4 client only claims the gtag wire format on /g/collect — a
    // Measurement Protocol JSON body returns HTTP 400 and the hit is lost. Build
    // a gtag query string so the GA4 client claims it, forwards to GA4, and fires
    // Meta CAPI. event_id matches the browser hit → Meta + GA4 (by transaction_id)
    // dedup to one conversion.
    $params = [
        'v'                => '2',
        'tid'              => $mid,
        'cid'              => 'tagioo_server.' . $order_num,
        'en'               => 'purchase',
        '_et'              => '100',                 // engagement, so GA4 records it
        'sid'              => (string) time(),
        '_p'               => (string) wp_rand(1, 2147483647),
        'cu'               => tagioo_currency(),
        'epn.value'        => tagioo_price((string) $order->get_total()),
        'epn.tax'          => tagioo_price((string) $order->get_total_tax()),
        'epn.shipping'     => tagioo_price((string) $order->get_shipping_total()),
        'ep.transaction_id'=> $order_num,
        'ep.coupon'        => implode(',', $order->get_coupon_codes()),
        'ep.event_id'      => $event_id,
        // page_location → Meta event_source_url + GA4 page path (not the homepage).
        'dl'               => $order->get_checkout_order_received_url(),
        // Tagioo CAPI template reads eventData.fbp / eventData.fbc.
        'ep.fbp'           => $fbp ?: '',
        'ep.fbc'           => $fbc ?: '',
    ];
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

    wp_remote_post($url, [
        'headers'   => $headers,
        'timeout'   => 10,
        'blocking'  => false, // fire-and-forget, don't block order processing
    ]);
}, 10);

// Also fire on status change to processing (cash on delivery, BACS, etc.)
add_action('woocommerce_order_status_processing', function (int $order_id) {
    do_action('woocommerce_payment_complete', $order_id);
}, 10);
