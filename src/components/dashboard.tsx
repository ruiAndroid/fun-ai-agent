"use client";

import { createInstance, listImages, listInstances, submitInstanceAction } from "@/lib/control-api";
import { ClawInstance, CreateInstanceRequest, ImagePreset, InstanceActionType } from "@/types/contracts";
import { Alert, Button, Card, Descriptions, Form, Input, Layout, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uiText = {
  loadFailed: "\u52a0\u8f7dclaw\u5b9e\u4f8b\u5931\u8d25",
  loadImagesFailed: "\u52a0\u8f7d\u955c\u50cf\u5217\u8868\u5931\u8d25",
  createInstanceFailed: "\u521b\u5efa\u5b9e\u4f8b\u5931\u8d25",
  actionSubmittedPrefix: "\u52a8\u4f5c\u5df2\u63d0\u4ea4\uff1a",
  instanceCreatedPrefix: "\u5b9e\u4f8b\u521b\u5efa\u6210\u529f\uff1a",
  actionFailed: "\u63d0\u4ea4\u52a8\u4f5c\u5931\u8d25",
  pageTitle: "fun-ai-agent claw\u5b9e\u4f8b\u7ba1\u7406\u53f0",
  listTitle: "claw\u5b9e\u4f8b\u5217\u8868",
  refresh: "\u5237\u65b0",
  create: "\u65b0\u589e\u5b9e\u4f8b",
  image: "\u955c\u50cf",
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
  createModalTitle: "\u521b\u5efa\u65b0\u5b9e\u4f8b",
  hostIdInputTip: "\u8bf7\u8f93\u5165UUID\uff0c\u4f8b\u5982 123e4567-e89b-12d3-a456-426614174000",
  desiredStateRunning: "\u8fd0\u884c",
  desiredStateStopped: "\u505c\u6b62",
  noPresetImage: "\u5f53\u524d\u6ca1\u6709\u53ef\u9009\u9884\u7f6e\u955c\u50cf\uff0c\u8bf7\u5148\u5728API\u914d\u7f6e app.images.presets",
  requiredName: "\u8bf7\u8f93\u5165\u5b9e\u4f8b\u540d",
  requiredHostId: "\u8bf7\u8f93\u5165\u5bbf\u4e3b\u673aID",
  invalidHostId: "\u5bbf\u4e3b\u673aID\u683c\u5f0f\u4e0d\u6b63\u786e\uff08\u9700UUID\uff09",
  requiredImage: "\u8bf7\u9009\u62e9\u955c\u50cf",
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
  const [createForm] = Form.useForm<CreateInstanceRequest>();
  const [instances, setInstances] = useState<ClawInstance[]>([]);
  const [images, setImages] = useState<ImagePreset[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>();
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
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

  const loadImages = useCallback(async () => {
    setLoadingImages(true);
    try {
      const response = await listImages();
      setImages(response.items);
      if (response.items.length > 0) {
        const defaultImage = response.items.find((item) => item.recommended)?.image ?? response.items[0].image;
        createForm.setFieldValue("image", defaultImage);
      }
    } catch (apiError) {
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.loadImagesFailed);
    } finally {
      setLoadingImages(false);
    }
  }, [createForm, messageApi]);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  const openCreateModal = () => {
    setCreateModalOpen(true);
    createForm.setFieldsValue({
      desiredState: "RUNNING",
    });
    void loadImages();
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    createForm.resetFields();
  };

  const handleCreateInstance = async () => {
    try {
      const values = await createForm.validateFields();
      setCreatingInstance(true);
      const instance = await createInstance(values);
      closeCreateModal();
      await loadInstances();
      setSelectedInstanceId(instance.id);
      messageApi.success(`${uiText.instanceCreatedPrefix}${instance.name}`);
    } catch (apiError) {
      const hasValidationError =
        typeof apiError === "object" &&
        apiError !== null &&
        "errorFields" in apiError;
      if (hasValidationError) {
        return;
      }
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.createInstanceFailed);
    } finally {
      setCreatingInstance(false);
    }
  };

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
            <Card
              title={uiText.listTitle}
              extra={(
                <Space>
                  <Button onClick={() => void loadInstances()}>{uiText.refresh}</Button>
                  <Button type="primary" onClick={openCreateModal}>
                    {uiText.create}
                  </Button>
                </Space>
              )}
            >
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
                  { title: uiText.image, dataIndex: "image" },
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
                    <Descriptions.Item label={uiText.image}>{selectedInstance.image}</Descriptions.Item>
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
      <Modal
        title={uiText.createModalTitle}
        open={createModalOpen}
        onCancel={closeCreateModal}
        onOk={() => void handleCreateInstance()}
        okText={uiText.create}
        confirmLoading={creatingInstance}
      >
        <Form<CreateInstanceRequest> form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label={uiText.instanceName}
            rules={[{ required: true, message: uiText.requiredName }]}
          >
            <Input placeholder="zeroclaw-instance-01" />
          </Form.Item>
          <Form.Item
            name="hostId"
            label={uiText.hostId}
            extra={uiText.hostIdInputTip}
            rules={[
              { required: true, message: uiText.requiredHostId },
              { pattern: uuidPattern, message: uiText.invalidHostId },
            ]}
          >
            <Input placeholder="123e4567-e89b-12d3-a456-426614174000" />
          </Form.Item>
          <Form.Item
            name="image"
            label={uiText.image}
            rules={[{ required: true, message: uiText.requiredImage }]}
          >
            <Select
              loading={loadingImages}
              options={images.map((item) => ({
                value: item.image,
                label: item.recommended ? `${item.name} (recommended) - ${item.image}` : `${item.name} - ${item.image}`,
              }))}
            />
          </Form.Item>
          {images.length === 0 && !loadingImages ? (
            <Alert type="warning" showIcon message={uiText.noPresetImage} />
          ) : null}
          <Form.Item name="desiredState" label={uiText.desiredState} initialValue="RUNNING">
            <Select
              options={[
                { value: "RUNNING", label: uiText.desiredStateRunning },
                { value: "STOPPED", label: uiText.desiredStateStopped },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
