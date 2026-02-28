import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCopy,
  FaSearch,
  FaFilter,
  FaFileAlt,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";

const TemplateList = () => {
  const { user } = useSelector((store) => store.auth);
  const navigate = useNavigate();
  const {
    templates,
    deleteTemplate,
    duplicateTemplate,
    loadTemplates,
    loading,
    error,
  } = useAuditData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setInitialLoading(true);
      try {
        await loadTemplates();
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !filterCategory || template.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle delete
  const handleDelete = async () => {
    if (templateToDelete) {
      setActionLoading(true);
      try {
        await deleteTemplate(templateToDelete.id);
        setShowDeleteModal(false);
        setTemplateToDelete(null);
      } catch (err) {
        toast.error("Failed to delete template: " + err.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Handle duplicate
  const handleDuplicate = async (template) => {
    setActionLoading(true);
    try {
      await duplicateTemplate(template.id);
      toast.success("Template duplicated successfully!");
    } catch (err) {
      toast.error("Failed to duplicate template: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm delete
  const confirmDelete = (template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  // Get category badge color
  const getCategoryBadge = (category) => {
    const colors = {
      quality: "bg-blue-100 text-blue-700",
      safety: "bg-red-100 text-red-700",
      process: "bg-green-100 text-green-700",
      compliance: "bg-purple-100 text-purple-700",
      other: "bg-gray-100 text-gray-700",
    };
    return colors[category] || colors.other;
  };

  // Get total checkpoints
  const getTotalCheckpoints = (template) => {
    if (!template.defaultSections) return 0;
    return template.defaultSections.reduce(
      (total, section) => total + (section.checkPoints?.length || 0),
      0,
    );
  };

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-gray-100/90 backdrop-blur border-b border-gray-200 shadow-sm p-4 mb-4">
          <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <HiClipboardDocumentCheck className="text-blue-600" />
                Audit Templates
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your audit report templates
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <FaFilter className="text-gray-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                <option value="quality">Quality Audit</option>
                <option value="safety">Safety Audit</option>
                <option value="process">Process Audit</option>
                <option value="compliance">Compliance Audit</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* ==================== Filter Result Count ==================== */}
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-blue-700 font-bold text-lg">
                {filteredTemplates.length}
              </span>
              <span className="text-blue-600 text-sm">
                {filteredTemplates.length === 1 ? "Template" : "Templates"}
                {searchTerm || filterCategory ? " found" : " total"}
              </span>
              {/* Clear filters button — only shows when filters are active */}
              {(searchTerm || filterCategory) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCategory("");
                  }}
                  className="ml-2 text-xs text-red-500 hover:text-red-700 underline transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FaFileAlt className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Templates Found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterCategory
                ? "No templates match your search criteria."
                : "Get started by creating your first audit template."}
            </p>
            {(searchTerm || filterCategory) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterCategory("");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-800">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-white truncate flex-1 pr-2">
                      {template.name}
                    </h3>
                    {template.isActive !== false ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                        <FaCheckCircle size={10} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                        <FaTimesCircle size={10} /> Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2 min-h-[40px]">
                    {template.description || "No description provided"}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.category && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getCategoryBadge(
                          template.category,
                        )}`}
                      >
                        {template.category}
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      v{template.version || "1.0"}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {template.defaultSections?.length || 0} sections
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {getTotalCheckpoints(template)} checkpoints
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/auditreport/audits/new?template=${template.id}`,
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      <FaPlus size={12} /> Use
                    </button>
                    {[
                      ROLES.ADMIN,
                      ROLES.QUALITY_MANAGER,
                      ROLES.LINE_QUALITY_ENGINEER,
                    ].includes(user?.role) && (
                      <>
                        <button
                          onClick={() =>
                            navigate(`/auditreport/templates/${template.id}`)
                          }
                          className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all"
                          title="Edit"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(template)}
                          disabled={actionLoading}
                          className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-lg transition-all disabled:opacity-50"
                          title="Duplicate"
                        >
                          <FaCopy size={14} />
                        </button>
                        <button
                          onClick={() => confirmDelete(template)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all"
                          title="Delete"
                        >
                          <FaTrash size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
                  Created:{" "}
                  {template.createdAt
                    ? new Date(template.createdAt).toLocaleDateString()
                    : "-"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-4 bg-red-600 text-white">
                <h3 className="text-lg font-bold">Confirm Delete</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700">
                  Are you sure you want to delete the template "
                  <strong>{templateToDelete?.name}</strong>"?
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  This action cannot be undone.
                </p>
              </div>
              <div className="p-4 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setTemplateToDelete(null);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateList;
