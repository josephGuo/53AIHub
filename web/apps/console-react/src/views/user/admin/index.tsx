import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, Button, message, Modal } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { SvgIcon, Search } from "@km/shared-components-react";
import { t } from "@/locales";
import { userApi } from "@/api/modules/user";
import { useUserStore } from "@/stores";
import UserSelectDialog from "../components/UserSelectDialog";
import { PageLayoutContent } from "@/components/PageLayout";
import type { ColumnsType } from "antd/es/table";

// Types
interface AdminUser {
  user_id: number;
  nickname: string;
  mobile: string;
  email: string;
  role: number;
  role_label: string;
  is_admin: boolean;
  add_admin_time: string;
}

export function UserAdminPage() {
  const userStore = useUserStore();

  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<AdminUser[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog state
  const [userSelectDialogOpen, setUserSelectDialogOpen] = useState(false);

  // User info
  const userInfo = useMemo(() => userStore.info, [userStore.info]);

  // Fetch admin list
  const fetchAdminList = useCallback(async () => {
    setLoading(true);
    try {
      const { total = 0, list = [] } = await userApi.fetch_admin_user({
        keyword: searchKeyword,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });
      setTableTotal(total);
      setTableData(list);
    } catch (error) {
      console.error("Fetch admin list error:", error);
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, page, pageSize]);

  // Handle keyword search - reset to page 1 and trigger search
  const handleSearch = () => {
    setSearchKeyword(keyword);
    setPage(1);
  };

  // Handle add
  const handleAdd = () => {
    setUserSelectDialogOpen(true);
  };

  // Handle user select confirm
  const handleUserSelectConfirm = async ({ value }: { value: any[] }) => {
    try {
      await userApi.batch_save_admin({
        user_ids: value.map((item) => item.user_id),
      });
      message.success(t("action_add_success"));
      setPage(1);
      fetchAdminList();
    } catch (error) {
      console.error("Add admin error:", error);
    }
  };

  // Handle delete
  const handleDelete = async (record: AdminUser) => {
    Modal.confirm({
      title: t("tip"),
      content: t("admin_user.delete_confirm"),
      onOk: async () => {
        try {
          await userApi.batch_remove_admin({ user_ids: [record.user_id] });
          message.success(t("action_delete_success"));
          fetchAdminList();
        } catch (error) {
          console.error("Delete admin error:", error);
        }
      },
    });
  };

  // Table columns
  const columns: ColumnsType<AdminUser> = useMemo(
    () => [
      {
        title: t("user"),
        dataIndex: "nickname",
        key: "nickname",
        width: 160,
        render: (value: string) => (
          <div className="flex items-center gap-1 w-full">
            <UserOutlined />
            <span className="truncate">{value}</span>
          </div>
        ),
      },
      {
        title: t("mobile"),
        dataIndex: "mobile",
        key: "mobile",
        width: 140,
        render: (value: string) => (
          <span className={!value ? "text-gray-400" : ""}>{value || "--"}</span>
        ),
      },
      {
        title: t("email"),
        dataIndex: "email",
        key: "email",
        width: 140,
        render: (value: string) => (
          <span className={!value ? "text-gray-400" : ""}>{value || "--"}</span>
        ),
      },
      {
        title: t("role.title"),
        dataIndex: "role_label",
        key: "role_label",
        width: 120,
        render: (value: string) => (
          <span className={!value ? "text-gray-400" : ""}>
            {t(value) || "--"}
          </span>
        ),
      },
      {
        title: t("add_time"),
        dataIndex: "add_admin_time",
        key: "add_admin_time",
        width: 160,
        render: (value: string) => (
          <span className={!value ? "text-gray-400" : ""}>
            {(value || "").slice(0, 16) || "--"}
          </span>
        ),
      },
      {
        title: t("operation"),
        key: "operation",
        width: 60,
        fixed: "end",
        render: (_: any, record: AdminUser) => {
          if (record.is_admin && userInfo?.user_id !== record.user_id) {
            return (
              <Button
                type="link"
                danger
                icon={<SvgIcon name="delete" />}
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(record);
                }}
              />
            );
          }
          return "--";
        },
      },
    ],
    [t, userInfo.user_id],
  );

  // Fetch data when search params change
  useEffect(() => {
    fetchAdminList();
  }, [fetchAdminList]);

  // Filter bar
  const filterBar = (
    <>
      <Search
        mode="expanded"
        value={keyword}
        onDebouncedChange={(val) => {
          setKeyword(val);
          setSearchKeyword(val);
          setPage(1);
        }}
        placeholder={t("admin_user.search_placeholder")}
        className="w-[268px]"
      />
      <Button type="primary" onClick={handleAdd}>
        {t("action_add")}
      </Button>
    </>
  );

  return (
    <PageLayoutContent header={t("admin_user.title")} filterBar={filterBar}>
      <Table
        rowKey="user_id"
        columns={columns}
        dataSource={tableData}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: tableTotal,
          showSizeChanger: true,
          showTotal: (total) => t("table_footer_text", { total }),
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
              setPage(1);
            }
          },
        }}
        rowClassName="group"
      />

      {/* User Select Dialog */}
      <UserSelectDialog
        open={userSelectDialogOpen}
        onClose={() => setUserSelectDialogOpen(false)}
        onSuccess={(result) => {
          setUserSelectDialogOpen(false);
          handleUserSelectConfirm(result);
        }}
      />
    </PageLayoutContent>
  );
}

export default UserAdminPage;
