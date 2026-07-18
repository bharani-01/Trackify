import 'package:flutter/material.dart';
import '../core/api_client.dart';

class SubjectsScreen extends StatefulWidget {
  const SubjectsScreen({super.key});

  @override
  State<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends State<SubjectsScreen> {
  List<dynamic> _subjects = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await ApiClient.get('/api/subjects');
    if (mounted) {
      setState(() {
        _subjects = res['success'] == true ? (res['subjects'] ?? []) : [];
        _loading = false;
      });
    }
  }


  // Since it is private, we can't call it outside ApiClient. Let's check ApiClient class in `core/api_client.dart`.
  // Yes! It only exposes get, post, put.
  // Wait, let's look at how subject delete is triggered in the web app:
  // It calls: `apiCall('/api/subjects/' + id, { method: 'DELETE' })`
  // And backend router mapping is:
  // `router.route('/:id').delete(deleteSubject)`
  // So we need to support DELETE in ApiClient! Let's modify `core/api_client.dart` to add the `delete` method helper first. It's clean and safe!
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Manage Subjects', style: TextStyle(fontWeight: FontWeight.w800)),
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : _subjects.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF2563EB),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _subjects.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final sub = _subjects[i];
                      return _buildSubjectItem(sub);
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showForm(null),
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Add Subject', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildSubjectItem(dynamic sub) {
    final colorVal = _parseColor(sub['color']);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 16,
            height: 48,
            decoration: BoxDecoration(
              color: colorVal,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sub['subject_name'] ?? 'Unknown',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                Text(
                  '${sub['subject_code'] ?? ''}  ·  ${sub['credits'] ?? 0} Credits  ·  ${sub['total_periods'] ?? 0} Periods',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: Color(0xFF64748B), size: 20),
            onPressed: () => _showForm(sub),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
            onPressed: () => _handleDelete(sub['id'].toString()),
          ),
        ],
      ),
    );
  }

  Color _parseColor(dynamic hex) {
    if (hex == null || !(hex is String)) return const Color(0xFF2563EB);
    final str = hex.replaceAll('#', '');
    if (str.length == 6) {
      return Color(int.parse('FF$str', radix: 16));
    }
    return const Color(0xFF2563EB);
  }

  Widget _empty() => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.menu_book_outlined, size: 48, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            const Text('No subjects added yet', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
            const SizedBox(height: 4),
            const Text('Tap add to create subjects', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          ],
        ),
      );

  Future<void> _handleDelete(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Subject', style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text('Deleting this subject will also delete all associated attendance logs. Are you sure?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      final res = await ApiClient.delete('/api/subjects/$id');
      if (res['success'] == true) {
        _load();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(res['message'] ?? 'Failed to delete subject')),
          );
        }
      }
    }
  }

  void _showForm(dynamic sub) {
    final isEdit = sub != null;
    final nameCtrl = TextEditingController(text: isEdit ? sub['subject_name'] : '');
    final codeCtrl = TextEditingController(text: isEdit ? sub['subject_code'] : '');
    final creditsCtrl = TextEditingController(text: isEdit ? sub['credits']?.toString() : '3');
    final periodsCtrl = TextEditingController(text: isEdit ? sub['total_periods']?.toString() : '45');
    String selectedColor = isEdit ? sub['color'] ?? '#2563eb' : '#2563eb';

    final colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#4f46e5'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setStateSheet) {
            return Padding(
              padding: EdgeInsets.fromLTRB(16, 20, 16, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isEdit ? 'Edit Subject' : 'Add Subject',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Subject Name',
                      hintText: 'e.g. Data Structures',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: codeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Subject Code',
                      hintText: 'e.g. CS201',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: creditsCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Credits',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: periodsCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Total Periods',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text('Select Theme Color', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 40,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: colors.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, idx) {
                        final hex = colors[idx];
                        final active = hex == selectedColor;
                        return InkWell(
                          onTap: () => setStateSheet(() => selectedColor = hex),
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: _parseColor(hex),
                              shape: BoxShape.circle,
                              border: active ? Border.all(color: Colors.black, width: 3) : null,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () async {
                        final name = nameCtrl.text.trim();
                        final code = codeCtrl.text.trim();
                        final credits = int.tryParse(creditsCtrl.text) ?? 3;
                        final totalP = int.tryParse(periodsCtrl.text) ?? 45;

                        if (name.isEmpty || code.isEmpty) return;

                        final body = {
                          'subject_name': name,
                          'subject_code': code,
                          'credits': credits,
                          'total_periods': totalP,
                          'color': selectedColor,
                        };

                        Map<String, dynamic> res;
                        if (isEdit) {
                          res = await ApiClient.put('/api/subjects/${sub['id']}', body);
                        } else {
                          res = await ApiClient.post('/api/subjects', body);
                        }

                        if (res['success'] == true) {
                          if (ctx.mounted) Navigator.pop(ctx);
                          _load();
                        } else {
                          setStateSheet(() {
                            if (ctx.mounted) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(content: Text(res['message'] ?? 'Operation failed')),
                              );
                            }
                          });
                        }
                      },
                      child: const Text('Save Subject', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
