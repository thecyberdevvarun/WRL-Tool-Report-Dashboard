import { useState, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../assets/assets.js";

const API_BASE = `${baseURL}audit-report`;

// ==================== DATA TRANSFORMERS ====================

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
    createdBy: template.CreatedBy ?? template.createdBy,
    createdAt: template.CreatedAt ?? template.createdAt,
    updatedBy: template.UpdatedBy ?? template.updatedBy,
    updatedAt: template.UpdatedAt ?? template.updatedAt,
  };
};

const transformAudit = (audit) => {
  if (!audit) return null;
  return {
    id: audit.Id ?? audit.id,
    auditCode: audit.AuditCode ?? audit.auditCode,
    templateId: audit.TemplateId ?? audit.templateId,
    templateName: audit.TemplateName ?? audit.templateName,
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
    submittedBy: audit.SubmittedBy ?? audit.submittedBy,
    submittedAt: audit.SubmittedAt ?? audit.submittedAt,
    approvedBy: audit.ApprovedBy ?? audit.approvedBy,
    approvedAt: audit.ApprovedAt ?? audit.approvedAt,
    approvalComments: audit.ApprovalComments ?? audit.approvalComments,
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
      const response = await axios.get(`${API_BASE}/templates`, { params });
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

  const createTemplate = useCallback(async (templateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/templates`, templateData);
      const newTemplate = transformTemplate(response.data.data);
      setTemplates((prev) => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to create template";
      setError(message);
      console.error("Create template error:", err);
      throw new Error(message);
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
      throw new Error(message);
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

  const duplicateTemplate = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/templates/${id}/duplicate`,
      );
      const newTemplate = transformTemplate(response.data.data);
      setTemplates((prev) => [newTemplate, ...prev]);
      return newTemplate;
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
      return newAudit;
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
      return updatedAudit;
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

  return {
    templates,
    audits,
    loading,
    error,
    clearError,
    // Template methods
    loadTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    // Audit methods
    loadAudits,
    getAuditById,
    createAudit,
    updateAudit,
    deleteAudit,
    approveAudit,
    rejectAudit,
  };
};

export default useAuditData;
