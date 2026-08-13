import 'dart:async';

import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../api_client.dart';
import '../models.dart';
import '../purchase_service.dart';
import '../scaffold.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';

/// The Store tab — a real storefront over `/student/purchasable-courses`,
/// transacting through Google Play Billing.
///
/// It degrades honestly at every missing rung: no billing on the device, or no
/// Play products created yet, and it falls back to the same message the old stub
/// showed — buy is offered only for a batch whose `play_product_id` actually
/// resolves to a Play product. Nothing here charges anyone; the buy hands off to
/// [PurchaseService], and access is granted only after the server verifies the
/// token.
class StoreScreen extends StatefulWidget {
  const StoreScreen({super.key});

  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  List<PublicCourse> _courses = [];
  bool _loading = true;
  String _error = '';

  final Map<String, ProductDetails> _products = {};
  final Set<String> _owned = {};
  final Set<String> _busy = {};
  bool _storeReady = false;

  StreamSubscription<PurchaseResult>? _sub;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    await PurchaseService.instance.init();
    _storeReady = PurchaseService.instance.available;
    _sub = PurchaseService.instance.results.listen(_onResult);
    await _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await ApiClient.instance.get('/student/purchasable-courses');
      final list = extractList(data, 'courses')
          .map((c) => PublicCourse.fromJson(c as Map<String, dynamic>))
          .toList();
      final ids = <String>{
        for (final course in list)
          for (final b in course.batches)
            if (b.playProductId != null && b.playProductId!.isNotEmpty) b.playProductId!,
      };
      if (_storeReady && ids.isNotEmpty) {
        final resp = await PurchaseService.instance.loadProducts(ids);
        _products.clear();
        for (final p in resp?.productDetails ?? const <ProductDetails>[]) {
          _products[p.id] = p;
        }
      }
      if (!mounted) return;
      setState(() {
        _courses = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load the store. Pull down to retry.';
        _loading = false;
      });
    }
  }

  void _onResult(PurchaseResult r) {
    if (!mounted) return;
    setState(() => _busy.remove(r.productId));
    switch (r.outcome) {
      case PurchaseOutcome.pending:
        setState(() => _busy.add(r.productId));
        _snack('Waiting for Google Play to confirm your payment…');
        break;
      case PurchaseOutcome.delivered:
        setState(() => _owned.add(r.productId));
        _snack('You’re enrolled — find it under Home and Study.', good: true);
        _fetch();
        break;
      case PurchaseOutcome.canceled:
        break;
      case PurchaseOutcome.failed:
        _snack(r.message ?? 'The purchase could not be completed.');
        break;
    }
  }

  void _snack(String message, {bool good = false}) {
    final c = useColors(context);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message, style: AppText.body.copyWith(color: c.textPrimary)),
      backgroundColor: good ? c.successBg : c.raised,
    ));
  }

  void _buy(Batch batch) {
    final pid = batch.playProductId;
    final product = pid == null ? null : _products[pid];
    if (product == null) return;
    setState(() => _busy.add(product.id));
    PurchaseService.instance.buy(product);
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          const AppHeader(title: 'Store'),
          Expanded(
            child: RefreshIndicator(
              color: c.brand,
              onRefresh: _fetch,
              child: _loading
                  ? const LoadingView(message: 'Loading the store…')
                  : _error.isNotEmpty
                      ? ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            ErrorBanner(_error),
                            const SizedBox(height: 12),
                            Center(
                              child: SecondaryButton(
                                  label: 'Retry', icon: Icons.refresh, onPressed: _fetch),
                            ),
                          ],
                        )
                      : _body(c),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(AppColors c) {
    final buyable = _courses.any((course) =>
        course.batches.any((b) => b.playProductId != null && _products.containsKey(b.playProductId)));

    // Nothing to sell yet — no priced Play products resolved, or billing is
    // unavailable. Same destination the stub pointed at: activation codes.
    if (!buyable) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 24),
          EmptyState(
            icon: Icons.storefront_outlined,
            title: 'Store',
            message: _storeReady
                ? 'Course purchases are coming soon. Your institute can open access '
                    'now with an activation code — redeem it from Profile.'
                : 'In-app purchases aren’t available on this device. Your institute '
                    'can open access with an activation code — redeem it from Profile.',
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        Text('Courses', style: AppText.screenTitle.copyWith(color: c.textPrimary, fontSize: 22)),
        const SizedBox(height: 4),
        Text('Buy securely through Google Play.',
            style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 12.5)),
        const SizedBox(height: 16),
        for (final course in _courses) ...[
          _courseCard(c, course),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _courseCard(AppColors c, PublicCourse course) {
    final priced = course.batches
        .where((b) => b.playProductId != null && _products.containsKey(b.playProductId))
        .toList();
    if (priced.isEmpty) return const SizedBox.shrink();

    return SurfacePanel(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CourseCover(title: course.title ?? '', height: 96),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(course.title ?? '',
                      style: AppText.cardTitleSm.copyWith(color: c.textPrimary)),
                  if ((course.shortDescription ?? course.description ?? '').isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      course.shortDescription ?? course.description ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.caption.copyWith(color: c.textSecondary),
                    ),
                  ],
                  const SizedBox(height: 12),
                  for (final batch in priced) ...[
                    _batchRow(c, course, batch),
                    if (batch != priced.last) const SizedBox(height: 8),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _batchRow(AppColors c, PublicCourse course, Batch batch) {
    final product = _products[batch.playProductId];
    final owned = product != null && _owned.contains(product.id);
    final busy = product != null && _busy.contains(product.id);
    // Play's localized price is the one that must be shown for a Play purchase;
    // the DB rupee price is only a fallback for display before products resolve.
    final priceLabel = product?.price ?? formatRupees(batch.pricePaise ?? 0);

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(batch.name ?? 'Batch',
                  style: AppText.captionStrong.copyWith(color: c.textPrimary, fontSize: 13)),
              if (batch.startsAt != null)
                Text('Starts ${formatDate(batch.startsAt!)}',
                    style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 11.5)),
            ],
          ),
        ),
        const SizedBox(width: 10),
        if (owned)
          TrailingBadge('OWNED', color: c.success)
        else
          PrimaryButton(
            label: busy ? '…' : priceLabel,
            fontSize: 13,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            loading: busy,
            onPressed: busy ? null : () => _buy(batch),
          ),
      ],
    );
  }
}
