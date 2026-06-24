import {
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
} from "react";
import { Tree, Modal, Input, Tooltip } from "antd";
import { Dropdown } from "@km/shared-components-react";
import type { TreeProps, TreeDataNode } from "antd";
import { SvgIcon } from "@km/shared-components-react";
import { useNavigate, useParams } from "react-router-dom";
import { useLibraryStore } from "@/stores/modules/library";
import { CatalogDropdown } from "./components/catalog/dropdown";
import LibraryPermission from "../components/permission/Library";
import FilePermission from "../components/permission/File";
import { PERMISSION_TYPE } from "@/components/KMPermission/constant";
import { buildUrl } from "@/utils/router";
import { t } from "@/locales";
import { filesApi } from "@/api/modules/files";
import { useInlineEdit } from "../composables/useInlineEdit";
import "./catalog.css";

interface FileItem {
  id: string;
  name: string;
  path: string;
  library_id: string;
  isfile: boolean;
  isfolder: boolean;
  icon?: string;
  permission: number;
  base_path?: string;
  file_ext?: string;
  children?: FileItem[];
  [key: string]: any;
}

interface CatalogProps {
  onUpload?: (type: "file" | "folder", basePath: string) => void;
  className?: string;
}

export interface CatalogRef {
  renameFile: (data: FileItem) => void;
  createFolder: (path: string) => void;
  createMd: (path: string) => void;
  deleteFile: (data: FileItem) => Promise<void>;
  editFile: (data: FileItem) => void;
  router: (data: FileItem, query?: Record<string, any>) => void;
  newTab: (data: FileItem) => Window | null;
  filter: (keyword: string) => void;
  command: (cmd: string, data: FileItem) => void;
}

export const Catalog = forwardRef<CatalogRef, CatalogProps>(
  ({ onUpload, className }, ref) => {
    const navigate = useNavigate();
    const params = useParams<{ id: string; fid: string }>();
    const libraryStore = useLibraryStore();
    const treeRef = useRef<any>(null);
    const treeContainerRef = useRef<HTMLDivElement>(null);
    const dragExpandTimerRef = useRef<number>(0);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(
      null,
    ); // 当前拖拽悬停的文件夹 ID
    const [treeHeight, setTreeHeight] = useState<number>(400);
    const [searchValue, setSearchValue] = useState("");
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);

    // Inline editing state
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editingNodeValue, setEditingNodeValue] = useState("");
    const inlineInputRef = useRef<HTMLInputElement>(null);
    const {
      handleClick: handleInlineClick,
      handleBlur: handleInlineBlur,
      handleKeydown: handleInlineKeydown,
      handlePaste: handleInlinePaste,
    } = useInlineEdit();

    const libraryId = params.id || "";

    // Focus input when editing starts
    useEffect(() => {
      if (editingNodeId !== null) {
        setTimeout(() => {
          inlineInputRef.current?.focus();
          inlineInputRef.current?.select();
        }, 50);
      }
    }, [editingNodeId]);

    // Update tree height when container resizes
    useEffect(() => {
      const container = treeContainerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setTreeHeight(entry.contentRect.height);
        }
      });

      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    // Start inline editing
    const startInlineEdit = useCallback(
      (nodeId: string, currentName: string) => {
        setEditingNodeId(nodeId);
        setEditingNodeValue(currentName);
      },
      [],
    );

    // Stop inline editing
    const stopInlineEdit = useCallback(() => {
      setEditingNodeId(null);
      setEditingNodeValue("");
    }, []);

    // Handle inline edit save
    const handleInlineEditSave = useCallback(
      async (data: FileItem, newName: string) => {
        // 过滤掉 / 字符
        const sanitized = newName.replace(/\//g, "");
        const realExt = data.isfile
          ? data.file_ext === "md"
            ? ""
            : "." + data.file_ext
          : "";
        const fullName = data.isfile ? `${sanitized}${realExt}.md` : sanitized;
        const newPath = `${data.base_path}/${fullName}`;

        if (data.path === newPath) {
          stopInlineEdit();
          return;
        }

        // Check for duplicate names
        const siblings = libraryStore.findNodeInBasePath(
          data.base_path,
          libraryStore.treeFiles(),
        );
        const isDuplicate = siblings.some(
          (item) => item.id !== data.id && item.name === fullName,
        );

        let finalName = fullName;
        if (isDuplicate) {
          // Generate unique name
          let baseName = newName;
          if (data.isfile) {
            baseName = newName.replace(realExt, "");
          }
          const pattern = new RegExp(
            `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\((\\d+)\\)$`,
          );
          const numbers: number[] = [];

          siblings.forEach((item) => {
            let itemName = data.isfile
              ? item.name.replace(".md", "").replace(realExt, "")
              : item.name;
            const match = itemName.match(pattern);
            if (match && item.id !== data.id) {
              numbers.push(parseInt(match[1], 10));
            }
          });

          const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
          const nextNumber = maxNumber + 1;
          const uniqueName = `${baseName}(${nextNumber})`;
          finalName = data.isfile ? `${uniqueName}${realExt}.md` : uniqueName;
        }

        const finalPath = `${data.base_path}/${finalName}`;
        await libraryStore.rename(data.id, finalPath);
        libraryStore.loadFilesAll();
        stopInlineEdit();
      },
      [libraryStore, stopInlineEdit],
    );

    // Handle inline edit cancel
    const handleInlineEditCancel = useCallback(() => {
      stopInlineEdit();
    }, [stopInlineEdit]);

    // Navigate to file/folder
    const fileRouteNavigate = useCallback(
      (data: FileItem, view?: string, query?: Record<string, any>) => {
        const routeName = data.isfile
          ? view === "edit"
            ? `/library/${libraryId}/file/${data.id}/chunks-edit`
            : view === "chunks"
              ? `/library/${libraryId}/file/${data.id}/chunks`
              : `/library/${libraryId}/file/${data.id}`
          : `/library/${libraryId}/folder/${data.id}`;

        navigate(
          routeName +
            (query ? `?${new URLSearchParams(query).toString()}` : ""),
        );
      },
      [navigate, libraryId],
    );

    const handleEditFile = useCallback(
      (data: FileItem) => {
        fileRouteNavigate(data, "edit");
      },
      [fileRouteNavigate],
    );

    const handleView = useCallback(
      (data: FileItem, query?: Record<string, any>) => {
        const view =
          libraryStore.fileViewType === "chunk" ? "chunks" : undefined;
        fileRouteNavigate(data, view, query);
      },
      [fileRouteNavigate, libraryStore.fileViewType],
    );

    // Find node by path
    const findNodeByPath = useCallback(
      (path: string, files: FileItem[]): FileItem | null => {
        if (path === "") return null;

        for (const file of files) {
          if (file.path === path) return file;
          if (file.children) {
            const found = findNodeByPath(path, file.children);
            if (found) return found;
          }
        }
        return null;
      },
      [],
    );

    // Refresh parent node
    const refreshParentNode = useCallback(
      (path: string) => {
        const currentExpandedKeys = [...libraryStore.expandedKeys];
        libraryStore.loadFilesAll().then(() => {
          libraryStore.setExpandedKeys(currentExpandedKeys);
        });
      },
      [libraryStore],
    );

    // Create folder with unique name
    const createFolder = useCallback(
      (path: string) => {
        const nodes = libraryStore.findNodeInBasePath(
          path,
          libraryStore.treeFiles(),
        );
        const existingNames = nodes.map((item) => item.name);

        const generateUniqueName = (baseName: string): string => {
          if (!existingNames.includes(baseName)) return baseName;

          const pattern = new RegExp(
            `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\((\\d+)\\)$`,
          );
          const numbers: number[] = [];
          existingNames.forEach((name) => {
            const match = name.match(pattern);
            if (match) numbers.push(parseInt(match[1], 10));
          });

          const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
          return `${baseName}(${maxNumber + 1})`;
        };

        const name = generateUniqueName("无标题文件夹");
        libraryStore.createFolder({ name, path }).then((res: any) => {
          // Save current expanded state
          const currentExpandedKeys = [...libraryStore.expandedKeys];
          libraryStore.loadFilesAll().then(() => {
            // Restore expanded state
            libraryStore.setExpandedKeys(currentExpandedKeys);
            // Start inline editing for the new folder
            setTimeout(() => {
              startInlineEdit(res.id, name);
            }, 100);
          });
        });
      },
      [libraryStore, startInlineEdit],
    );

    // Create MD file with unique name
    const createMd = useCallback(
      (path: string) => {
        const nodes = libraryStore.findNodeInBasePath(
          path,
          libraryStore.treeFiles(),
        );
        const existingNames = nodes.map((item) => item.name.replace(".md", ""));

        const generateUniqueName = (baseName: string): string => {
          if (!existingNames.includes(baseName)) return baseName;

          const pattern = new RegExp(
            `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\((\\d+)\\)$`,
          );
          const numbers: number[] = [];
          existingNames.forEach((name) => {
            const match = name.match(pattern);
            if (match) numbers.push(parseInt(match[1], 10));
          });

          const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
          return `${baseName}(${maxNumber + 1})`;
        };

        const baseName = generateUniqueName("无标题知识");
        const name = baseName + ".md";
        libraryStore
          .createFile({ name, path, permissions: [] })
          .then((res: any) => {
            // Save current expanded state
            const currentExpandedKeys = [...libraryStore.expandedKeys];
            libraryStore.loadFilesAll().then(() => {
              // Restore expanded state
              libraryStore.setExpandedKeys(currentExpandedKeys);
              // Start inline editing for the new file
              setTimeout(() => {
                startInlineEdit(res.id, baseName);
              }, 100);
            });
          });
      },
      [libraryStore, startInlineEdit],
    );

    // Rename file/folder - open modal
    const openRenameModal = useCallback((data: FileItem) => {
      const realExt = data.file_ext === "md" ? "" : "." + data.file_ext;
      const currentName = data.isfile
        ? data.name.replace(realExt || ".md", "")
        : data.name;
      setRenamingFile(data);
      setRenameValue(currentName);
      setRenameModalVisible(true);
    }, []);

    // Handle rename confirmation
    const handleRenameConfirm = useCallback(() => {
      if (!renamingFile || !renameValue.trim()) return;

      // 过滤掉 / 字符
      const sanitized = renameValue.replace(/\//g, "");
      const realExt =
        renamingFile.file_ext === "md" ? "" : "." + renamingFile.file_ext;
      const fullName = renamingFile.isfile
        ? `${sanitized}${realExt}.md`
        : sanitized;
      const newPath = `${renamingFile.base_path}/${fullName}`;

      if (renamingFile.path === newPath) {
        setRenameModalVisible(false);
        return;
      }

      libraryStore.rename(renamingFile.id, newPath).then(() => {
        libraryStore.loadFilesAll();
        setRenameModalVisible(false);
      });
    }, [renamingFile, renameValue, libraryStore]);

    // Delete file/folder
    const deleteFile = useCallback(
      async (data: FileItem) => {
        const confirmMessage = data.isfolder
          ? t("status.files_del")
          : t("status.file_del");

        Modal.confirm({
          title: t("common.tip"),
          content: confirmMessage,
          okText: t("action.confirm"),
          cancelText: t("action.cancel"),
          onOk: async () => {
            await libraryStore.deleteFile(data);
            if (libraryStore.currentFileId === data.id) {
              // Check if there's a parent folder
              if (data.base_path) {
                // Find parent folder
                const parentFolder = findNodeByPath(
                  data.base_path,
                  libraryStore.treeFiles(),
                );
                if (parentFolder) {
                  // Navigate to parent folder page
                  navigate({
                    pathname: `/library/${libraryId}/folder/${parentFolder.id}`,
                  });
                  return;
                }
              }
              // No parent folder, navigate to home
              navigate(`/library/${libraryId}`);
            }
          },
        });
      },
      [libraryStore, navigate, libraryId, findNodeByPath],
    );

    // Handle command from dropdown
    const handleCommand = useCallback(
      (command: string) => {
        switch (command) {
          case "create_md":
            createMd("");
            break;
          case "create_folder":
            createFolder("");
            break;
          case "upload_file":
            onUpload?.("file", "");
            break;
          case "upload_folder":
            onUpload?.("folder", "");
            break;
        }
        document.body.click();
      },
      [createMd, createFolder, onUpload],
    );

    // Handle tree node command
    const handleTreeCommand = useCallback(
      (command: string, data: FileItem) => {
        switch (command) {
          case "rename":
            openRenameModal(data);
            break;
          case "delete":
            deleteFile(data);
            break;
        }
      },
      [openRenameModal, deleteFile],
    );

    // Handle folder command
    const handleFolderCommand = useCallback(
      (command: string, data: FileItem) => {
        // Auto-expand the folder if it's not already expanded
        if (data.isfolder && !libraryStore.expandedKeys.includes(data.id)) {
          libraryStore.setExpandedKeys([...libraryStore.expandedKeys, data.id]);
        }

        switch (command) {
          case "create_md":
            createMd(data.path);
            break;
          case "create_folder":
            createFolder(data.path);
            break;
          case "upload_file":
            onUpload?.("file", data.path);
            break;
          case "upload_folder":
            onUpload?.("folder", data.path);
            break;
        }
      },
      [createMd, createFolder, onUpload, libraryStore],
    );

    // Handle mouse enter to load permissions
    const handleMouseEnter = useCallback(
      (data: FileItem) => {
        libraryStore.loadFilePermissions(data.id);
      },
      [libraryStore],
    );

    // Sort files - accepts array of file ids and their sort values
    const sortFilesByIds = useCallback(
      async (fileIds: string[], basePath: string) => {
        await filesApi.sort({
          files: fileIds.map((id, index) => ({
            id,
            sort: index + 2,
          })),
        });
      },
      [],
    );

    // Find parent node by path from treeFiles
    const findParentNodeByPath = useCallback(
      (path: string, treeFiles: FileItem[]): FileItem | null => {
        if (path === "") return null;
        for (const file of treeFiles) {
          if (file.path === path) return file;
          if (file.children) {
            const found = findParentNodeByPath(path, file.children);
            if (found) return found;
          }
        }
        return null;
      },
      [],
    );

    // Get siblings at a path (files at the same level)
    const getSiblingsAtPath = useCallback(
      (basePath: string): FileItem[] => {
        const treeFiles = libraryStore.treeFiles();
        if (basePath === "") {
          return treeFiles;
        }
        const parent = findParentNodeByPath(basePath, treeFiles);
        return parent?.children || [];
      },
      [libraryStore, findParentNodeByPath],
    );

    // Handle node drop
    // Ant Design Tree onDrop parameters:
    // - dropToGap: boolean - true if dropped in gap, false if dropped inside
    // - dropPosition: -1 | 0 | 1 - -1: above, 0: inside, 1: below
    const handleDrop: TreeProps["onDrop"] = async (info) => {
      const { node: dropNode, dragNode, dropPosition, dropToGap } = info;

      const dropData = dropNode as any;
      const dragData = dragNode as any;

      // Get file data from store
      const dragFile = libraryStore.files.find((f) => f.id === dragData.key);
      const dropFile = libraryStore.files.find((f) => f.id === dropData.key);

      if (!dragFile || !dropFile) return;

      // 判断是否应该放入文件夹内部：
      // 1. Ant Design 认为是内部放置 (dropToGap=false)
      // 2. 或者我们检测到鼠标在文件夹中心区域 (dragOverFolderId === dropFile.id)
      const shouldDropInside =
        !dropToGap || (dropFile.isfolder && dragOverFolderId === dropFile.id);

      if (shouldDropInside) {
        // Drop inside a folder (become child of dropNode)
        const newPath = `${dropFile.path}/${dragFile.name}${dragFile.isfile ? ".md" : ""}`;
        await libraryStore.rename(dragFile.id, newPath);

        // Wait for files state to refresh before sorting
        await libraryStore.loadFilesAll();

        // Sort the children of target folder
        const children = getSiblingsAtPath(dropFile.path);
        const childIds = [...children.map((f) => f.id), dragFile.id];
        await sortFilesByIds(childIds, dropFile.path);

        // Expand the target folder
        if (!libraryStore.expandedKeys.includes(dropFile.id)) {
          libraryStore.setExpandedKeys([
            ...libraryStore.expandedKeys,
            dropFile.id,
          ]);
        }
      } else {
        // Drop in gap (before or after dropNode)
        // dropPosition: -1 = before, 1 = after
        const targetBasePath = dropFile.base_path;

        // First, move to the target directory if cross-level
        const isSameLevel = dragFile.base_path === dropFile.base_path;
        if (!isSameLevel) {
          const newPath = `${targetBasePath}/${dragFile.name}${dragFile.isfile ? ".md" : ""}`;
          await libraryStore.rename(dragFile.id, newPath);
          // Wait for files state to refresh before sorting
          await libraryStore.loadFilesAll();
        }

        // Get siblings at target level and calculate new order
        const siblings = getSiblingsAtPath(targetBasePath);
        const siblingIds = siblings.map((f) => f.id);

        // Remove dragged item from current position if same level
        if (isSameLevel) {
          const dragIdx = siblingIds.indexOf(dragFile.id);
          if (dragIdx !== -1) {
            siblingIds.splice(dragIdx, 1);
          }
        }

        // Find position of drop target in the list
        const dropIdx = siblingIds.indexOf(dropFile.id);
        if (dropIdx !== -1) {
          // Insert at correct position
          // dropPosition = -1: insert BEFORE dropFile (at dropIdx)
          // dropPosition = 1: insert AFTER dropFile (at dropIdx + 1)
          const insertIdx = dropPosition === -1 ? dropIdx : dropIdx + 1;
          siblingIds.splice(insertIdx, 0, dragFile.id);
          await sortFilesByIds(siblingIds, targetBasePath);
        }
      }

      // Clear drag over state
      setDragOverFolderId(null);

      // Refresh to show changes
      refreshParentNode("");
    };

    // Handle drag enter - auto expand folder when hovering
    const onDragEnter: TreeProps["onDragEnter"] = (info) => {
      const nodeData = info.node as any;
      const fileData = libraryStore.files.find((f) => f.id === nodeData.key);

      // Clear any existing timer
      clearTimeout(dragExpandTimerRef.current);

      // Set drag over folder for visual feedback
      if (fileData && fileData.isfolder) {
        setDragOverFolderId(fileData.id);
      }

      // Auto-expand folder after short delay when dragging over it
      if (
        fileData &&
        fileData.isfolder &&
        !libraryStore.expandedKeys.includes(fileData.id)
      ) {
        dragExpandTimerRef.current = window.setTimeout(() => {
          if (!libraryStore.expandedKeys.includes(fileData.id)) {
            libraryStore.setExpandedKeys([
              ...libraryStore.expandedKeys,
              fileData.id,
            ]);
          }
        }, 500);
      }
    };

    // Handle drag leave - clear expand timer and drag over state
    const onDragLeave: TreeProps["onDragLeave"] = (info) => {
      clearTimeout(dragExpandTimerRef.current);
      // Check if we're leaving the tree entirely
      const nodeData = info.node as any;
      if (nodeData.key === dragOverFolderId) {
        setDragOverFolderId(null);
      }
    };

    // Handle drag end - clear drag over state
    const onDragEnd: TreeProps["onDragEnd"] = (...args) => {
      setDragOverFolderId(null);
    };

    // Allow drop check
    // Ant Design Tree allowDrop: returns true to allow drop, false to deny
    // options: { dragNode, dropNode, dropPosition } where dropPosition: -1 | 0 | 1
    // -1: drop in gap ABOVE, 0: drop INSIDE, 1: drop in gap BELOW
    const allowDrop: TreeProps["allowDrop"] = ({
      dropNode,
      dropPosition,
      dragNode,
    }) => {
      const nodeData = dropNode as any;
      const dragData = dragNode as any;

      // dropPosition === 0 means dropping INSIDE the node
      if (dropPosition === 0) {
        // Check if target node is a folder by looking up in our data
        const fileData = libraryStore.files.find((f) => f.id === nodeData.key);
        // Only allow dropping inside folders (isfolder=true), not files
        return !!(fileData && fileData.isfolder);
      }
      return true;
    };

    // Handle node title click - custom expand/navigate logic
    const handleNodeTitleClick = useCallback(
      (file: FileItem, e: React.MouseEvent) => {
        e.stopPropagation();

        if (file.isfolder) {
          // Check if folder is expanded
          const isExpanded = libraryStore.expandedKeys.includes(file.id);
          if (!isExpanded) {
            // Folder not expanded - expand it (don't navigate)
            libraryStore.setExpandedKeys([
              ...libraryStore.expandedKeys,
              file.id,
            ]);
          } else {
            // Folder already expanded - navigate to folder page
            handleView(file);
          }
        } else {
          // File - navigate to file page
          handleView(file);
        }
      },
      [libraryStore, handleView],
    );

    // Tree event handlers
    const onSelect: TreeProps["onSelect"] = (selectedKeys, info) => {
      // Don't handle select here - we use custom click handler
      // This prevents double navigation
    };

    const onExpand: TreeProps["onExpand"] = (expandedKeys, info) => {
      const nodeData = info.node as any;
      // 从 treeFiles 中查找节点以获取 children 信息
      const findNodeInTree = (
        nodes: FileItem[],
        id: string,
      ): FileItem | null => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNodeInTree(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const file = findNodeInTree(libraryStore.treeFiles(), nodeData.key);

      if (info.expanded) {
        // Node expanded - add to expanded keys
        libraryStore.setExpandedKeys(expandedKeys as string[]);
      } else {
        // Node collapsed - remove all children keys recursively
        if (file && file.isfolder) {
          // Get all descendant IDs
          const getAllChildIds = (node: FileItem): string[] => {
            const ids: string[] = [];
            if (node.children) {
              for (const child of node.children) {
                ids.push(child.id);
                ids.push(...getAllChildIds(child));
              }
            }
            return ids;
          };

          const childIds = getAllChildIds(file);
          const filteredKeys = (expandedKeys as string[]).filter(
            (key) => !childIds.includes(key),
          );
          libraryStore.setExpandedKeys(filteredKeys);
        } else {
          libraryStore.setExpandedKeys(expandedKeys as string[]);
        }
      }
    };

    // Filter tree by keyword
    const filter = useCallback((keyword: string) => {
      setSearchValue(keyword);
      // Ant Design Tree doesn't have built-in filter, we'd need to implement custom filtering
      // For now, just store the search value
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      renameFile: openRenameModal,
      createFolder,
      createMd,
      deleteFile,
      editFile: handleEditFile,
      router: handleView,
      newTab: (data: FileItem) => {
        const url = buildUrl(
          `/library/${libraryId}/${data.isfile ? "file" : "folder"}/${data.id}`,
        );
        return window.open(url, "_blank");
      },
      filter,
      command: handleFolderCommand,
    }));

    // Build tree data from already-structured tree files
    const buildTreeData = useCallback(
      (treeFiles: FileItem[]): TreeDataNode[] => {
        const processNode = (file: FileItem): TreeDataNode => {
          const isEditing = editingNodeId === file.id;

          return {
            key: file.id,
            title: (
              <div
                className={`catalog-tree-node group${dragOverFolderId === file.id && file.isfolder ? " drag-over-folder" : ""}`}
                onMouseEnter={() => handleMouseEnter(file)}
                onClick={(e) => handleNodeTitleClick(file, e)}
                onDragOver={(e) => {
                  // 仅���节点中心区域设置蓝色背景（用于放入文件夹）
                  // 边缘区域（上方/下方 8px）不触发，保持间隙排序行为
                  if (file.isfolder) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const edgeThreshold = 8; // 边缘区域阈值
                    if (y > edgeThreshold && y < rect.height - edgeThreshold) {
                      if (dragOverFolderId !== file.id) {
                        setDragOverFolderId(file.id);
                      }
                    } else {
                      // 在边缘区域，清除蓝色背景状态
                      if (dragOverFolderId === file.id) {
                        setDragOverFolderId(null);
                      }
                    }
                  }
                }}
              >
                <div className="flex-none size-5 flex items-center">
                  <img className="size-4" src={file.icon} alt="" />
                </div>
                {isEditing ? (
                  <input
                    ref={inlineInputRef}
                    value={editingNodeValue}
                    onChange={(e) => setEditingNodeValue(e.target.value)}
                    className="text-sm text-[#1D1E1F] px-1 py-0.5 border rounded outline-none bg-white inline-edit-input"
                    style={{ borderColor: "rgba(50, 150, 250, 1)" }}
                    onBlur={() => handleInlineEditSave(file, editingNodeValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        handleInlineEditCancel();
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        handleInlineEditSave(file, editingNodeValue);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <Tooltip
                    title={file.name}
                    placement="right"
                    styles={{ root: { marginLeft: "28px" } }}
                  >
                    <p className="flex-1 min-w-0 text-sm text-[#1D1E1F] truncate">
                      {file.name}
                    </p>
                  </Tooltip>
                )}
                {file.permission >= PERMISSION_TYPE.viewer && !isEditing && (
                  <div
                    className="node-actions hidden group-hover:flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <FilePermission
                      permission={file.permission}
                      resource={file}
                      required={PERMISSION_TYPE.edit_knowledge}
                    >
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: "rename",
                              label: t("action.rename"),
                            },
                            {
                              key: "delete",
                              label: t("action.del"),
                              danger: true,
                            },
                          ],
                          onClick: ({ key }) => handleTreeCommand(key, file),
                        }}
                        trigger={["click"]}
                        placement="bottomRight"
                      >
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          className="action-btn"
                        >
                          <SvgIcon name="more-h" size={16} />
                        </span>
                      </Dropdown>
                    </FilePermission>

                    {file.isfolder && (
                      <FilePermission
                        permission={file.permission}
                        resource={file}
                        required={PERMISSION_TYPE.edit_knowledge}
                      >
                        <CatalogDropdown
                          filter="all"
                          onCreateMd={() => createMd(file.path)}
                          onCreateFolder={() => createFolder(file.path)}
                          onUploadFile={() => onUpload?.("file", file.path)}
                          onUploadFolder={() => onUpload?.("folder", file.path)}
                        >
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            className="action-btn"
                          >
                            <SvgIcon name="plus" size={16} />
                          </span>
                        </CatalogDropdown>
                      </FilePermission>
                    )}
                  </div>
                )}
              </div>
            ),
            isLeaf: file.isfile,
            // Ensure folders always have children array (even empty) so Tree recognizes them as expandable
            children: file.isfolder
              ? file.children?.map((child) => processNode(child)) || []
              : undefined,
          };
        };

        return treeFiles.map((file) => processNode(file));
      },
      [
        editingNodeId,
        editingNodeValue,
        dragOverFolderId,
        handleMouseEnter,
        handleInlineEditSave,
        handleInlineEditCancel,
        handleTreeCommand,
        createMd,
        createFolder,
        onUpload,
        handleNodeTitleClick,
      ],
    );

    const treeData = useMemo(
      () => buildTreeData(libraryStore.treeFiles()),
      [libraryStore.files, buildTreeData],
    );

    return (
      <div className={`py-4 flex flex-col h-full ${className || ""}`}>
        {/* Header */}
        <div className="flex-none px-4 flex items-center gap-2 mb-1">
          <div className="flex-1 text-xs text-[#4F5052]">
            {t("common.catalog")}
          </div>

          <LibraryPermission required={PERMISSION_TYPE.edit_knowledge}>
            <CatalogDropdown onCommand={handleCommand}>
              <div className="size-5 flex items-center justify-center rounded cursor-pointer hover:bg-[#F2F2F2]">
                <SvgIcon name="plus" size={16} />
              </div>
            </CatalogDropdown>
          </LibraryPermission>
        </div>

        {/* Tree */}
        <div
          ref={treeContainerRef}
          className="flex-1 px-4 overflow-x-hidden overflow-hidden relative"
        >
          {treeData.length > 0 ? (
            <Tree
              ref={treeRef}
              blockNode
              virtual
              height={treeHeight}
              itemHeight={36}
              treeData={treeData}
              selectedKeys={
                libraryStore.currentFileId ? [libraryStore.currentFileId] : []
              }
              expandedKeys={libraryStore.expandedKeys}
              onSelect={onSelect}
              onExpand={onExpand}
              expandAction={false}
              draggable={{
                icon: false,
                nodeDraggable: (node) => {
                  return !editingNodeId;
                },
              }}
              onDrop={handleDrop}
              allowDrop={allowDrop}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragEnd={onDragEnd}
              className="library-documents-tree"
              style={{
                "--ant-tree-title-height": "34px",
                "--ant-tree-indent-size": "12px",
                "--ant-tree-switcher-size": "12px",
              }}
            />
          ) : (
            <div className="catalog-empty">
              <div className="catalog-empty-icon">
                <SvgIcon name="inside-share" size={80} className="!size-20" />
              </div>
              <p className="catalog-empty-text">
                暂无内容，点击{" "}
                <SvgIcon name="plus" size={14} className="mx-1" /> 新建
              </p>
            </div>
          )}
        </div>

        {/* Rename Modal */}
        <Modal
          open={renameModalVisible}
          title={t("action.rename")}
          onOk={handleRenameConfirm}
          onCancel={() => setRenameModalVisible(false)}
          okText={t("action.confirm")}
          cancelText={t("action.cancel")}
        >
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={
                renamingFile?.isfile
                  ? t("common.file_name")
                  : t("common.files_name")
              }
              onPressEnter={handleRenameConfirm}
            />
          </div>
        </Modal>
      </div>
    );
  },
);

export default Catalog;
