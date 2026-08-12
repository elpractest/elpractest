import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../api_client.dart';
import '../models.dart';
import '../utils.dart';
import '../widgets.dart';

Future<void> showStudentCheckout(
  BuildContext context, {
  required Batch batch,
  required String courseTitle,
  required VoidCallback onEnrolled,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _StudentCheckout(
      batch: batch,
      courseTitle: courseTitle,
      onEnrolled: onEnrolled,
    ),
  );
}

class _StudentCheckout extends StatefulWidget {
  const _StudentCheckout({
    required this.batch,
    required this.courseTitle,
    required this.onEnrolled,
  });

  final Batch batch;
  final String courseTitle;
  final VoidCallback onEnrolled;

  @override
  State<_StudentCheckout> createState() => _StudentCheckoutState();
}

class _StudentCheckoutState extends State<_StudentCheckout> {
  final _couponController = TextEditingController();
  bool _showCouponInput = false;
  bool _couponLoading = false;
  Map<String, dynamic>? _couponState; // { valid, discounted_price, message }
  bool _payLoading = false;
  String _error = '';
  bool _success = false;
  Razorpay? _razorpay;

  int? get _originalPrice => widget.batch.pricePaise;
  int? get _finalPrice =>
      (_couponState?['valid'] == true ? (_couponState?['discounted_price'] as num?)?.toInt() : null) ??
      _originalPrice;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _couponController.dispose();
    _razorpay?.clear();
    super.dispose();
  }

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _couponLoading = true;
      _error = '';
    });
    try {
      final data = await ApiClient.instance.post('/student/checkout/validate-coupon', body: {
        'code': code,
        'batch_id': widget.batch.id,
      });
      if (!mounted) return;
      setState(() => _couponState = data);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _couponState = {
            'valid': false,
            'message': e.message.isEmpty ? 'Invalid coupon.' : e.message,
          });
    } finally {
      if (mounted) setState(() => _couponLoading = false);
    }
  }

  Future<void> _handlePayment() async {
    setState(() {
      _error = '';
      _payLoading = true;
    });
    try {
      final data = await ApiClient.instance.post('/student/checkout/create-order', body: {
        'batch_id': widget.batch.id,
        if (_couponState?['valid'] == true) 'coupon_code': _couponController.text.trim(),
        'event_id': 'evt_${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecondsSinceEpoch}',
      });

      // A 100%-off coupon enrolls directly and skips Razorpay entirely.
      if (data['enrolled'] == true) {
        if (!mounted) return;
        setState(() {
          _success = true;
          _payLoading = false;
        });
        widget.onEnrolled();
        return;
      }

      final key = data['razorpay_key']?.toString();
      final orderId = data['order_id']?.toString();
      final amount = data['amount'] as num?;
      final currency = data['currency']?.toString() ?? 'INR';
      if (key == null || orderId == null || amount == null || _razorpay == null) {
        throw Exception('Could not start checkout. Please try again.');
      }

      _razorpay!.open({
        'key': key,
        'order_id': orderId,
        'amount': amount.toInt(),
        'currency': currency,
        'name': widget.courseTitle,
        'description': 'Enrollment — ${widget.batch.name}',
        'theme': {'color': '#6366F1'},
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isEmpty ? 'Could not start checkout. Please try again.' : e.message;
        _payLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not start checkout. Please try again.';
        _payLoading = false;
      });
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    try {
      await ApiClient.instance.post('/student/checkout/verify', body: {
        'razorpay_order_id': response.orderId,
        'razorpay_payment_id': response.paymentId,
        'razorpay_signature': response.signature,
      });
      if (!mounted) return;
      setState(() {
        _success = true;
        _payLoading = false;
      });
      widget.onEnrolled();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isEmpty
            ? "We couldn't confirm your payment. If money was deducted, it will be reconciled automatically — contact support if it isn't within a few minutes."
            : e.message;
        _payLoading = false;
      });
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() {
      _error = 'Payment failed. No amount was deducted — you can try again.';
      _payLoading = false;
    });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    // Payment handled outside the app; on return the success/error callbacks fire.
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final price = _originalPrice ?? 0;
    final finalPrice = _finalPrice ?? price;
    final couponValid = _couponState?['valid'] == true;
    final couponMessage = _couponState?['message']?.toString();

    if (_success) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: c.panel,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: c.borderStrong),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MedallionIcon(icon: Icons.check_circle, color: c.success, size: 36, padding: 18),
            const SizedBox(height: 16),
            Text("You're enrolled",
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 8),
            Text(
              '${widget.courseTitle} (${widget.batch.name}) is now in your dashboard.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, color: c.textSecondary),
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Go to my courses',
              fullWidth: true,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      );
    }

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: BoxDecoration(
        color: c.panel,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: c.borderStrong),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.courseTitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                      const SizedBox(height: 2),
                      Text(widget.batch.name ?? '',
                          style: TextStyle(fontSize: 13, color: c.textSecondary)),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close, color: c.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: c.sunken,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!couponValid)
                    InkWell(
                      onTap: () => setState(() => _showCouponInput = !_showCouponInput),
                      child: Text('Have a coupon?',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.brandBright)),
                    ),
                  if (couponValid)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: c.successBg,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: c.successBorder),
                      ),
                      child: Text('Coupon "${_couponController.text.trim()}" applied!',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.successText)),
                    ),
                  if (_showCouponInput && !couponValid) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: AppTextField(
                            label: '',
                            controller: _couponController,
                            hint: 'Enter coupon code',
                            enabled: !_couponLoading,
                          ),
                        ),
                        const SizedBox(width: 8),
                        SecondaryButton(
                          label: _couponLoading ? '...' : 'Apply',
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          onPressed: (_couponLoading || _couponController.text.trim().isEmpty)
                              ? null
                              : _applyCoupon,
                        ),
                      ],
                    ),
                  ],
                  if (couponValid == false && couponMessage != null) ...[
                    const SizedBox(height: 8),
                    Text(couponMessage, style: TextStyle(fontSize: 12.5, color: c.dangerText)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.only(top: 16),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Price', style: TextStyle(fontSize: 14, color: c.textSecondary)),
                      Text(formatRupees(price), style: TextStyle(fontSize: 14, color: c.textSecondary)),
                    ],
                  ),
                  if (couponValid) ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Discount', style: TextStyle(fontSize: 14, color: c.success)),
                        Text('-${formatRupees(price - finalPrice)}',
                            style: TextStyle(fontSize: 14, color: c.success)),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.only(top: 12),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Total',
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: c.textPrimary)),
                        Text(formatRupees(finalPrice),
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: c.textPrimary)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (_error.isNotEmpty) ...[
              const SizedBox(height: 14),
              ErrorBanner(_error),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: _payLoading
                  ? 'Starting checkout...'
                  : finalPrice == 0
                      ? 'Enroll for free'
                      : 'Pay ${formatRupees(finalPrice)}',
              fullWidth: true,
              loading: _payLoading,
              onPressed: _payLoading ? null : _handlePayment,
            ),
          ],
        ),
      ),
    );
  }
}
