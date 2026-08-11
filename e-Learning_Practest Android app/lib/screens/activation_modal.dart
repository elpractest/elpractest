import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

enum _Tab { request, redeem }

Future<void> showActivationModal(
  BuildContext context, {
  required VoidCallback onSuccess,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ActivationModal(onSuccess: onSuccess),
  );
}

class _ActivationModal extends StatefulWidget {
  const _ActivationModal({required this.onSuccess});

  final VoidCallback onSuccess;

  @override
  State<_ActivationModal> createState() => _ActivationModalState();
}

class _ActivationModalState extends State<_ActivationModal> {
  _Tab _tab = _Tab.request;

  List<PublicCourse> _courses = [];
  bool _loadingCourses = true;
  int? _selectedBatchId;
  final _paymentRef = TextEditingController();
  File? _proofFile;
  String? _proofName;

  final _code = TextEditingController();

  bool _submitting = false;
  String _error = '';
  String _successMsg = '';

  @override
  void initState() {
    super.initState();
    _loadCourses();
  }

  @override
  void dispose() {
    _paymentRef.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _loadCourses() async {
    try {
      final data = await ApiClient.instance.get('/courses/public');
      if (!mounted) return;
      final list = extractList(data, 'courses')
              .map((c) => PublicCourse.fromJson(c as Map<String, dynamic>))
              .toList();
      setState(() {
        _courses = list;
        _loadingCourses = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingCourses = false);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final path = file.path;
    if (path == null) return;
    final f = File(path);
    final size = await f.length();
    if (size > 4 * 1024 * 1024) {
      setState(() {
        _error = 'Proof file must be 4 MB or smaller.';
        _proofFile = null;
        _proofName = null;
      });
      return;
    }
    setState(() {
      _error = '';
      _proofFile = f;
      _proofName = file.name;
    });
  }

  void _switchTab(_Tab tab) {
    setState(() {
      _tab = tab;
      _error = '';
      _successMsg = '';
    });
  }

  Future<void> _submitRequest() async {
    setState(() {
      _error = '';
      _successMsg = '';
    });
    if (_selectedBatchId == null || _paymentRef.text.trim().isEmpty || _proofFile == null) {
      setState(() => _error = 'Please select a batch, enter your payment reference, and attach proof document.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final formData = await buildProofFormData(
        batchId: _selectedBatchId!,
        paymentReference: _paymentRef.text.trim(),
        proofFile: _proofFile!,
      );
      await ApiClient.instance.post('/student/activation-requests', formData: formData);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _successMsg = 'Your activation request has been submitted! An admin will review your receipt shortly.';
      });
      await Future<void>.delayed(const Duration(seconds: 2));
      if (!mounted) return;
      widget.onSuccess();
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message.isEmpty ? 'Failed to submit activation request.' : e.message;
      });
    }
  }

  Future<void> _submitRedeem() async {
    setState(() {
      _error = '';
      _successMsg = '';
    });
    final code = _code.text.trim();
    if (code.length != 8) {
      setState(() => _error = 'Please enter a valid 8-character activation code.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final data = await ApiClient.instance.post(
        '/student/activation-codes/redeem',
        body: {'code': code.toUpperCase()},
      );
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _successMsg = data['message']?.toString() ?? 'Activation code redeemed! Course unlocked.';
      });
      await Future<void>.delayed(const Duration(milliseconds: 1500));
      if (!mounted) return;
      widget.onSuccess();
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message.isEmpty ? 'Invalid or expired activation code.' : e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        decoration: BoxDecoration(
          color: c.panelBgSolid,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: c.borderStrong),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: c.borderStrong,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        _TabButton(
                          label: 'Request Batch Activation',
                          selected: _tab == _Tab.request,
                          onTap: () => _switchTab(_Tab.request),
                        ),
                        const SizedBox(width: 12),
                        _TabButton(
                          label: 'Redeem Activation Code',
                          selected: _tab == _Tab.redeem,
                          onTap: () => _switchTab(_Tab.redeem),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close, color: c.textSecondary),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error.isNotEmpty) ...[
                      ErrorBanner(_error),
                      const SizedBox(height: 14),
                    ],
                    if (_successMsg.isNotEmpty) ...[
                      SuccessBanner(_successMsg),
                      const SizedBox(height: 14),
                    ],
                    if (_tab == _Tab.request) ...[
                      _buildRequestTab(c),
                    ] else ...[
                      _buildRedeemTab(c),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestTab(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Select Course & Batch *',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: c.surfaceSunken,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: c.border),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<int>(
              value: _selectedBatchId,
              isExpanded: true,
              dropdownColor: c.panelBgSolid,
              hint: Text(_loadingCourses ? 'Loading batches...' : '-- Select Course Batch --',
                  style: TextStyle(fontSize: 14, color: c.textSecondary)),
              items: [
                for (final course in _courses)
                  for (final batch in course.batches)
                    DropdownMenuItem(
                      value: batch.id,
                      child: Text(
                        '${course.title} — ${batch.name}'
                        '${batch.pricePaise != null ? ' (₹${batch.pricePaise! ~/ 100})' : ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13.5),
                      ),
                    ),
              ],
              onChanged: _submitting
                  ? null
                  : (v) => setState(() => _selectedBatchId = v),
            ),
          ),
        ),
        const SizedBox(height: 16),
        AppTextField(
          label: 'Payment Reference / Transaction ID *',
          controller: _paymentRef,
          hint: 'e.g. UTR-9876543210 or Bank Reference No.',
          enabled: !_submitting,
        ),
        const SizedBox(height: 16),
        Text(
          'Upload Payment Proof (JPG, PNG, PDF ≤ 4MB) *',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: _submitting ? null : _pickFile,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: c.surfaceSunken,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              border: Border.all(color: _proofFile != null ? c.accentBorder : c.border),
            ),
            child: Row(
              children: [
                Icon(
                  _proofFile != null ? Icons.description_outlined : Icons.upload_file,
                  size: 20,
                  color: _proofFile != null ? c.accent : c.textSecondary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _proofName ?? 'Choose a file (jpg, png, pdf)',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      color: _proofName != null ? c.textPrimary : c.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        GradientButton(
          label: _submitting ? 'Submitting Request...' : 'Submit Activation Request',
          fullWidth: true,
          loading: _submitting,
          onPressed: _submitting ? null : _submitRequest,
        ),
      ],
    );
  }

  Widget _buildRedeemTab(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '8-Character Activation Code *',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary),
        ),
        const SizedBox(height: 6),
        AppTextField(
          label: '',
          controller: _code,
          hint: 'e.g. PRAC8821',
          maxLength: 8,
          enabled: !_submitting,
          autocorrect: false,
          onChanged: (_) => setState(() {}),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Enter the unique 8-character activation code issued by your coaching admin to immediately unlock course access.',
          style: TextStyle(fontSize: 12.5, color: c.textSecondary, height: 1.4),
        ),
        const SizedBox(height: 20),
        GradientButton(
          label: _submitting ? 'Redeeming Code...' : 'Redeem Code',
          fullWidth: true,
          loading: _submitting,
          onPressed: _submitting ? null : _submitRedeem,
        ),
      ],
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? c.accent : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? c.accent : c.textSecondary,
          ),
        ),
      ),
    );
  }
}
