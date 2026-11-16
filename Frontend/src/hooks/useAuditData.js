import { useState, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../assets/assets.js";

const API_BASE = `${baseURL}audit-report`;

// ==================== DATA TRANSFORMERS ====================

// BOM Sheet / CRF file names (same shape on templates and audits).
const docFields = (row) => ({
  bomFileName: row.BomFileName ?? row.bomFileName ?? null,
  bomOriginalName: row.BomOriginalName ?? row.bomOriginalName ?? null,
  crfFileName: row.CrfFileName ?? row.crfFileName ?? null,
  crfOriginalName: row.CrfOriginalName ?? row.crfOriginalName ?? null,
});

const transformTemplate = (template) => {
  if (!template) return null;
  return {
    id: template.Id ?? template.id,
    templateCode: template.TemplateCode ?? template.templateCode,
    name: template.Name ?? template.name,
    description: template.Description ?? template.description,
    category: template.Category ?? template.category,
    version: template.Version ?? template.version,
    isActive: template.IsActive ?? template.isActive,
    headerConfig: template.HeaderConfig ?? template.headerConfig ?? {},
    infoFields: template.InfoFields ?? template.infoFields ?? [],
    columns: template.Columns ?? template.columns ?? [],
    defaultSections: template.DefaultSections ?? template.defaultSections ?? [],
    sectionCount: template.SectionCount ?? template.sectionCount ?? null,
    stageCount: template.StageCount ?? template.stageCount ?? null,
    checkpointCount: template.CheckpointCount ?? template.checkpointCount ?? null,
    requiredCheckpointCount: template.RequiredCheckpointCount ?? template.requiredCheckpointCount ?? null,
    models: (() => {
      const raw = template.Models ?? template.models;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      try { return JSON.parse(raw); } catch { return []; }
    })(),
    approvalStatus: template.ApprovalStatus ?? template.approvalStatus,
    approvedBy: template.ApprovedBy ?? template.approvedBy,
    approvedAt: template.ApprovedAt ?? template.approvedAt,
    rejectionReason: template.RejectionReason ?? template.rejectionReason,
    createdBy: template.CreatedBy ?? template.createdBy,
    createdAt: template.CreatedAt ?? template.createdAt,
    updatedBy: template.UpdatedBy ?? template.updatedBy,
    updatedAt: template.UpdatedAt ?? template.updatedAt,
    ...docFields(template),
  };
};

const transformAudit = (audit) => {
  if (!audit) return null;
  return {
    id: audit.Id ?? audit.id,
    auditCode: audit.AuditCode ?? audit.auditCode,
    templateId: audit.TemplateId ?? audit.templateId,
    templateName: audit.TemplateName ?? audit.templateName,
    templateVersion: audit.TemplateVersion ?? audit.templateVersion,
    templateFileName: audit.TemplateFileName ?? audit.templateFileName,
    templateHash: audit.TemplateHash ?? audit.templateHash,
    templateSize: audit.TemplateSize ?? audit.templateSize,
    reportName: audit.ReportName ?? audit.reportName,
    formatNo: audit.FormatNo ?? audit.formatNo,
    revNo: audit.RevNo ?? audit.revNo,
    revDate: audit.RevDate ?? audit.revDate,
    notes: audit.Notes ?? audit.notes,
    status: audit.Status ?? audit.status,
    infoData: audit.InfoData ?? audit.infoData ?? {},
    sections: audit.Sections ?? audit.sections ?? [],
    signatures: audit.Signatures ?? audit.signatures ?? {},
    columns: audit.Columns ?? audit.columns ?? [],
    infoFields: audit.InfoFields ?? audit.infoFields ?? [],
    headerConfig: audit.HeaderConfig ?? audit.headerConfig ?? {},
    summary: audit.Summary ?? audit.summary ?? {},
    createdBy: audit.CreatedBy ?? audit.createdBy,
    createdAt: audit.CreatedAt ?? audit.createdAt,
    updatedBy: audit.UpdatedBy ?? audit.updatedBy,
    updatedAt: audit.UpdatedAt ?? audit.updatedAt,
    startedAt:   audit.StartedAt   ?? audit.startedAt,
    submittedBy: audit.SubmittedBy ?? audit.submittedBy,
    submittedAt: audit.SubmittedAt ?? audit.submittedAt,
    approvedBy: audit.ApprovedBy ?? audit.approvedBy,
    approvedAt: audit.ApprovedAt ?? audit.approvedAt,
    approvalComments: audit.ApprovalComments ?? audit.approvalComments,
    ...docFields(audit),
  };
};

export const useAuditData = () => {
  const [templates, setTemplates] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  // ==================== TEMPLATE METHODS ====================

  const loadTemplates = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Lists filter client-side, so ask for all (server caps at 1000), not the API default of 50.
      const response = await axios.get(`${API_BASE}/templates`, { params: { limit: 1000, ...params } });
      const transformedTemplates = (response.data.data || []).map(
        transformTemplate,
      );
      setTemplates(transformedTemplates);
      return {
        data: transformedTemplates,
        totalCount: response.data.totalCount || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 50,
      };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load templates";
      setError(message);
      console.error("Load templates error:", err);
      return { data: [], totalCount: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplateById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/templates/${id}`);
      return transformTemplate(response.data.data);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load template";
      setError(message);
      console.error("Get template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pre-flight name-uniqueness check, used before opening the builder for a
  // brand-new template. Returns { exists, data } — never throws on a
  // collision, that's a normal outcome the caller branches on.
  const checkTemplateName = useCallback(async (name) => {
    try {
      const response = await axios.get(`${API_BASE}/templates/check-name`, { params: { name } });
      return { exists: !!response.data.exists, data: transformTemplate(response.data.data) };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to check template name";
      console.error("Check template name error:", err);
      throw new Error(message);
    }
  }, []);

  // Returns { exists, data }. exists:true means the name collided with an
  // active template — no row was created; data is the existing template the
  // caller can offer to "Edit Existing" or "Cancel".
  const createTemplate = useCallback(async (templateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/templates`, templateData);
      const template = transformTemplate(response.data.data);
      if (!response.data.exists) {
        setTemplates((prev) => [template, ...prev]);
      }
      return { exists: !!response.data.exists, data: template };
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to create template";
      setError(message);
      console.error("Create template error:", err);
      const thrown = new Error(message);
      if (err.response?.data?.errors) thrown.errors = err.response.data.errors;
      thrown.status = err.response?.status;
      throw thrown;
    } finally {
      setLoading(false);
    }
  }, []);

  // Creates a new version of an existing template — never mutates the
  // previous version. Old version is deactivated server-side atomically.
  const createTemplateVersion = useCallback(async (id, templateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/templates/${id}/version`, templateData);
      const updatedTemplate = transformTemplate(response.data.data);
      setTemplates((prev) => prev.map((t) => (t.id == id ? updatedTemplate : t)));
      return updatedTemplate;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to create template version";
      setError(message);
      console.error("Create template version error:", err);
      const thrown = new Error(message);
      thrown.status = err.response?.status;
      throw thrown;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id, templateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(
        `${API_BASE}/templates/${id}`,
        templateData,
      );
      const updatedTemplate = transformTemplate(response.data.data);
      setTemplates((prev) =>
        prev.map((t) => (t.id == id ? updatedTemplate : t)),
      );
      return updatedTemplate;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to update template";
      setError(message);
      console.error("Update template error:", err);
      const thrown = new Error(message);
      if (err.response?.data?.errors) thrown.errors = err.response.data.errors;
      thrown.status = err.response?.status;
      throw thrown;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id != id));
      return true;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to delete template";
      setError(message);
      console.error("Delete template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // options must include { newName }, and optionally { confirmCreateVersion: true }
  // once the caller has confirmed turning a name collision into a new version
  // of the existing template. Returns { exists, existingTemplateId?, data }.
  // exists:true (without confirmCreateVersion) means newName collided with an
  // active template and nothing was written yet — the caller should offer
  // "Create Version" (re-call with confirmCreateVersion:true) or "Cancel".
  const duplicateTemplate = useCallback(async (id, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/templates/${id}/duplicate`,
        options,   // forwards { newName, createdBy, confirmCreateVersion }
      );
      const template = transformTemplate(response.data.data);
      if (!response.data.exists) {
        // Either a brand-new template, or an existing one that just got a new
        // version via confirmCreateVersion — upsert either way.
        setTemplates((prev) => {
          const exists = prev.some((t) => t.id == template.id);
          return exists ? prev.map((t) => (t.id == template.id ? template : t)) : [template, ...prev];
        });
      }
      return {
        exists: !!response.data.exists,
        existingTemplateId: response.data.existingTemplateId ?? null,
        data: template,
      };
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to duplicate template";
      setError(message);
      console.error("Duplicate template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== AUDIT METHODS ====================

  const loadAudits = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/audits`, { params });
      const transformedAudits = (response.data.data || []).map(transformAudit);
      setAudits(transformedAudits);
      return {
        data: transformedAudits,
        totalCount: response.data.totalCount || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 50,
      };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load audits";
      setError(message);
      console.error("Load audits error:", err);
      return { data: [], totalCount: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const getAuditById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/audits/${id}`);
      return transformAudit(response.data.data);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load audit";
      setError(message);
      console.error("Get audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAudit = useCallback(async (auditData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/audits`, auditData);
      const newAudit = transformAudit(response.data.data);
      setAudits((prev) => [newAudit, ...prev]);
      // Photos the server couldn't save (bad type/too large) — caller surfaces them.
      return { ...newAudit, imageErrors: response.data.imageErrors || [] };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to create audit";
      setError(message);
      console.error("Create audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAudit = useCallback(async (id, auditData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(`${API_BASE}/audits/${id}`, auditData);
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return { ...updatedAudit, imageErrors: response.data.imageErrors || [] };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to update audit";
      setError(message);
      console.error("Update audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAudit = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/audits/${id}`);
      setAudits((prev) => prev.filter((a) => a.id != id));
      return true;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to delete audit";
      setError(message);
      console.error("Delete audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const approveAudit = useCallback(async (id, approvalData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/audits/${id}/approve`,
        approvalData,
      );
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return updatedAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to approve audit";
      setError(message);
      console.error("Approve audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const rejectAudit = useCallback(async (id, rejectionData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/audits/${id}/reject`,
        rejectionData,
      );
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return updatedAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to reject audit";
      setError(message);
      console.error("Reject audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditModelSummary = useCallback(async (params = {}) => {
    try {
      const response = await axios.get(`${API_BASE}/audits/model-summary`, { params });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load audit summary";
      console.error("Audit model summary error:", err);
      throw new Error(message);
    }
  }, []);

  const getTemplateHistory = useCallback(async (id) => {
    try {
      const response = await axios.get(`${API_BASE}/templates/${id}/history`);
      return response.data.data || [];
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load template history";
      console.error("Template history error:", err);
      throw new Error(message);
    }
  }, []);

  const getTemplateVersions = useCallback(async (id) => {
    try {
      const response = await axios.get(`${API_BASE}/templates/${id}/versions`);
      return response.data.data || [];
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load template versions";
      console.error("Template versions error:", err);
      throw new Error(message);
    }
  }, []);

  const compareTemplateVersions = useCallback(async (id, from, to) => {
    try {
      const response = await axios.get(`${API_BASE}/templates/${id}/compare`, {
        params: { from, to },
      });
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to compare template versions";
      console.error("Template compare error:", err);
      throw new Error(message);
    }
  }, []);

  const fetchAuditStats = useCallback(async (params = {}) => {
    try {
      const response = await axios.get(`${API_BASE}/audits/stats`, { params });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load audit stats";
      console.error("Audit stats error:", err);
      throw new Error(message);
    }
  }, []);

  // BOM Sheet / CRF on a template. Both resolve to the template's new
  // document fields ({ bomFileName, bomOriginalName, crfFileName, crfOriginalName }).
  const uploadTemplateDocument = useCallback(async (id, kind, file) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await axios.post(`${API_BASE}/templates/${id}/documents/${kind}`, form);
      return docFields(response.data.data || {});
    } catch (err) {
      throw new Error(err.response?.data?.message || "Upload failed");
    }
  }, []);

  const removeTemplateDocument = useCallback(async (id, kind) => {
    try {
      const response = await axios.delete(`${API_BASE}/templates/${id}/documents/${kind}`);
      return docFields(response.data.data || {});
    } catch (err) {
      throw new Error(err.response?.data?.message || "Remove failed");
    }
  }, []);

  return {
    templates,
    audits,
    loading,
    error,
    clearError,
    // Template methods
    loadTemplates,
    getTemplateById,
    checkTemplateName,
    createTemplate,
    createTemplateVersion,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    uploadTemplateDocument,
    removeTemplateDocument,
    // Audit methods
    loadAudits,
    getAuditById,
    createAudit,
    updateAudit,
    deleteAudit,
    approveAudit,
    rejectAudit,
    fetchAuditModelSummary,
    fetchAuditStats,
    getTemplateHistory,
    getTemplateVersions,
    compareTemplateVersions,
  };
};

export default useAuditData;
