import { useMemo, useState } from "react";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import {
  inputCls,
  Field,
  StatusBadge,
  Modal,
  TableActions,
  PageHeader,
  EmptyState,
  TH,
  TD,
} from "../IOT/MasterConfig/_shared";
import {
  useGetMailTasksQuery,
  useGetMailRecipientsQuery,
  useAddMailRecipientMutation,
  useUpdateMailRecipientMutation,
  useDeleteMailRecipientMutation,
  useTestMailRecipientMutation,
} from "../../redux/api/mailManagementApi";

const SHIFT_TASKS = ["shift_production_report", "shift_downtime_report"];
const INIT = {
  name: "",
  email: "",
  department: "",
  designation: "",
  status: true,
  tasks: [],
};

const MailRecipients = () => {
  const { data: tasksData } = useGetMailTasksQuery();
  const { data: recipientsData } = useGetMailRecipientsQuery();
  const [addRecipient] = useAddMailRecipientMutation();
  const [updateRecipient] = useUpdateMailRecipientMutation();
  const [deleteRecipient] = useDeleteMailRecipientMutation();
  const [testMail, { isLoading: testing }] = useTestMailRecipientMutation();

  const tasks = useMemo(() => tasksData ?? [], [tasksData]);
  const recipients = useMemo(() => recipientsData ?? [], [recipientsData]);
  const taskName = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.key, t.name])),
    [tasks],
  );

  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [modal, setModal] = useState({ open: false, mode: "add", row: null });
  const [form, setForm] = useState(INIT);
  const [testModal, setTestModal] = useState({
    open: false,
    row: null,
    tasks: [],
    when: "",
  });

  // Active recipients per task — the small summary cards on top.
  const counts = useMemo(() => {
    const c = Object.fromEntries(tasks.map((t) => [t.key, 0]));
    recipients.forEach((r) => {
      if (r.status)
        r.tasks.forEach((k) => {
          if (k in c) c[k] += 1;
        });
    });
    return c;
  }, [tasks, recipients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        (!taskFilter || r.tasks.includes(taskFilter)) &&
        (!q ||
          (r.name || "").toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.department || "").toLowerCase().includes(q)),
    );
  }, [recipients, search, taskFilter]);

  const openAdd = () => {
    setForm(INIT);
    setModal({ open: true, mode: "add", row: null });
  };
  const openEdit = (row) => {
    setForm({
      ...INIT,
      ...row,
      department: row.department ?? "",
      designation: row.designation ?? "",
    });
    setModal({ open: true, mode: "edit", row });
  };
  const closeModal = () => setModal({ open: false, mode: "add", row: null });

  const sf = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const toggleTask = (key) =>
    setForm((f) => ({
      ...f,
      tasks: f.tasks.includes(key)
        ? f.tasks.filter((k) => k !== key)
        : [...f.tasks, key],
    }));

  const allTicked = tasks.length > 0 && form.tasks.length === tasks.length;
  const toggleAll = () =>
    setForm((f) => ({ ...f, tasks: allTicked ? [] : tasks.map((t) => t.key) }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!form.email.trim()) return toast.error("Email is required.");
    try {
      if (modal.mode === "add") {
        await addRecipient(form).unwrap();
        toast.success("Recipient added.");
      } else {
        await updateRecipient({ ...form, id: modal.row.id }).unwrap();
        toast.success("Recipient updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save recipient.");
    }
  };

  const openTest = (row) => {
    if (!row.tasks.length)
      return toast.error(
        "Tick at least one mail for this person first (Edit).",
      );
    setTestModal({ open: true, row, tasks: [...row.tasks], when: "" });
  };
  const closeTest = () =>
    setTestModal({ open: false, row: null, tasks: [], when: "" });
  const toggleTestTask = (key) =>
    setTestModal((m) => ({
      ...m,
      tasks: m.tasks.includes(key)
        ? m.tasks.filter((k) => k !== key)
        : [...m.tasks, key],
    }));

  const handleSendTest = async () => {
    if (testing) return;
    if (!testModal.tasks.length)
      return toast.error("Select at least one mail to test.");
    try {
      const results = await testMail({
        id: testModal.row.id,
        tasks: testModal.tasks,
        startDate: testModal.when || undefined,
      }).unwrap();
      results.forEach((r) =>
        r.ok
          ? toast.success(`${r.label}: ${r.message}`)
          : toast.error(`${r.label}: ${r.message}`),
      );
      if (results.every((r) => r.ok)) closeTest();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to send test mail.");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove ${row.email} from all mail lists?`)) return;
    try {
      await deleteRecipient(row.id).unwrap();
      toast.success("Recipient removed.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to remove recipient.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader
        title="Mail Recipients & Tasks"
        subtitle="Choose who receives each automatic email"
        icon={Mail}
        onAdd={openAdd}
        addLabel="Add Recipient"
        search={search}
        onSearch={setSearch}
      />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Task summary — click a card to filter the list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {tasks.map((t) => {
            const active = taskFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTaskFilter(active ? "" : t.key)}
                className={`text-left bg-white rounded-xl border p-3 shadow-sm transition-all ${
                  active
                    ? "border-blue-400 ring-2 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-[11px] font-bold text-slate-700 leading-tight">
                  {t.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  {t.description}
                </p>
                <p className="text-xs font-semibold text-blue-600 mt-2">
                  {counts[t.key] ?? 0} active recipient
                  {(counts[t.key] ?? 0) === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Department</TH>
                  <TH>Receives</TH>
                  <TH center>Status</TH>
                  <TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((r, idx) => (
                    <tr
                      key={r.id}
                      className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30"
                    >
                      <TD cls="text-slate-400">{idx + 1}</TD>
                      <TD cls="font-bold text-slate-800 whitespace-nowrap">
                        {r.name}
                      </TD>
                      <TD cls="text-blue-600 text-[11px]">{r.email}</TD>
                      <TD cls="text-slate-500 text-[11px]">
                        {[r.department, r.designation]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TD>
                      <TD>
                        {r.tasks.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.tasks.map((k) => (
                              <span
                                key={k}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {taskName[k] ?? k}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300">
                            No mails selected
                          </span>
                        )}
                      </TD>
                      <TD center>
                        <StatusBadge active={r.status} />
                      </TD>
                      <TD center>
                        <TableActions
                          onTest={() => openTest(r)}
                          onEdit={() => openEdit(r)}
                          onDelete={() => handleDelete(r)}
                        />
                      </TD>
                    </tr>
                  ))
                ) : (
                  <EmptyState colSpan={7} message="No recipients found." />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal
          title={modal.mode === "add" ? "Add Recipient" : "Edit Recipient"}
          onClose={closeModal}
          onSave={handleSave}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" required>
              <input
                value={form.name}
                onChange={sf("name")}
                placeholder="Full name"
                className={inputCls}
              />
            </Field>
            <Field label="Email ID" required>
              <input
                type="email"
                value={form.email}
                onChange={sf("email")}
                placeholder="email@company.com"
                className={inputCls}
              />
            </Field>
            <Field label="Department">
              <input
                value={form.department}
                onChange={sf("department")}
                className={inputCls}
              />
            </Field>
            <Field label="Designation">
              <input
                value={form.designation}
                onChange={sf("designation")}
                className={inputCls}
              />
            </Field>

            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Mails this person receives
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  {allTicked ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="space-y-2">
                {tasks.map((t) => (
                  <label
                    key={t.key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.tasks.includes(t.key)}
                      onChange={() => toggleTask(t.key)}
                      className="mt-0.5 w-4 h-4 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-700">
                        {t.name}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {t.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="col-span-2 flex gap-6 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={sf("status")}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-slate-700 font-medium">
                  Active{" "}
                  <span className="text-slate-400 font-normal">
                    (untick to pause all mails without deleting)
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Modal>
      )}
      {testModal.open && (
        <Modal
          title="Send Test Mail"
          onClose={closeTest}
          onSave={handleSendTest}
          saveLabel={testing ? "Sending…" : "Send Test"}
        >
          <p className="text-sm text-slate-600 mb-4">
            Sends a real copy of the selected mail(s) to{" "}
            <span className="font-semibold text-blue-600">
              {testModal.row.email}
            </span>{" "}
            only. Nobody else receives it.
          </p>
          <div className="space-y-2">
            {testModal.row.tasks.map((k) => (
              <label
                key={k}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={testModal.tasks.includes(k)}
                  onChange={() => toggleTestTask(k)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm font-semibold text-slate-700">
                  {taskName[k] ?? k}
                </span>
              </label>
            ))}
          </div>

          {testModal.tasks.some((k) => SHIFT_TASKS.includes(k)) && (
            <div className="mt-4">
              <Field label="Shift report for (optional)">
                <input
                  type="datetime-local"
                  value={testModal.when}
                  onChange={(e) =>
                    setTestModal((m) => ({ ...m, when: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <p className="text-[11px] text-slate-400 mt-1">
                Leave empty to use the latest shift that has data. Or pick any
                time inside a shift to test that shift.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default MailRecipients;
