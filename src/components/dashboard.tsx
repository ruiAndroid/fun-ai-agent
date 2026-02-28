"use client";

import { listInstances, submitInstanceAction } from "@/lib/control-api";
import { ClawInstance, InstanceActionType } from "@/types/contracts";
import { Alert, Button, Card, Descriptions, Layout, Space, Table, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const uiText = {
  loadFailed: "\u52a0\u8f7dclaw\u5b9e\u4f8b\u5931\u8d25",
  actionSubmittedPrefix: "\u52a8\u4f5c\u5df2\u63d0\u4ea4\uff1a",
  actionFailed: "\u63d0\u4ea4\u52a8\u4f5c\u5931\u8d25",
  pageTitle: "fun-ai-agent claw\u5b9e\u4f8b\u7ba1\u7406\u53f0",
  listTitle: "claw\u5b9e\u4f8b\u5217\u8868",
  refresh: "\u5237\u65b0",
  instanceName: "\u5b9e\u4f8b\u540d",
  status: "\u72b6\u6001",
  desiredState: "\u671f\u671b\u72b6\u6001",
  updatedAt: "\u66f4\u65b0\u65f6\u95f4",
  detailTitlePrefix: "\u5b9e\u4f8b\u8be6\u60c5\uff1a",
  selectInstance: "\u8bf7\u9009\u62e9\u5b9e\u4f8b",
  instanceId: "\u5b9e\u4f8bID",
  hostId: "\u5bbf\u4e3b\u673aID",
  currentStatus: "\u5f53\u524d\u72b6\u6001",
  createdAt: "\u521b\u5efa\u65f6\u95f4",
  start: "\u542f\u52a8",
  stop: "\u505c\u6b62",
  restart: "\u91cd\u542f",
  rollback: "\u56de\u6eda",
  noInstances: "\u5f53\u524d\u6ca1\u6709\u53ef\u7ba1\u7406\u7684claw\u5b9e\u4f8b\u3002",
} as const;

function statusColor(status: ClawInstance["status"]) {
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
  const [instances, setInstances] = useState<ClawInstance[]>([]);
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
      setError(apiError instanceof Error ? apiError.message : uiText.loadFailed);
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
      messageApi.success(`${uiText.actionSubmittedPrefix}${action}`);
    } catch (apiError) {
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.actionFailed);
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
            {uiText.pageTitle}
          </Title>
        </Header>
        <Content style={{ padding: 24 }}>
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Card title={uiText.listTitle} extra={<Button onClick={() => void loadInstances()}>{uiText.refresh}</Button>}>
              {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} /> : null}
              <Table<ClawInstance>
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
                  { title: uiText.instanceName, dataIndex: "name" },
                  {
                    title: uiText.status,
                    dataIndex: "status",
                    render: (value: ClawInstance["status"]) => <Tag color={statusColor(value)}>{value}</Tag>,
                  },
                  { title: uiText.desiredState, dataIndex: "desiredState" },
                  { title: "Runtime", dataIndex: "runtime" },
                  { title: uiText.updatedAt, dataIndex: "updatedAt" },
                ]}
              />
            </Card>

            <Card title={selectedInstance ? `${uiText.detailTitlePrefix}${selectedInstance.name}` : uiText.selectInstance}>
              {selectedInstance ? (
                <Space direction="vertical" style={{ width: "100%" }} size="middle">
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label={uiText.instanceId}>{selectedInstance.id}</Descriptions.Item>
                    <Descriptions.Item label={uiText.hostId}>{selectedInstance.hostId}</Descriptions.Item>
                    <Descriptions.Item label={uiText.currentStatus}>
                      <Tag color={statusColor(selectedInstance.status)}>{selectedInstance.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={uiText.desiredState}>{selectedInstance.desiredState}</Descriptions.Item>
                    <Descriptions.Item label={uiText.createdAt}>{selectedInstance.createdAt}</Descriptions.Item>
                    <Descriptions.Item label={uiText.updatedAt}>{selectedInstance.updatedAt}</Descriptions.Item>
                  </Descriptions>
                  <Space>
                    <Button
                      type="primary"
                      loading={submittingAction}
                      onClick={() => void handleAction("START")}
                    >
                      {uiText.start}
                    </Button>
                    <Button loading={submittingAction} onClick={() => void handleAction("STOP")}>
                      {uiText.stop}
                    </Button>
                    <Button loading={submittingAction} onClick={() => void handleAction("RESTART")}>
                      {uiText.restart}
                    </Button>
                    <Button danger loading={submittingAction} onClick={() => void handleAction("ROLLBACK")}>
                      {uiText.rollback}
                    </Button>
                  </Space>
                </Space>
              ) : (
                <Text type="secondary">{uiText.noInstances}</Text>
              )}
            </Card>
          </Space>
        </Content>
      </Layout>
    </>
  );
}
