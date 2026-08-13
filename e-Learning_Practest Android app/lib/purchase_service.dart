import 'dart:async';

import 'package:in_app_purchase/in_app_purchase.dart';

import 'api_client.dart';

/// What the store UI hears back about a purchase attempt.
enum PurchaseOutcome { pending, delivered, failed, canceled }

class PurchaseResult {
  const PurchaseResult(this.productId, this.outcome, {this.message});

  final String productId;
  final PurchaseOutcome outcome;
  final String? message;
}

/// The Google Play Billing client.
///
/// The one rule this service exists to enforce: **a purchase is worth nothing
/// until the server has validated its token.** Play (or a tampered client) can
/// report "purchased" freely; entitlement is granted only after
/// `/student/checkout/google-play/verify` confirms the token against the Play
/// Developer API. So the flow is always buy → Play returns a token → POST it to
/// the backend → only on the backend's `enrolled:true` do we complete the
/// purchase and tell the UI it's delivered.
///
/// It degrades quietly: if the device has no billing (no Play Services, an
/// emulator without the Store), [available] is false and the store shows its
/// activation-code fallback instead of a dead Buy button.
class PurchaseService {
  PurchaseService._();
  static final PurchaseService instance = PurchaseService._();

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _sub;
  final StreamController<PurchaseResult> _results = StreamController<PurchaseResult>.broadcast();

  bool _available = false;
  bool _initialised = false;

  /// Whether this device can transact at all. False on an emulator without the
  /// Play Store, or where billing is otherwise unavailable.
  bool get available => _available;

  /// Purchase outcomes, delivered after server verification. The store listens
  /// to this to flip a card to "Owned" or surface an error.
  Stream<PurchaseResult> get results => _results.stream;

  Future<void> init() async {
    if (_initialised) return;
    _initialised = true;
    try {
      _available = await _iap.isAvailable();
    } catch (_) {
      _available = false;
    }
    if (!_available) return;
    // The stream also redelivers past, unacknowledged purchases on launch —
    // which is exactly how a purchase whose verify failed last time gets
    // retried. The backend verify is idempotent, so re-delivery is safe.
    _sub = _iap.purchaseStream.listen(
      _onPurchases,
      onError: (_) {},
    );
  }

  /// Resolve Play product details (localized price, title) for the given ids.
  /// Ids Play does not know are returned in [ProductDetailsResponse.notFoundIDs]
  /// — the store treats those batches as not yet on sale.
  Future<ProductDetailsResponse?> loadProducts(Set<String> ids) async {
    if (!_available || ids.isEmpty) return null;
    try {
      return await _iap.queryProductDetails(ids);
    } catch (_) {
      return null;
    }
  }

  /// Start the Play purchase UI for a product. The result arrives later on
  /// [results], after the backend has verified the token.
  Future<void> buy(ProductDetails product) async {
    if (!_available) {
      _results.add(PurchaseResult(product.id, PurchaseOutcome.failed,
          message: 'In-app purchases are not available on this device.'));
      return;
    }
    final param = PurchaseParam(productDetails: product);
    try {
      // Non-consumable: a course is bought once and owned, not re-consumed.
      await _iap.buyNonConsumable(purchaseParam: param);
    } catch (e) {
      _results.add(PurchaseResult(product.id, PurchaseOutcome.failed,
          message: 'Could not start the purchase.'));
    }
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final p in purchases) {
      switch (p.status) {
        case PurchaseStatus.pending:
          _results.add(PurchaseResult(p.productID, PurchaseOutcome.pending));
          break;
        case PurchaseStatus.canceled:
          _results.add(PurchaseResult(p.productID, PurchaseOutcome.canceled));
          if (p.pendingCompletePurchase) await _iap.completePurchase(p);
          break;
        case PurchaseStatus.error:
          _results.add(PurchaseResult(p.productID, PurchaseOutcome.failed,
              message: p.error?.message ?? 'The purchase failed.'));
          if (p.pendingCompletePurchase) await _iap.completePurchase(p);
          break;
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _deliver(p);
          break;
      }
    }
  }

  Future<void> _deliver(PurchaseDetails p) async {
    try {
      final data = await ApiClient.instance.post(
        '/student/checkout/google-play/verify',
        body: {
          'product_id': p.productID,
          // On Android this is the Play purchase token the backend validates.
          'purchase_token': p.verificationData.serverVerificationData,
        },
      );
      if (data['enrolled'] == true) {
        // Only NOW is it safe to complete: the entitlement is granted, so the
        // purchase can leave Play's queue.
        if (p.pendingCompletePurchase) await _iap.completePurchase(p);
        _results.add(PurchaseResult(p.productID, PurchaseOutcome.delivered));
      } else {
        _results.add(PurchaseResult(p.productID, PurchaseOutcome.failed,
            message: 'We could not confirm your purchase.'));
      }
    } on ApiException catch (e) {
      // Do NOT complete on failure — leaving it pending means Play redelivers
      // it on next launch and we retry the (idempotent) verify. Money is not
      // lost; access is simply deferred to the retry.
      _results.add(PurchaseResult(p.productID, PurchaseOutcome.failed,
          message: e.message.isEmpty ? 'We could not confirm your purchase.' : e.message));
    } catch (_) {
      _results.add(PurchaseResult(p.productID, PurchaseOutcome.failed,
          message: 'We could not confirm your purchase.'));
    }
  }

  void dispose() {
    _sub?.cancel();
    _results.close();
  }
}
