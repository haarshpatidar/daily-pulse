import { useRef, useState } from "react";
import { useAutomation } from "../../store/useAutomation.js";
import { SheetIcon, FileIcon, UploadIcon, CheckIcon } from "../icons.jsx";

export default function UploadSection() {
  const resume = useAutomation((s) => s.resume);
  const uploadExcel = useAutomation((s) => s.uploadExcel);
  const uploadResume = useAutomation((s) => s.uploadResume);

  const [mode, setMode] = useState("append");
  const [excelMsg, setExcelMsg] = useState(null);
  const [resumeMsg, setResumeMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const excelRef = useRef(null);
  const resumeRef = useRef(null);

  async function handleExcel(file) {
    setBusy("excel");
    setExcelMsg(null);
    try {
      const json = await uploadExcel(file, mode);
      setExcelMsg(`Parsed ${json.parsed} rows, added/updated ${json.inserted}`);
    } catch (e) {
      setExcelMsg(e.message || "Upload failed");
    } finally {
      setBusy(null);
      if (excelRef.current) excelRef.current.value = "";
    }
  }

  async function handleResume(file) {
    setBusy("resume");
    setResumeMsg(null);
    try {
      await uploadResume(file);
      setResumeMsg("Resume saved");
    } catch (e) {
      setResumeMsg(e.message || "Upload failed");
    } finally {
      setBusy(null);
      if (resumeRef.current) resumeRef.current.value = "";
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-ok">
            <SheetIcon width={20} height={20} />
          </span>
          <h3 className="font-semibold">Recipients (Excel)</h3>
        </div>
        <p className="text-[13px] text-muted mb-3">
          Upload an .xlsx / .csv file with columns: <strong>email</strong>, name, company, role.
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-3 text-[13px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
            Append / update
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
            Replace pending
          </label>
        </div>
        <label className={`apply-btn cursor-pointer ${busy ? "opacity-50" : ""}`}>
          <UploadIcon />
          {busy === "excel" ? "Uploading…" : "Upload Excel"}
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => e.target.files?.[0] && handleExcel(e.target.files[0])}
          />
        </label>
        {excelMsg && <p className="mt-3 text-[13px]">{excelMsg}</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-error">
            <FileIcon width={20} height={20} />
          </span>
          <h3 className="font-semibold">Resume</h3>
        </div>
        <p className="text-[13px] text-muted mb-3">Attached automatically to every outgoing email.</p>
        {resume.exists ? (
          <div className="flex items-center gap-2 text-[13px] text-ok mb-3">
            <CheckIcon />
            <span className="truncate">{resume.name}</span>
            <span className="text-muted">({Math.round((resume.size || 0) / 1024)} KB)</span>
          </div>
        ) : (
          <p className="text-[13px] text-warn mb-3">No resume uploaded yet.</p>
        )}
        <label className={`apply-btn cursor-pointer ${busy ? "opacity-50" : ""}`}>
          <UploadIcon />
          {busy === "resume" ? "Uploading…" : resume.exists ? "Replace resume" : "Upload resume"}
          <input
            ref={resumeRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => e.target.files?.[0] && handleResume(e.target.files[0])}
          />
        </label>
        {resumeMsg && <p className="mt-3 text-[13px]">{resumeMsg}</p>}
      </div>
    </div>
  );
}
