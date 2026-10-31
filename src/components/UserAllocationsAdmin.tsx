import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Edit2,
  Trash2,
  Save,
  X,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  Shield,
  Layers,
} from 'lucide-react';
import { UserAllocation, AVAILABLE_HODS, DEFAULT_USER_ALLOCATIONS } from '../types/allocation';
import { TranslatedCcfRow, NavTab } from '../types/ccf';
import { findUnmappedAssignees } from '../utils/allocationStore';

interface UserAllocationsAdminProps {
  allocations: UserAllocation[];
  onSaveAllocations: (allocations: UserAllocation[]) => void;
  rows: TranslatedCcfRow[];
  onSelectUserFilter: (ownerName: string) => void;
  onNavigateToTab: (tab: NavTab) => void;
}

export const UserAllocationsAdmin: React.FC<UserAllocationsAdminProps> = ({
  allocations,
  onSaveAllocations,
  rows,
  onSelectUserFilter,
  onNavigateToTab,
}) => {
  const [search, setSearch] = useState('');
  const [selectedHodFilter, setSelectedHodFilter] = useState<string>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ owner: string; assignee: string; hod: string }>({
    owner: '',
    assignee: '',
    hod: 'Himanshu',
  });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newForm, setNewForm] = useState<{ owner: string; assignee: string; hod: string }>({
    owner: '',
    assignee: '',
    hod: 'Himanshu',
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  // 2026 cases
  const rows2026 = rows.filter((r) => r.isNewCase || r.ccfType !== 'External');

  // Compute case counts per user in the active dataset
  const getUserCaseCounts = (alloc: UserAllocation) => {
    const ownerLower = alloc.owner.toLowerCase().trim();
    const userLower = alloc.assignee.toLowerCase().trim();

    const userRows = rows2026.filter((r) => {
      const a = String(r.assignee || '').toLowerCase().trim();
      const k = String(r.assigneeKey || '').toLowerCase().trim();
      return a === ownerLower || a === userLower || k === userLower;
    });

    return {
      total2026: userRows.length,
      withinSla: userRows.filter(
        (r) => r.slaDuration === '90' || r.slaProgressStatus === 'Within 90'
      ).length,
    };
  };

  // Find unmapped assignees in uploaded spreadsheet
  const unmapped = findUnmappedAssignees(rows2026, allocations);

  // Filter allocations
  const filteredAllocations = allocations.filter((a) => {
    const matchSearch =
      a.owner.toLowerCase().includes(search.toLowerCase()) ||
      a.assignee.toLowerCase().includes(search.toLowerCase()) ||
      a.hod.toLowerCase().includes(search.toLowerCase());
    const matchHod = selectedHodFilter === 'All' || a.hod === selectedHodFilter;
    return matchSearch && matchHod;
  });

  const handleStartEdit = (alloc: UserAllocation) => {
    setEditingId(alloc.id);
    setEditForm({
      owner: alloc.owner,
      assignee: alloc.assignee,
      hod: alloc.hod,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.owner.trim() || !editForm.assignee.trim()) {
      setFeedback('Owner name and Assignee username are required.');
      return;
    }
    const updated = allocations.map((a) =>
      a.id === id ? { ...a, ...editForm } : a
    );
    onSaveAllocations(updated);
    setEditingId(null);
    setFeedback(`Updated allocation for ${editForm.owner}. Dataset re-mapped.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove allocation for "${name}"?`)) {
      const updated = allocations.filter((a) => a.id !== id);
      onSaveAllocations(updated);
      setFeedback(`Removed ${name} from allocations.`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.owner.trim() || !newForm.assignee.trim()) {
      setFeedback('Owner name and Assignee username cannot be empty.');
      return;
    }
    const newEntry: UserAllocation = {
      id: String(Date.now()),
      owner: newForm.owner.trim(),
      assignee: newForm.assignee.trim().toLowerCase(),
      hod: newForm.hod,
    };
    const updated = [...allocations, newEntry];
    onSaveAllocations(updated);
    setIsAddOpen(false);
    setNewForm({ owner: '', assignee: '', hod: 'Himanshu' });
    setFeedback(`Added ${newEntry.owner} (${newEntry.assignee}) mapped to HOD ${newEntry.hod}.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleQuickAddUnmapped = (unmappedName: string) => {
    setNewForm({
      owner: unmappedName,
      assignee: unmappedName.toLowerCase().replace(/\s+/g, ''),
      hod: 'Himanshu',
    });
    setIsAddOpen(true);
  };

  const handleResetDefaults = () => {
    if (confirm('Restore the 19 standard team members and allocations from Image 1?')) {
      onSaveAllocations(DEFAULT_USER_ALLOCATIONS);
      setFeedback('Restored default 19 user allocations.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleViewUserCases = (ownerName: string) => {
    onSelectUserFilter(ownerName);
    onNavigateToTab('tracker-2026');
  };

  // Group stats
  const hodCounts = AVAILABLE_HODS.reduce((acc, h) => {
    acc[h] = allocations.filter((a) => a.hod === h).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400">
                <Shield className="w-6 h-6" />
              </span>
              <div>
                <span className="text-xs font-semibold text-red-400 tracking-wider uppercase">
                  Admin & Governance
                </span>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  User Allocations & HOD Management
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Official mapping between <strong>Owner display names</strong>, <strong>Jira Assignee usernames</strong>,
              and their assigned <strong>Head of Department (HOD)</strong>. Any change immediately updates all 449 cases
              across all 2 KPIs and 3 Trackers.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E30613] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
            <button
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
              title="Reset allocations to original 19 users"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* HOD Team Distribution Pills */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold mr-1">HOD Teams:</span>
          {AVAILABLE_HODS.map((hod) => (
            <button
              key={hod}
              onClick={() => setSelectedHodFilter(selectedHodFilter === hod ? 'All' : hod)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all flex items-center gap-1.5 ${
                selectedHodFilter === hod
                  ? 'bg-red-600 text-white font-bold ring-2 ring-red-400/50'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              <span>{hod}</span>
              <span className="bg-black/30 px-1.5 py-0.2 rounded text-[10px]">
                {hodCounts[hod] || 0}
              </span>
            </button>
          ))}
          {selectedHodFilter !== 'All' && (
            <button
              onClick={() => setSelectedHodFilter('All')}
              className="text-xs text-red-400 hover:text-red-300 underline ml-2"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Unmapped Assignees Alert */}
      {unmapped.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Found {unmapped.length} Unallocated Assignees in Uploaded Dataset:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {unmapped.map((u) => (
              <span
                key={u.rawName}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-amber-900 font-mono text-[11px]"
              >
                <span><strong>{u.rawName}</strong> ({u.count} cases)</span>
                <button
                  onClick={() => handleQuickAddUnmapped(u.rawName)}
                  className="ml-1 text-[10px] font-bold text-red-700 hover:underline"
                >
                  + Allocate
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-600" />
                <span>Add New User Allocation</span>
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNew} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Owner Full Name (Display in KPIs &amp; Trackers)
                </label>
                <input
                  type="text"
                  required
                  value={newForm.owner}
                  onChange={(e) => setNewForm({ ...newForm, owner: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignee Username (Jira ID in Spreadsheet)
                </label>
                <input
                  type="text"
                  required
                  value={newForm.assignee}
                  onChange={(e) => setNewForm({ ...newForm, assignee: e.target.value })}
                  placeholder="e.g. jdoe or jdoe@etisalat.ae"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned HOD (Team Lead)
                </label>
                <select
                  value={newForm.hod}
                  onChange={(e) => setNewForm({ ...newForm, hod: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                >
                  {AVAILABLE_HODS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#E30613] hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Save User Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Owner, Jira username, or HOD..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Showing <strong>{filteredAllocations.length}</strong> of {allocations.length} Users</span>
            <span>·</span>
            <span>Active 2026 cases: <strong>{rows2026.length}</strong></span>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <th className="px-5 py-3">Owner (Display Name)</th>
                <th className="px-4 py-3 font-mono">Assignee (Jira Username)</th>
                <th className="px-4 py-3">HOD (Team Lead)</th>
                <th className="px-4 py-3 text-center">2026 Cases Assigned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAllocations.map((alloc) => {
                const isEditing = editingId === alloc.id;
                const stats = getUserCaseCounts(alloc);

                return (
                  <tr key={alloc.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Column 1: Owner */}
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.owner}
                          onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-red-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-600" />
                          <span>{alloc.owner}</span>
                        </div>
                      )}
                    </td>

                    {/* Column 2: Assignee */}
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.assignee}
                          onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-red-500 font-mono"
                        />
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {alloc.assignee}
                        </span>
                      )}
                    </td>

                    {/* Column 3: HOD */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.hod}
                          onChange={(e) => setEditForm({ ...editForm, hod: e.target.value })}
                          className="px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-red-500 bg-white"
                        >
                          {AVAILABLE_HODS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200">
                          {alloc.hod}
                        </span>
                      )}
                    </td>

                    {/* Column 4: 2026 Cases Assigned */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                          {stats.total2026} Cases
                        </span>
                        {stats.total2026 > 0 && (
                          <span className="text-[10px] text-emerald-700 font-medium font-mono">
                            ({stats.withinSla} in SLA)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 5: Actions */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleSaveEdit(alloc.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                          >
                            <Save className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {stats.total2026 > 0 && (
                            <button
                              onClick={() => handleViewUserCases(alloc.owner)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                              title={`View all ${stats.total2026} cases for ${alloc.owner} in 2026 Tracker`}
                            >
                              <span>View 2026 Cases</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(alloc)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Edit User Allocation"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(alloc.id, alloc.owner)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
