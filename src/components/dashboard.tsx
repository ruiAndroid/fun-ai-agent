"use client";

import { listInstances, submitInstanceAction } from "@/lib/control-api";
import { InstanceActionType, LobsterInstance } from "@/types/contracts";
import { Alert, Button, Card, Descriptions, Layout, Space, Table, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function statusColor(status: LobsterInstance["status"]) {
  if (status === "RUNNING") {
    return "green";
  }
  if (status === "ERROR") {
    return "red";
  }
  if (status === "CREATING") {
    return "blue";
  }
  return "default";
}

export function Dashboard() {
  const [messageApi, messageContext] = message.useMessage();
  const [instances, setInstances] = useState<LobsterInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>();
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [error, setError] = useState<string>();

  const selectedInstance = useMemo(
    () => instances.find((item) => item.id === selectedInstanceId),
    [instances, selectedInstanceId]
  );

  const loadInstances = useCallback(async () => {
    setLoadingInstances(true);
    setError(undefined);
    try {
      const response = await listInstances();
      setInstances(response.items);
      if (response.items.length > 0) {
        setSelectedInstanceId((current) => current ?? response.items[0].id);
      } else {
        setSelectedInstanceId(undefined);
      }
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "加载龙虾实例失败");
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  const handleAction = async (action: InstanceActionType) => {
    if (!selectedInstanceId) {
      return;
    }
    setSubmittingAction(true);
    try {
      await submitInstanceAction(selectedInstanceId, action);
      await loadInstances();
      messageApi.success(`动作已提交：${action}`);
    } catch (apiError) {
      messageApi.error(apiError instanceof Error ? apiError.message : "提交动作失败");
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <>
      {messageContext}
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
          <Title level={4} style={{ margin: 0 }}>
            fun-ai-agent 龙虾实例管理台
          </Title>
        </Header>
        <Content style={{ padding: 24 }}>
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Card title="龙虾实例列表" extra={<Button onClick={() => void loadInstances()}>刷新</Button>}>
              {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} /> : null}
              <Table<LobsterInstance>
                rowKey="id"
                loading={loadingInstances}
                dataSource={instances}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedInstanceId(record.id),
                })}
                rowClassName={(record) => (record.id === selectedInstanceId ? "ant-table-row-selected" : "")}
                columns={[
                  { title: "实例名", dataIndex: "name" },
                  {
                    title: "状态",
                    dataIndex: "status",
                    render: (value: LobsterInstance["status"]) => <Tag color={statusColor(value)}>{value}</Tag>,
                  },
                  { title: "期望状态", dataIndex: "desiredState" },
                  { title: "Runtime", dataIndex: "runtime" },
                  { title: "更新时间", dataIndex: "updatedAt" },
                ]}
              />
            </Card>

            <Card title={selectedInstance ? `实例详情：${selectedInstance.name}` : "请选择实例"}>
              {selectedInstance ? (
                <Space direction="vertical" style={{ width: "100%" }} size="middle">
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="实例ID">{selectedInstance.id}</Descriptions.Item>
                    <Descriptions.Item label="宿主机ID">{selectedInstance.hostId}</Descriptions.Item>
                    <Descriptions.Item label="当前状态">
                      <Tag color={statusColor(selectedInstance.status)}>{selectedInstance.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="期望状态">{selectedInstance.desiredState}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{selectedInstance.createdAt}</Descriptions.Item>
                    <Descriptions.Item label="更新时间">{selectedInstance.updatedAt}</Descriptions.Item>
                  </Descriptions>
                  <Space>
                    <Button
                      type="primary"
                      loading={submittingAction}
                      onClick={() => void handleAction("START")}
                    >
                      启动
                    </Button>
                    <Button loading={submittingAction} onClick={() => void handleAction("STOP")}>
                      停止
                    </Button>
                    <Button loading={submittingAction} onClick={() => void handleAction("RESTART")}>
                      重启
                    </Button>
                    <Button danger loading={submittingAction} onClick={() => void handleAction("ROLLBACK")}>
                      回滚
                    </Button>
                  </Space>
                </Space>
              ) : (
                <Text type="secondary">当前没有可管理的龙虾实例。</Text>
              )}
            </Card>
          </Space>
        </Content>
      </Layout>
    </>
  );
}
