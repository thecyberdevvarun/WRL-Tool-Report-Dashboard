import { useState } from "react";
import { Upload, FileText, CloudUpload, Layers, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { FieldLabel, inputCls, MONTHS, YEARS } from "./shared";

const validatePdf = (file) => {
  if (!file) return false;
  if (file.type !== "application/pdf") {
    toast.error("Please upload only PDF files");
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.error("File size must be less than 10 MB");
    return false;
  }
  return true;
};

// Upload form. Owns its own field state and validation; the actual API call
// (and everything that depends on the result — refetching the file list,
// switching tabs, opening the extracted-values confirm dialog) lives in the
// dashboard shell since those are cross-tab concerns. On a successful
// `onUpload`, this component clears its own fields.
const BISUploadTab = ({ uploading, onUpload }) => {
  const [modelName, setModelName] = useState("");
  const [testFrequency, setTestFrequency] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validatePdf(file)) setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!modelName.trim()) return toast.error("Model Name is required");
    if (!year.trim()) return toast.error("Year is required");
    if (!month.trim()) return toast.error("Month is required");
    if (!testFrequency.trim()) return toast.error("Test Frequency is required");
    if (!description.trim()) return toast.error("Description is required");
    if (!selectedFile) return toast.error("Please select a PDF file");

    const ok = await onUpload({
      modelName: modelName.trim(),
      year: year.trim(),
      month: month.trim(),
      testFrequency: testFrequency.trim(),
      description: description.trim(),
      file: selectedFile,
    });

    if (ok) {
      setModelName("");
      setYear("");
      setMonth("");
      setTestFrequency("");
      setDescription("");
      setSelectedFile(null);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 xl:grid-cols-5 gap-4">
      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 xl:col-span-3">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Model Details</p>
        </div>
        <div className="space-y-4">
          <div>
            <FieldLabel>Model Name *</FieldLabel>
            <input type="text" placeholder="e.g. ABC123456" value={modelName}
              onChange={(e) => setModelName(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Year *</FieldLabel>
              <select value={year} onChange={(e) => setYear(e.target.value)} className={inputCls}>
                <option value="">Select Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Month *</FieldLabel>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
                <option value="">Select Month</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel>Test Frequency *</FieldLabel>
            <div className="flex gap-2">
              {["Monthly", "Quarterly", "Yearly"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTestFrequency(f)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    testFrequency === f ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:border-blue-300 bg-slate-50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Description *</FieldLabel>
            <textarea placeholder="Briefly describe this test report…" value={description}
              onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col xl:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <CloudUpload className="w-3.5 h-3.5 text-blue-500" />
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Upload PDF</p>
        </div>
        <label
          htmlFor="file-upload"
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all min-h-[200px] ${
            selectedFile ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
          }`}
        >
          <input type="file" id="file-upload" accept=".pdf" onChange={handleFileChange} className="hidden" />
          {selectedFile ? (
            <div className="text-center p-4">
              <FileText className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-blue-700 break-all">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              <span className="mt-2 inline-block text-[11px] text-blue-600 underline">Change file</span>
            </div>
          ) : (
            <div className="text-center p-6">
              <CloudUpload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Click to select a PDF</p>
              <p className="text-[11px] text-slate-400 mt-1">Max size: 10 MB</p>
            </div>
          )}
        </label>
        {selectedFile && (
          <button type="button" onClick={() => setSelectedFile(null)}
            className="mt-2 text-[11px] text-red-500 hover:underline flex items-center gap-1 justify-center">
            <Trash2 className="w-3 h-3" /> Remove file
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={uploading || !selectedFile}
          className={`mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            uploading || !selectedFile ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
          }`}
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload Report"}
        </button>
      </div>
    </div>
  );
};

export default BISUploadTab;
