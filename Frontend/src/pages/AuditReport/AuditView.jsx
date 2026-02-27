import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaStickyNote,
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaEdit,
  FaCheck,
  FaBan,
  FaHistory,
  FaBarcode,
  FaUserCheck,
  FaUserShield,
  FaImage,
  FaTimes,
  FaSearchPlus,
  FaDownload,
  FaFilePdf,
  FaFileExcel,
} from "react-icons/fa";
import { MdFormatListNumbered, MdUpdate, MdDateRange } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../hooks/useAuditData";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";
import {
  formatDateForDisplay,
  formatDateTimeForDisplay,
} from "../../utils/dateUtils.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const AuditView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    getAuditById,
    approveAudit,
    rejectAudit,
    getAuditHistory,
    loading,
    error,
  } = useAuditData();

  const [audit, setAudit] = useState(null);
  const [template, setTemplate] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState("approve");
  const [approverName, setApproverName] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Load audit data
  useEffect(() => {
    const loadAudit = async () => {
      if (id) {
        setInitialLoading(true);
        try {
          const auditData = await getAuditById(id);
          if (auditData) {
            setAudit(auditData);
            setTemplate({
              columns: auditData.columns || [],
              infoFields: auditData.infoFields || [],
              headerConfig: auditData.headerConfig || {},
            });
          }
        } catch (err) {
          toast.error(`Failed to load audit: ${err.message}`);
          navigate("/auditreport/audits");
        } finally {
          setInitialLoading(false);
        }
      }
    };
    loadAudit();
  }, [id, getAuditById, navigate]);

  // Load audit history
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await getAuditHistory(id);
      setAuditHistory(history || []);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error(`Failed to load audit history: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open approval modal
  const openApprovalModal = (action) => {
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  // Handle approval/rejection
  const handleApproval = async () => {
    if (!approverName.trim()) {
      toast.error("Please enter approver name");
      return;
    }
    if (approvalAction === "reject" && !approvalComments.trim()) {
      toast.error("Please enter rejection reason");
      return;
    }

    setActionLoading(true);
    try {
      let updatedAudit;
      const approvalData = {
        approverName: approverName,
        comments: approvalComments,
      };

      if (approvalAction === "approve") {
        updatedAudit = await approveAudit(id, approvalData);
      } else {
        updatedAudit = await rejectAudit(id, approvalData);
      }

      setAudit(updatedAudit);
      setShowApprovalModal(false);
      setApproverName("");
      setApprovalComments("");
      toast.success(
        `Audit ${approvalAction === "approve" ? "approved" : "rejected"} successfully!`,
      );
    } catch (err) {
      toast.error(`Failed to ${approvalAction} audit: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Get field icon
  const getFieldIcon = useCallback((fieldId) => {
    switch (fieldId) {
      case "modelName":
        return <BiSolidFactory className="text-lg text-indigo-600" />;
      case "serialNo":
      case "serial":
        return <FaBarcode className="text-lg text-purple-600" />;
      case "date":
        return <FaCalendarAlt className="text-lg text-red-500" />;
      case "shift":
        return <FaClock className="text-lg text-orange-500" />;
      case "eid":
        return <FaIdBadge className="text-lg text-teal-600" />;
      default:
        return <FaClipboardCheck className="text-lg text-gray-500" />;
    }
  }, []);

  // Get status badge for checkpoints
  const getStatusBadge = useCallback((status) => {
    switch (status) {
      case "pass":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <FaCheckCircle /> Pass
          </span>
        );
      case "fail":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <FaTimesCircle /> Fail
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <FaExclamationTriangle /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            Pending
          </span>
        );
    }
  }, []);

  // Get audit status badge
  const getAuditStatusBadge = useCallback((status) => {
    switch (status) {
      case "draft":
        return (
          <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
            Draft
          </span>
        );
      case "submitted":
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            Submitted
          </span>
        );
      case "approved":
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            Rejected
          </span>
        );
      default:
        return null;
    }
  }, []);

  // Calculate total checkpoints in a section
  const getSectionTotalCheckpoints = useCallback((section) => {
    if (section.stages && Array.isArray(section.stages)) {
      return section.stages.reduce(
        (total, stage) => total + (stage.checkPoints?.length || 0),
        0,
      );
    }
    return section.checkPoints?.length || 0;
  }, []);

  // Calculate summary
  const getSummary = useCallback(() => {
    if (audit?.summary) {
      let summary = audit.summary;
      if (typeof summary === "string") {
        try {
          summary = JSON.parse(summary);
        } catch (e) {
          summary = null;
        }
      }
      if (summary && typeof summary === "object") {
        return {
          pass: summary.pass ?? summary.Pass ?? 0,
          fail: summary.fail ?? summary.Fail ?? 0,
          warning: summary.warning ?? summary.Warning ?? 0,
          pending: summary.pending ?? summary.Pending ?? 0,
          total: summary.total ?? summary.Total ?? 0,
        };
      }
    }

    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0;

    let sections = audit?.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch (e) {
        sections = [];
      }
    }

    if (!sections || !Array.isArray(sections)) {
      return { pass: 0, fail: 0, warning: 0, pending: 0, total: 0 };
    }

    sections.forEach((section) => {
      if (!section) return;
      if (section.stages && Array.isArray(section.stages)) {
        section.stages.forEach((stage) => {
          if (stage?.checkPoints && Array.isArray(stage.checkPoints)) {
            stage.checkPoints.forEach((cp) => {
              if (!cp) return;
              const status = (cp.status || "pending").toLowerCase();
              if (status === "pass") pass++;
              else if (status === "fail") fail++;
              else if (status === "warning") warning++;
              else pending++;
            });
          }
        });
      } else if (section.checkPoints && Array.isArray(section.checkPoints)) {
        section.checkPoints.forEach((cp) => {
          if (!cp) return;
          const status = (cp.status || "pending").toLowerCase();
          if (status === "pass") pass++;
          else if (status === "fail") fail++;
          else if (status === "warning") warning++;
          else pending++;
        });
      }
    });

    return {
      pass,
      fail,
      warning,
      pending,
      total: pass + fail + warning + pending,
    };
  }, [audit]);

  // Get info field value with fallback
  const getInfoFieldValue = useCallback(
    (fieldId) => {
      if (!audit?.infoData) return "-";
      if (audit.infoData[fieldId]) return audit.infoData[fieldId];

      const alternates = {
        serialNo: ["serial", "serialNumber", "serialNo"],
        modelName: ["model", "modelName", "modelVariant"],
        date: ["auditDate", "date", "reportDate"],
        shift: ["shift", "shiftName"],
        eid: ["eid", "employeeId", "auditorId"],
      };

      if (alternates[fieldId]) {
        for (const alt of alternates[fieldId]) {
          if (audit.infoData[alt]) return audit.infoData[alt];
        }
      }
      return "-";
    },
    [audit],
  );

  // Render image in view mode
  const renderImageViewCell = useCallback((column, checkpoint) => {
    const imageFilename = checkpoint[column.id];

    if (imageFilename && typeof imageFilename === "string") {
      return (
        <td key={column.id} className="px-3 py-2 border-r border-gray-200">
          <div className="flex justify-center">
            <div className="relative group cursor-pointer">
              <img
                src={`${baseURL}audit-report/images/${imageFilename}`}
                alt="Checkpoint image"
                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all hover:shadow-md"
                onClick={() =>
                  setImagePreview({
                    fileName: imageFilename,
                    data: `${baseURL}audit-report/images/${imageFilename}`,
                  })
                }
                onError={(e) => {
                  e.target.src =
                    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";
                  e.target.classList.add("opacity-50");
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <FaSearchPlus className="text-white" size={16} />
              </div>
            </div>
          </div>
        </td>
      );
    }

    return (
      <td key={column.id} className="px-3 py-2 border-r border-gray-200">
        <div className="flex justify-center">
          <span className="text-xs text-gray-400 italic flex items-center gap-1">
            <FaImage className="text-gray-300" size={12} />
            No image
          </span>
        </div>
      </td>
    );
  }, []);

  // ==================== EXPORT HELPERS ====================

  const getExportTableData = useCallback(() => {
    if (!audit || !template) return { headers: [], rows: [] };

    const visibleCols = template.columns?.filter((col) => col.visible) || [];
    const headers = visibleCols
      .filter((col) => col.type !== "image")
      .map((col) => col.name);

    const rows = [];

    let sections = audit.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch {
        sections = [];
      }
    }

    if (!sections || !Array.isArray(sections)) return { headers, rows };

    sections.forEach((section) => {
      if (section.stages && Array.isArray(section.stages)) {
        section.stages.forEach((stage) => {
          stage.checkPoints?.forEach((checkpoint) => {
            const row = [];
            visibleCols
              .filter((col) => col.type !== "image")
              .forEach((col) => {
                if (col.id === "section") {
                  row.push(section.sectionName || "-");
                } else if (col.id === "stage") {
                  row.push(stage.stageName || "-");
                } else if (col.id === "status") {
                  row.push(
                    (checkpoint.status || "pending").charAt(0).toUpperCase() +
                      (checkpoint.status || "pending").slice(1),
                  );
                } else {
                  row.push(checkpoint[col.id] || "-");
                }
              });
            rows.push(row);
          });
        });
      } else if (section.checkPoints && Array.isArray(section.checkPoints)) {
        section.checkPoints.forEach((checkpoint) => {
          const row = [];
          visibleCols
            .filter((col) => col.type !== "image")
            .forEach((col) => {
              if (col.id === "section") {
                row.push(section.sectionName || "-");
              } else if (col.id === "status") {
                row.push(
                  (checkpoint.status || "pending").charAt(0).toUpperCase() +
                    (checkpoint.status || "pending").slice(1),
                );
              } else {
                row.push(checkpoint[col.id] || "-");
              }
            });
          rows.push(row);
        });
      }
    });

    return { headers, rows };
  }, [audit, template]);

  const getInfoDataForExport = useCallback(() => {
    if (!audit || !template) return [];
    const infoRows = [];
    template.infoFields
      ?.filter((f) => f.visible)
      .forEach((field) => {
        let value = getInfoFieldValue(field.id);
        if (field.id === "date") value = formatDateForDisplay(value);
        infoRows.push([field.name, value]);
      });
    return infoRows;
  }, [audit, template, getInfoFieldValue]);

  const getSummaryForExport = useCallback(() => {
    const s = getSummary();
    return [
      ["Total Checks", s.total],
      ["Passed", s.pass],
      ["Warnings", s.warning],
      ["Failed", s.fail],
      ["Pending", s.pending],
      [
        "Pass Rate",
        s.total > 0 ? Math.round((s.pass / s.total) * 100) + "%" : "0%",
      ],
    ];
  }, [getSummary]);

  // ==================== EXPORT AS PDF ====================

  const handleExportPDF = useCallback(() => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 15;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text(audit.reportName || "Audit Report", pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 8;

      // Template name
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Template: ${audit.templateName || "-"}`, pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 5;

      // Status
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Status: ${(audit.status || "").charAt(0).toUpperCase() + (audit.status || "").slice(1)}`,
        pageWidth / 2,
        yPos,
        { align: "center" },
      );
      yPos += 5;

      // Audit Code
      if (audit.auditCode) {
        doc.text(`Audit Code: ${audit.auditCode}`, pageWidth / 2, yPos, {
          align: "center",
        });
        yPos += 5;
      }

      // Header info
      const headerItems = [];
      if (template?.headerConfig?.showFormatNo !== false && audit.formatNo) {
        headerItems.push(`Format No: ${audit.formatNo}`);
      }
      if (template?.headerConfig?.showRevNo !== false && audit.revNo) {
        headerItems.push(`Rev No: ${audit.revNo}`);
      }
      if (template?.headerConfig?.showRevDate !== false && audit.revDate) {
        headerItems.push(`Rev Date: ${formatDateForDisplay(audit.revDate)}`);
      }
      if (headerItems.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(headerItems.join("  |  "), pageWidth / 2, yPos, {
          align: "center",
        });
        yPos += 8;
      } else {
        yPos += 3;
      }

      // Info Section
      const infoData = getInfoDataForExport();
      if (infoData.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Audit Information", 14, yPos);
        yPos += 2;

        autoTable(doc, {
          startY: yPos,
          head: [["Field", "Value"]],
          body: infoData,
          theme: "grid",
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontSize: 9,
            fontStyle: "bold",
          },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // Notes
      if (audit.notes) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Notes", 14, yPos);
        yPos += 5;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(audit.notes, pageWidth - 28);
        doc.text(splitNotes, 14, yPos);
        yPos += splitNotes.length * 5 + 8;
      }

      // Checkpoints Table
      const { headers, rows } = getExportTableData();
      if (headers.length > 0 && rows.length > 0) {
        if (yPos > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          yPos = 15;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Checkpoint Details", 14, yPos);
        yPos += 2;

        autoTable(doc, {
          startY: yPos,
          head: [headers],
          body: rows,
          theme: "grid",
          headStyles: {
            fillColor: [55, 65, 81],
            textColor: 255,
            fontSize: 8,
            fontStyle: "bold",
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            const statusColIndex = headers.indexOf("Status");
            if (
              data.section === "body" &&
              data.column.index === statusColIndex
            ) {
              const val = (data.cell.raw || "").toLowerCase();
              if (val === "pass") {
                data.cell.styles.textColor = [21, 128, 61];
                data.cell.styles.fillColor = [220, 252, 231];
              } else if (val === "fail") {
                data.cell.styles.textColor = [185, 28, 28];
                data.cell.styles.fillColor = [254, 226, 226];
              } else if (val === "warning") {
                data.cell.styles.textColor = [161, 98, 7];
                data.cell.styles.fillColor = [254, 249, 195];
              }
            }
          },
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // Summary
      const summaryData = getSummaryForExport();
      if (yPos > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Audit Summary", 14, yPos);
      yPos += 2;

      autoTable(doc, {
        startY: yPos,
        head: [["Metric", "Value"]],
        body: summaryData,
        theme: "grid",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontSize: 9,
          fontStyle: "bold",
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
        margin: { left: 14, right: 14 },
        tableWidth: 150,
      });
      yPos = doc.lastAutoTable.finalY + 8;

      // Signatures
      if (yPos > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPos = 15;
      }

      const sigs = audit.signatures || {};

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Signatures", 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Auditor:", 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(sigs.auditor?.name || audit.createdBy || "-", 60, yPos);
      yPos += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Date: ${
          sigs.auditor?.date
            ? formatDateForDisplay(sigs.auditor.date)
            : audit.createdAt
              ? formatDateForDisplay(audit.createdAt)
              : "-"
        }`,
        60,
        yPos,
      );
      yPos += 8;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Approved By:", 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(audit.approvedBy || sigs.approver?.name || "-", 60, yPos);
      yPos += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Date: ${
          audit.approvedAt
            ? formatDateForDisplay(audit.approvedAt)
            : sigs.approver?.date
              ? formatDateForDisplay(sigs.approver.date)
              : "-"
        }`,
        60,
        yPos,
      );

      // Footer on each page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Generated on ${formatDateForDisplay(new Date().toISOString())} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" },
        );
        doc.text(
          "Confidential - Internal Use Only",
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 4,
          { align: "center" },
        );
      }

      const fileName = `${audit.reportName || "Audit_Report"}_${audit.auditCode || id}.pdf`;
      doc.save(fileName.replace(/\s+/g, "_"));
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF. Please try again.");
    }
  }, [
    audit,
    template,
    id,
    getExportTableData,
    getInfoDataForExport,
    getSummaryForExport,
  ]);

  // ==================== EXPORT AS EXCEL ====================

  const handleExportExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Audit Info
      const infoSheetData = [
        ["Audit Report"],
        [""],
        ["Report Name", audit.reportName || "-"],
        ["Template", audit.templateName || "-"],
        [
          "Status",
          (audit.status || "").charAt(0).toUpperCase() +
            (audit.status || "").slice(1),
        ],
        ["Audit Code", audit.auditCode || "-"],
      ];

      if (template?.headerConfig?.showFormatNo !== false) {
        infoSheetData.push(["Format No", audit.formatNo || "-"]);
      }
      if (template?.headerConfig?.showRevNo !== false) {
        infoSheetData.push(["Rev No", audit.revNo || "-"]);
      }
      if (template?.headerConfig?.showRevDate !== false) {
        infoSheetData.push(["Rev Date", formatDateForDisplay(audit.revDate)]);
      }

      infoSheetData.push([""]);
      infoSheetData.push(["--- Audit Information ---"]);

      const infoData = getInfoDataForExport();
      infoData.forEach((row) => infoSheetData.push(row));

      infoSheetData.push([""]);
      infoSheetData.push(["Notes", audit.notes || "No notes added."]);

      infoSheetData.push([""]);
      infoSheetData.push(["--- Signatures ---"]);
      const sigs = audit.signatures || {};
      infoSheetData.push([
        "Auditor",
        sigs.auditor?.name || audit.createdBy || "-",
      ]);
      infoSheetData.push([
        "Auditor Date",
        sigs.auditor?.date
          ? formatDateForDisplay(sigs.auditor.date)
          : audit.createdAt
            ? formatDateForDisplay(audit.createdAt)
            : "-",
      ]);
      infoSheetData.push([
        "Approved By",
        audit.approvedBy || sigs.approver?.name || "-",
      ]);
      infoSheetData.push([
        "Approval Date",
        audit.approvedAt
          ? formatDateForDisplay(audit.approvedAt)
          : sigs.approver?.date
            ? formatDateForDisplay(sigs.approver.date)
            : "-",
      ]);
      if (audit.approvalComments) {
        infoSheetData.push(["Approval Comments", audit.approvalComments]);
      }

      const infoSheet = XLSX.utils.aoa_to_sheet(infoSheetData);
      infoSheet["!cols"] = [{ wch: 20 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoSheet, "Audit Info");

      // Sheet 2: Checkpoints
      const { headers, rows } = getExportTableData();
      if (headers.length > 0) {
        const checkpointData = [headers, ...rows];
        const checkpointSheet = XLSX.utils.aoa_to_sheet(checkpointData);
        checkpointSheet["!cols"] = headers.map((h) => ({
          wch: Math.max(h.length + 5, 15),
        }));
        XLSX.utils.book_append_sheet(wb, checkpointSheet, "Checkpoints");
      }

      // Sheet 3: Summary
      const summarySheetData = [["Audit Summary"], [""], ["Metric", "Value"]];
      const summaryData = getSummaryForExport();
      summaryData.forEach((row) => summarySheetData.push(row));
      const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
      summarySheet["!cols"] = [{ wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      // Sheet 4: Metadata
      const metadataSheetData = [
        ["Audit Metadata"],
        [""],
        ["Audit ID", audit.id || "-"],
        ["Audit Code", audit.auditCode || "-"],
        ["Template ID", audit.templateId || "-"],
        ["Created By", audit.createdBy || "-"],
        ["Created At", formatDateTimeForDisplay(audit.createdAt)],
        ["Last Updated", formatDateTimeForDisplay(audit.updatedAt)],
      ];
      if (audit.submittedBy) {
        metadataSheetData.push(["Submitted By", audit.submittedBy]);
      }
      if (audit.submittedAt) {
        metadataSheetData.push([
          "Submitted At",
          formatDateTimeForDisplay(audit.submittedAt),
        ]);
      }
      metadataSheetData.push([""]);
      metadataSheetData.push(["Generated On", new Date().toLocaleString()]);

      const metadataSheet = XLSX.utils.aoa_to_sheet(metadataSheetData);
      metadataSheet["!cols"] = [{ wch: 20 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, metadataSheet, "Metadata");

      const fileName = `${audit.reportName || "Audit_Report"}_${audit.auditCode || id}.xlsx`;
      XLSX.writeFile(wb, fileName.replace(/\s+/g, "_"));
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel. Please try again.");
    }
  }, [
    audit,
    template,
    id,
    getExportTableData,
    getInfoDataForExport,
    getSummaryForExport,
  ]);

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading audit...</p>
        </div>
      </div>
    );
  }

  // Audit not found
  if (!audit) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Audit Not Found
          </h2>
          <button
            onClick={() => navigate("/auditreport/audits")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Audits
          </button>
        </div>
      </div>
    );
  }

  const summary = getSummary();
  const visibleColumns = template?.columns?.filter((col) => col.visible) || [];
  const signatures = audit.signatures || {};

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="mx-auto">
        {/* ==================== Image Preview Modal ==================== */}
        {imagePreview && (
          <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4"
            onClick={() => setImagePreview(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 bg-gray-800 text-white">
                <div className="flex items-center gap-2">
                  <FaImage />
                  <span className="font-medium text-sm">
                    {imagePreview.fileName || imagePreview.name || "Image"}
                  </span>
                </div>
                <button
                  onClick={() => setImagePreview(null)}
                  className="p-1 hover:bg-gray-700 rounded transition"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="p-4 flex items-center justify-center bg-gray-100">
                <img
                  src={
                    imagePreview.data ||
                    `${baseURL}audit-report/images/${imagePreview.fileName}`
                  }
                  alt={imagePreview.fileName || imagePreview.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={(e) => {
                    e.target.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+";
                  }}
                />
              </div>

              <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {imagePreview.uploadedAt
                    ? `Uploaded: ${new Date(imagePreview.uploadedAt).toLocaleString()}`
                    : "Checkpoint Image"}
                </span>

                <a
                  href={`${baseURL}audit-report/images/${imagePreview.fileName || imagePreview.name}/download`}
                  download
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  <FaDownload size={12} /> Download
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-gray-100/90 backdrop-blur border-b border-gray-200 shadow-sm p-4">
          <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/auditreport/audits")}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
              >
                <FaArrowLeft /> Back
              </button>
              <h1 className="text-xl font-bold text-gray-800">View Audit</h1>
              {getAuditStatusBadge(audit.status)}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  <FaDownload /> Export
                  <svg
                    className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
                      <button
                        onClick={() => {
                          handleExportPDF();
                          setShowExportMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        <FaFilePdf className="text-red-600" />
                        Export as PDF
                      </button>
                      <hr className="border-gray-100" />
                      <button
                        onClick={() => {
                          handleExportExcel();
                          setShowExportMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                      >
                        <FaFileExcel className="text-green-600" />
                        Export as Excel
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
              >
                <FaHistory /> History
              </button>
              {audit.status !== "approved" && (
                <button
                  onClick={() => navigate(`/auditreport/audits/${id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  <FaEdit /> Edit
                </button>
              )}
              {audit.status === "submitted" && (
                <>
                  <button
                    onClick={() => openApprovalModal("approve")}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    <FaCheck /> Approve
                  </button>
                  <button
                    onClick={() => openApprovalModal("reject")}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    <FaBan /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Approval Info Banner */}
        {(audit.status === "approved" || audit.status === "rejected") &&
          audit.approvedBy && (
            <div
              className={`my-4 p-4 rounded-lg ${
                audit.status === "approved"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {audit.status === "approved" ? (
                  <FaCheckCircle className="text-green-600" />
                ) : (
                  <FaTimesCircle className="text-red-600" />
                )}
                <span
                  className={`font-medium ${
                    audit.status === "approved"
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {audit.status === "approved" ? "Approved" : "Rejected"} by{" "}
                  {audit.approvedBy}
                </span>
                {audit.approvedAt && (
                  <span className="text-gray-500 text-sm">
                    on {formatDateTimeForDisplay(audit.approvedAt)}
                  </span>
                )}
              </div>
              {audit.approvalComments && (
                <p className="mt-2 text-gray-600 text-sm pl-6">
                  <strong>Comments:</strong> {audit.approvalComments}
                </p>
              )}
            </div>
          )}

        {/* Main Report Container */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border-2 border-gray-300">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-gray-300">
            <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <HiClipboardDocumentCheck className="text-4xl text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {audit.reportName || "Audit Report"}
                </h1>
                <p className="text-blue-200 text-sm mt-2">
                  Template: {audit.templateName}
                </p>
                {audit.auditCode && (
                  <p className="text-blue-200 text-xs mt-1">
                    Code: {audit.auditCode}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-gray-50 divide-y divide-gray-300">
              {template?.headerConfig?.showFormatNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdFormatListNumbered className="text-xl text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Format No
                    </span>
                    <span className="font-semibold text-gray-800">
                      {audit.formatNo || "-"}
                    </span>
                  </div>
                </div>
              )}
              {template?.headerConfig?.showRevNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdUpdate className="text-xl text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">Rev. No</span>
                    <span className="font-semibold text-gray-800">
                      {audit.revNo || "-"}
                    </span>
                  </div>
                </div>
              )}
              {template?.headerConfig?.showRevDate !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdDateRange className="text-xl text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Rev. Date
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formatDateForDisplay(audit.revDate)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b-2 border-gray-300 bg-gray-50">
            {template?.infoFields
              ?.filter((field) => field.visible)
              .map((field, index, arr) => (
                <div
                  key={field.id}
                  className={`p-4 ${
                    index < arr.length - 1 ? "border-r border-gray-300" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getFieldIcon(field.id)}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {field.name}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-800 block">
                    {field.id === "date"
                      ? formatDateForDisplay(getInfoFieldValue(field.id))
                      : getInfoFieldValue(field.id)}
                  </span>
                  {field.id === "modelName" && audit.infoData?.modelCode && (
                    <span className="text-xs text-red-600 block mt-1">
                      Code: {audit.infoData.modelCode}
                    </span>
                  )}
                </div>
              ))}
          </div>

          {/* Additional Info Data */}
          {audit.infoData && Object.keys(audit.infoData).length > 0 && (
            <div className="p-4 border-b-2 border-gray-300 bg-blue-50">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                Additional Information:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {Object.entries(audit.infoData).map(([key, value]) => {
                  const templateFieldIds =
                    template?.infoFields?.map((f) => f.id) || [];
                  if (templateFieldIds.includes(key)) return null;
                  if (!value) return null;
                  return (
                    <div key={key} className="bg-white p-2 rounded border">
                      <span className="text-xs text-gray-500 uppercase block">
                        {key.replace(/([A-Z])/g, " \$1").trim()}
                      </span>
                      <span className="font-medium text-gray-800">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="p-4 border-b-2 border-gray-300 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <FaStickyNote className="text-lg text-yellow-600" />
              <span className="font-semibold text-gray-700">Notes:</span>
            </div>
            <p className="text-gray-700 leading-relaxed pl-6">
              {audit.notes || "No notes added."}
            </p>
          </div>

          {/* ==================== Main Table Section ==================== */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-3 text-left font-semibold border-r border-gray-600 text-sm ${column.width || ""} ${
                        column.type === "image" ? "bg-gray-600" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {column.type === "image" && (
                          <FaImage size={12} className="text-pink-300" />
                        )}
                        {column.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.sections?.map((section) => {
                  const hasStages =
                    section.stages && Array.isArray(section.stages);
                  const sectionTotalRows = getSectionTotalCheckpoints(section);
                  let sectionRowRendered = false;

                  if (hasStages) {
                    return section.stages.map((stage) => {
                      let stageRowRendered = false;

                      return stage.checkPoints?.map(
                        (checkpoint, checkpointIndex) => {
                          const showSectionCell =
                            !sectionRowRendered && checkpointIndex === 0;
                          const showStageCell =
                            !stageRowRendered && checkpointIndex === 0;

                          if (
                            showSectionCell &&
                            section.stages.indexOf(stage) === 0
                          ) {
                            sectionRowRendered = true;
                          }
                          if (showStageCell) stageRowRendered = true;

                          return (
                            <tr
                              key={`${section.id}-${stage.id}-${checkpoint.id}-${checkpointIndex}`}
                              className={`border-b border-gray-200 ${
                                checkpoint.status === "pass"
                                  ? "bg-green-50"
                                  : checkpoint.status === "fail"
                                    ? "bg-red-50"
                                    : checkpoint.status === "warning"
                                      ? "bg-yellow-50"
                                      : ""
                              }`}
                            >
                              {visibleColumns.map((column) => {
                                if (column.id === "section") {
                                  if (
                                    showSectionCell &&
                                    section.stages.indexOf(stage) === 0
                                  ) {
                                    return (
                                      <td
                                        key={column.id}
                                        className="px-3 py-2 font-bold bg-gray-100 border-r border-gray-300 text-center align-middle"
                                        rowSpan={sectionTotalRows}
                                      >
                                        <span className="text-red-700 text-sm font-semibold">
                                          {section.sectionName || "-"}
                                        </span>
                                      </td>
                                    );
                                  }
                                  return null;
                                }

                                if (column.id === "stage") {
                                  if (showStageCell) {
                                    return (
                                      <td
                                        key={column.id}
                                        className="px-3 py-2 font-bold bg-indigo-50 border-r border-gray-300 text-center align-middle"
                                        rowSpan={stage.checkPoints?.length || 1}
                                      >
                                        <span className="text-indigo-700 text-sm font-semibold">
                                          {stage.stageName || "-"}
                                        </span>
                                      </td>
                                    );
                                  }
                                  return null;
                                }

                                if (column.type === "image") {
                                  return renderImageViewCell(
                                    column,
                                    checkpoint,
                                  );
                                }

                                if (column.id === "status") {
                                  return (
                                    <td
                                      key={column.id}
                                      className="px-3 py-2 border-r border-gray-200"
                                    >
                                      {getStatusBadge(checkpoint.status)}
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 border-r border-gray-200"
                                  >
                                    <span className="text-gray-700 text-sm">
                                      {checkpoint[column.id] || "-"}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        },
                      );
                    });
                  } else {
                    return section.checkPoints?.map(
                      (checkpoint, checkpointIndex) => (
                        <tr
                          key={`${section.id}-${checkpoint.id}-${checkpointIndex}`}
                          className={`border-b border-gray-200 ${
                            checkpoint.status === "pass"
                              ? "bg-green-50"
                              : checkpoint.status === "fail"
                                ? "bg-red-50"
                                : checkpoint.status === "warning"
                                  ? "bg-yellow-50"
                                  : ""
                          }`}
                        >
                          {visibleColumns.map((column) => {
                            if (column.id === "section") {
                              if (checkpointIndex === 0) {
                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 font-bold bg-gray-100 border-r border-gray-300 align-middle text-center"
                                    rowSpan={section.checkPoints?.length || 1}
                                  >
                                    <span className="text-gray-700 text-sm">
                                      {section.sectionName || "-"}
                                    </span>
                                  </td>
                                );
                              }
                              return null;
                            }

                            if (column.type === "image") {
                              return renderImageViewCell(column, checkpoint);
                            }

                            if (column.id === "status") {
                              return (
                                <td
                                  key={column.id}
                                  className="px-3 py-2 border-r border-gray-200"
                                >
                                  {getStatusBadge(checkpoint.status)}
                                </td>
                              );
                            }

                            return (
                              <td
                                key={column.id}
                                className="px-3 py-2 border-r border-gray-200"
                              >
                                <span className="text-gray-700 text-sm">
                                  {checkpoint[column.id] || "-"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ),
                    );
                  }
                })}

                {(!audit.sections || audit.sections.length === 0) && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No checkpoint data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="p-4 bg-gray-100 border-t-2 border-gray-300">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FaClipboardCheck className="text-blue-600" />
              Audit Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
                <div className="text-2xl font-bold text-gray-700">
                  {summary.total}
                </div>
                <span className="text-xs text-gray-500">Total Checks</span>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center shadow-sm border border-green-200">
                <div className="flex items-center justify-center gap-1 text-green-700 font-bold text-2xl">
                  <FaCheckCircle className="text-lg" />
                  {summary.pass}
                </div>
                <span className="text-xs text-green-600">Passed</span>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center shadow-sm border border-yellow-200">
                <div className="flex items-center justify-center gap-1 text-yellow-700 font-bold text-2xl">
                  <FaExclamationTriangle className="text-lg" />
                  {summary.warning}
                </div>
                <span className="text-xs text-yellow-600">Warnings</span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-200">
                <div className="flex items-center justify-center gap-1 text-red-700 font-bold text-2xl">
                  <FaTimesCircle className="text-lg" />
                  {summary.fail}
                </div>
                <span className="text-xs text-red-600">Failed</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-gray-500">
                  {summary.pending}
                </div>
                <span className="text-xs text-gray-500">Pending</span>
              </div>
            </div>

            {/* Pass Rate */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Pass Rate</span>
                <span className="font-medium text-gray-800">
                  {summary.total > 0
                    ? Math.round((summary.pass / summary.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${
                      summary.total > 0
                        ? (summary.pass / summary.total) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-t-2 border-gray-300">
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <FaUserCheck className="text-xl text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Auditor Signature
                </span>
              </div>
              <div className="text-center">
                <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4 min-h-[40px] flex items-end justify-center">
                  <span className="text-gray-800 font-medium">
                    {signatures.auditor?.name || audit.createdBy || ""}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {signatures.auditor?.date
                    ? formatDateForDisplay(signatures.auditor.date)
                    : audit.createdAt
                      ? formatDateForDisplay(audit.createdAt)
                      : "Date"}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <FaUserShield className="text-xl text-purple-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Approved By
                </span>
              </div>
              <div className="text-center">
                {audit.approvedBy || signatures.approver?.name ? (
                  <>
                    <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4 min-h-[40px] flex items-end justify-center">
                      <span className="text-gray-800 font-medium">
                        {audit.approvedBy || signatures.approver?.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {audit.approvedAt
                        ? formatDateForDisplay(audit.approvedAt)
                        : signatures.approver?.date
                          ? formatDateForDisplay(signatures.approver.date)
                          : "Date"}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4 min-h-[40px]"></div>
                    <span className="text-xs text-gray-500">Name & Date</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="mt-4 bg-white rounded-lg shadow-md p-4">
          <h4 className="font-medium text-gray-700 mb-2">Audit Metadata</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">Audit Code:</span>
              <span className="text-gray-700 font-medium">
                {audit.auditCode || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Created By:</span>
              <span className="text-gray-700 font-medium">
                {audit.createdBy || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Created At:</span>
              <span className="text-gray-700">
                {formatDateTimeForDisplay(audit.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Last Updated:</span>
              <span className="text-gray-700">
                {formatDateTimeForDisplay(audit.updatedAt)}
              </span>
            </div>
            {audit.submittedBy && (
              <div>
                <span className="text-gray-500 block">Submitted By:</span>
                <span className="text-gray-700 font-medium">
                  {audit.submittedBy}
                </span>
              </div>
            )}
            {audit.submittedAt && (
              <div>
                <span className="text-gray-500 block">Submitted At:</span>
                <span className="text-gray-700">
                  {formatDateTimeForDisplay(audit.submittedAt)}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500 block">Template ID:</span>
              <span className="text-gray-700">{audit.templateId}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Audit ID:</span>
              <span className="text-gray-700">{audit.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-500 text-sm">
          <p>
            This document is confidential and intended for internal use only.
          </p>
          <p>
            Generated on {formatDateForDisplay(new Date().toISOString())} |{" "}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div
              className={`p-4 text-white ${
                approvalAction === "approve" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              <h3 className="text-lg font-bold">
                {approvalAction === "approve"
                  ? "Approve Audit"
                  : "Reject Audit"}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments{" "}
                  {approvalAction === "reject" && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    approvalAction === "reject"
                      ? "Enter rejection reason..."
                      : "Enter any comments (optional)..."
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setApproverName("");
                  setApprovalComments("");
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproval}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 ${
                  approvalAction === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : approvalAction === "approve" ? (
                  "Approve"
                ) : (
                  "Reject"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 bg-purple-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaHistory /> Audit History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-purple-700 rounded text-white text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {auditHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No history records found.
                </p>
              ) : (
                <div className="space-y-4">
                  {auditHistory.map((record, index) => (
                    <div
                      key={record.Id || index}
                      className="border-l-4 border-purple-500 pl-4 py-2 bg-gray-50 rounded-r"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span
                            className={`font-semibold capitalize px-2 py-0.5 rounded text-sm ${
                              record.Action === "created"
                                ? "bg-green-100 text-green-700"
                                : record.Action === "updated"
                                  ? "bg-blue-100 text-blue-700"
                                  : record.Action === "submitted"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : record.Action === "approved"
                                      ? "bg-green-100 text-green-700"
                                      : record.Action === "rejected"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {record.Action}
                          </span>
                          <span className="text-gray-500 ml-2 text-sm">
                            by {record.ActionBy}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDateTimeForDisplay(record.ActionAt)}
                        </span>
                      </div>
                      {record.Comments && (
                        <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border">
                          <strong>Comment:</strong> {record.Comments}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;
