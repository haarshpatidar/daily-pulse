import { useEffect, useState } from "react";
import { useAutomation } from "../../store/useAutomation.js";
import { CheckIcon, SendIcon } from "../icons.jsx";

export default function TemplateEditor() {
  const template = useAutomation((s) => s.template);
  const saveTemplate = useAutomation((s) => s.saveTemplate);
  const sendTestEmail = useAutomation((s) => s.sendTestEmail);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
  }, [template]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await saveTemplate(subject, body);
      setMsg("Template saved");
    } catch (e) {
      setMsg(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testEmail) return;
    setTesting(true);
    setMsg(null);
    try {
      await sendTestEmail(testEmail);
      setMsg(`Test email sent to ${testEmail}`);
    } catch (e) {
      setMsg(`Failed: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Email template</h3>
        <span className="text-[12px] text-muted">
          Variables: {"{{name}} {{company}} {{role}} {{email}}"}
        </span>
      </div>

      <label className="block text-[13px] font-medium mb-1">Subject</label>
      <input
        className="drawer-input mb-3 w-full"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Application for {{role}} — Your Name"
      />

      <label className="block text-[13px] font-medium mb-1">Body</label>
      <textarea
        className="drawer-input w-full font-mono text-[13px] resize-none"
        rows={12}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button className="apply-btn" disabled={saving} onClick={save}>
          <CheckIcon />
          {saving ? "Saving…" : "Save template"}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <input
            className="drawer-input w-64"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button className="apply-btn-ghost" disabled={testing || !testEmail} onClick={sendTest}>
            <SendIcon width={16} height={16} />
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
      </div>
      {msg && <p className="mt-3 text-[13px] text-muted">{msg}</p>}
    </div>
  );
}
