"use client";

import { createInstance, deleteInstance, listImages, listInstances, submitInstanceAction } from "@/lib/control-api";
import { appConfig } from "@/config/app-config";
import { ClawInstance, CreateInstanceRequest, ImagePreset, InstanceActionType } from "@/types/contracts";
import { Alert, Button, Card, Descriptions, Form, Input, Layout, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
type CreateInstanceFormValues = Omit<CreateInstanceRequest, "hostId">;

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
  gatewayHostPort: "\u7f51\u5173\u7aef\u53e3",
  gatewayUrl: "\u8bbf\u95ee\u5730\u5740",
  gatewayUrlUnavailable: "\u672a\u5206\u914d",
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
  delete: "\u5220\u9664",
  remoteConnect: "\u8fdc\u7a0b\u8fde\u63a5",
  remoteConnectTitle: "\u8fdc\u7a0b\u547d\u4ee4\u884c\u8fde\u63a5",
  remoteConnectHint: "\u590d\u5236\u4e0b\u65b9\u547d\u4ee4\u540e\uff0c\u5728\u4f60\u7684\u7ec8\u7aef\u6267\u884c\u5373\u53ef\u8fdb\u5165\u5b9e\u4f8b\u3002",
  remoteConnectUnavailable: "\u672a\u914d\u7f6e\u8fdc\u7a0b\u8fde\u63a5\u547d\u4ee4\u6a21\u677f",
  remoteConnectCommand: "\u8fde\u63a5\u547d\u4ee4",
  webTerminal: "Web\u7ec8\u7aef",
  connectTerminal: "\u8fde\u63a5\u7ec8\u7aef",
  disconnectTerminal: "\u65ad\u5f00\u7ec8\u7aef",
  sendCommand: "\u53d1\u9001",
  terminalInputPlaceholder: "\u8f93\u5165\u547d\u4ee4\uff0c\u56de\u8f66\u53ef\u53d1\u9001",
  terminalNotRunning: "\u5b9e\u4f8b\u672a\u8fd0\u884c\uff0c\u65e0\u6cd5\u6253\u5f00Web\u7ec8\u7aef",
  terminalConnectFailed: "Web\u7ec8\u7aef\u8fde\u63a5\u5931\u8d25",
  terminalConnected: "Web\u7ec8\u7aef\u5df2\u8fde\u63a5",
  terminalDisconnected: "Web\u7ec8\u7aef\u5df2\u65ad\u5f00",
  terminalOutput: "\u7ec8\u7aef\u8f93\u51fa",
  copyCommand: "\u590d\u5236\u547d\u4ee4",
  copyCommandSuccess: "\u8fde\u63a5\u547d\u4ee4\u5df2\u590d\u5236",
  copyCommandFailed: "\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u590d\u5236",
  confirmActionTitle: "\u786e\u8ba4\u64cd\u4f5c",
  confirmActionContentPrefix: "\u786e\u8ba4\u5bf9\u5b9e\u4f8b\u6267\u884c\u64cd\u4f5c\uff1a",
  confirmActionOk: "\u786e\u8ba4\u6267\u884c",
  deleteConfirmTitle: "\u5220\u9664\u5b9e\u4f8b",
  deleteConfirmContentPrefix: "\u5220\u9664\u540e\u4e0d\u53ef\u6062\u590d\uff0c\u786e\u8ba4\u5220\u9664\uff1a",
  deleteSuccessPrefix: "\u5b9e\u4f8b\u5df2\u5220\u9664\uff1a",
  deleteFailed: "\u5220\u9664\u5b9e\u4f8b\u5931\u8d25",
  instanceNotFound: "\u5b9e\u4f8b\u4e0d\u5b58\u5728\uff0c\u5df2\u5237\u65b0\u5217\u8868",
  cancel: "\u53d6\u6d88",
  noInstances: "\u5f53\u524d\u6ca1\u6709\u53ef\u7ba1\u7406\u7684claw\u5b9e\u4f8b\u3002",
  createModalTitle: "\u521b\u5efa\u65b0\u5b9e\u4f8b",
  desiredStateRunning: "\u8fd0\u884c",
  desiredStateStopped: "\u505c\u6b62",
  noPresetImage: "\u5f53\u524d\u6ca1\u6709\u53ef\u9009\u9884\u7f6e\u955c\u50cf\uff0c\u8bf7\u5148\u5728API\u914d\u7f6e app.images.presets",
  requiredName: "\u8bf7\u8f93\u5165\u5b9e\u4f8b\u540d",
  nameAlreadyExists: "\u5b9e\u4f8b\u540d\u5df2\u5b58\u5728\uff0c\u8bf7\u66f4\u6362",
  requiredImage: "\u8bf7\u9009\u62e9\u955c\u50cf",
  fixedHostTipPrefix: "\u5f53\u524d\u5bbf\u4e3b\u673aID\u5df2\u56fa\u5b9a\uff1a",
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
  const [createForm] = Form.useForm<CreateInstanceFormValues>();
  const [instances, setInstances] = useState<ClawInstance[]>([]);
  const [images, setImages] = useState<ImagePreset[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>();
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<Exclude<InstanceActionType, "START">>();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [remoteModalOpen, setRemoteModalOpen] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState(false);
  const [error, setError] = useState<string>();
  const terminalSocketRef = useRef<WebSocket | null>(null);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalConnecting, setTerminalConnecting] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const terminalOutputRef = useRef<HTMLDivElement | null>(null);

  const selectedInstance = useMemo(
    () => instances.find((item) => item.id === selectedInstanceId),
    [instances, selectedInstanceId]
  );
  const selectedStatus = selectedInstance?.status;
  const actionBusy = submittingAction || deletingInstance;
  const disableStart = !selectedInstance || actionBusy || selectedStatus === "RUNNING" || selectedStatus === "CREATING";
  const disableStop = !selectedInstance || actionBusy || selectedStatus === "STOPPED" || selectedStatus === "CREATING";
  const disableRestart = !selectedInstance || actionBusy || selectedStatus === "CREATING";
  const disableRollback = !selectedInstance || actionBusy || selectedStatus === "CREATING";
  const disableDelete = !selectedInstance || actionBusy;
  const disableRemoteConnect = !selectedInstance;
  const selectedRemoteConnectCommand = selectedInstance?.remoteConnectCommand?.trim();
  const terminalRenderedLines = useMemo(() => terminalOutput.split("\n"), [terminalOutput]);

  const loadInstances = useCallback(async () => {
    setLoadingInstances(true);
    setError(undefined);
    try {
      const response = await listInstances();
      setInstances(response.items);
      if (response.items.length > 0) {
        setSelectedInstanceId((current) => {
          if (!current) {
            return response.items[0].id;
          }
          const exists = response.items.some((item) => item.id === current);
          return exists ? current : response.items[0].id;
        });
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

  useEffect(() => {
    return () => {
      terminalSocketRef.current?.close();
      terminalSocketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const outputElement = terminalOutputRef.current;
    if (!outputElement) {
      return;
    }
    outputElement.scrollTop = outputElement.scrollHeight;
  }, [terminalOutput]);

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

  const openDeleteModal = () => {
    if (!selectedInstance) {
      return;
    }
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deletingInstance) {
      return;
    }
    setDeleteModalOpen(false);
  };

  const openRemoteModal = () => {
    if (!selectedInstance) {
      return;
    }
    setRemoteModalOpen(true);
  };

  const closeRemoteModal = () => {
    disconnectTerminal();
    setTerminalOutput("");
    setTerminalCommand("");
    setRemoteModalOpen(false);
  };

  const handleCreateInstance = async () => {
    try {
      const values = await createForm.validateFields();
      const request: CreateInstanceRequest = {
        ...values,
        hostId: appConfig.defaultHostId,
      };
      setCreatingInstance(true);
      const instance = await createInstance(request);
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
      if (apiError instanceof Error && apiError.message.includes("HTTP 409")) {
        createForm.setFields([{ name: "name", errors: [uiText.nameAlreadyExists] }]);
        messageApi.error(uiText.nameAlreadyExists);
        return;
      }
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.createInstanceFailed);
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleAction = async (action: InstanceActionType) => {
    if (!selectedInstanceId) {
      return false;
    }
    setSubmittingAction(true);
    try {
      await submitInstanceAction(selectedInstanceId, action);
      await loadInstances();
      messageApi.success(`${uiText.actionSubmittedPrefix}${action}`);
      return true;
    } catch (apiError) {
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.actionFailed);
      return false;
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSensitiveAction = (action: Exclude<InstanceActionType, "START">) => {
    const instanceName = selectedInstance?.name;
    if (!instanceName) {
      return;
    }
    setPendingAction(action);
    setActionConfirmOpen(true);
  };

  const closeActionConfirm = () => {
    if (submittingAction) {
      return;
    }
    setActionConfirmOpen(false);
    setPendingAction(undefined);
  };

  const handleConfirmSensitiveAction = async () => {
    if (!pendingAction) {
      return;
    }
    const succeeded = await handleAction(pendingAction);
    if (succeeded) {
      closeActionConfirm();
    }
  };

  const handleDeleteInstance = async () => {
    if (!selectedInstance) {
      return;
    }

    const instanceName = selectedInstance.name;
    const instanceId = selectedInstance.id;
    setDeletingInstance(true);
    try {
      await deleteInstance(instanceId);
      await loadInstances();
      setDeleteModalOpen(false);
      messageApi.success(`${uiText.deleteSuccessPrefix}${instanceName}`);
    } catch (apiError) {
      if (apiError instanceof Error && apiError.message.includes("HTTP 404")) {
        await loadInstances();
        setDeleteModalOpen(false);
        messageApi.warning(uiText.instanceNotFound);
        return;
      }
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.deleteFailed);
    } finally {
      setDeletingInstance(false);
    }
  };

  const copyRemoteConnectCommand = async () => {
    if (!selectedRemoteConnectCommand) {
      messageApi.warning(uiText.remoteConnectUnavailable);
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedRemoteConnectCommand);
      messageApi.success(uiText.copyCommandSuccess);
    } catch (apiError) {
      messageApi.error(apiError instanceof Error ? apiError.message : uiText.copyCommandFailed);
    }
  };

  const appendTerminalOutput = useCallback((chunk: string) => {
    setTerminalOutput((current) => {
      const next = `${current}${chunk}`;
      if (next.length <= 120000) {
        return next;
      }
      return next.slice(next.length - 120000);
    });
  }, []);

  const buildTerminalWebSocketUrl = useCallback((instanceId: string) => {
    const apiBase = appConfig.controlApiBaseUrl;
    const query = `instanceId=${encodeURIComponent(instanceId)}`;

    if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
      const wsBase = apiBase.replace(/^http/i, "ws").replace(/\/$/, "");
      return `${wsBase}/v1/terminal/ws?${query}`;
    }

    const normalizedApiBase = apiBase.startsWith("/") ? apiBase : `/${apiBase}`;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}${normalizedApiBase}/v1/terminal/ws?${query}`;
  }, []);

  const disconnectTerminal = useCallback(() => {
    const socket = terminalSocketRef.current;
    terminalSocketRef.current = null;
    if (socket) {
      socket.close();
    }
    setTerminalConnecting(false);
    setTerminalConnected(false);
  }, []);

  const connectTerminal = useCallback(() => {
    if (!selectedInstance) {
      return;
    }
    if (selectedInstance.status !== "RUNNING") {
      messageApi.warning(uiText.terminalNotRunning);
      return;
    }

    disconnectTerminal();
    setTerminalOutput("");
    setTerminalCommand("");
    setTerminalConnecting(true);

    const socket = new WebSocket(buildTerminalWebSocketUrl(selectedInstance.id));
    terminalSocketRef.current = socket;

    socket.onopen = () => {
      setTerminalConnecting(false);
      setTerminalConnected(true);
      messageApi.success(uiText.terminalConnected);
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        appendTerminalOutput(event.data);
      }
    };

    socket.onerror = () => {
      messageApi.error(uiText.terminalConnectFailed);
    };

    socket.onclose = () => {
      terminalSocketRef.current = null;
      setTerminalConnecting(false);
      setTerminalConnected(false);
      appendTerminalOutput(`[system] ${uiText.terminalDisconnected}\n`);
    };
  }, [appendTerminalOutput, buildTerminalWebSocketUrl, disconnectTerminal, messageApi, selectedInstance]);

  const sendTerminalCommand = useCallback(() => {
    const socket = terminalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      messageApi.warning(uiText.terminalConnectFailed);
      return;
    }
    if (!terminalCommand.trim()) {
      return;
    }
    appendTerminalOutput(`[you] ${terminalCommand}\n`);
    socket.send(`${terminalCommand}\n`);
    setTerminalCommand("");
  }, [appendTerminalOutput, messageApi, terminalCommand]);

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
                    title: uiText.gatewayUrl,
                    dataIndex: "gatewayUrl",
                    render: (value: string | null | undefined) => value ?? uiText.gatewayUrlUnavailable,
                  },
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
                    <Descriptions.Item label={uiText.gatewayHostPort}>
                      {selectedInstance.gatewayHostPort ?? uiText.gatewayUrlUnavailable}
                    </Descriptions.Item>
                    <Descriptions.Item label={uiText.gatewayUrl} span={2}>
                      {selectedInstance.gatewayUrl ?? uiText.gatewayUrlUnavailable}
                    </Descriptions.Item>
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
                      disabled={disableStart}
                      onClick={() => void handleAction("START")}
                    >
                      {uiText.start}
                    </Button>
                    <Button
                      loading={submittingAction}
                      disabled={disableStop}
                      onClick={() => handleSensitiveAction("STOP")}
                    >
                      {uiText.stop}
                    </Button>
                    <Button
                      loading={submittingAction}
                      disabled={disableRestart}
                      onClick={() => handleSensitiveAction("RESTART")}
                    >
                      {uiText.restart}
                    </Button>
                    <Button
                      danger
                      loading={submittingAction}
                      disabled={disableRollback}
                      onClick={() => handleSensitiveAction("ROLLBACK")}
                    >
                      {uiText.rollback}
                    </Button>
                    <Button danger loading={deletingInstance} disabled={disableDelete} onClick={openDeleteModal}>
                      {uiText.delete}
                    </Button>
                    <Button disabled={disableRemoteConnect} onClick={openRemoteModal}>
                      {uiText.remoteConnect}
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
        <Form<CreateInstanceFormValues> form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label={uiText.instanceName}
            rules={[
              { required: true, message: uiText.requiredName },
              {
                validator: (_, value) => {
                  if (typeof value !== "string") {
                    return Promise.resolve();
                  }
                  const normalized = value.trim().toLowerCase();
                  if (!normalized) {
                    return Promise.resolve();
                  }
                  const duplicated = instances.some((item) => item.name.trim().toLowerCase() === normalized);
                  if (duplicated) {
                    return Promise.reject(new Error(uiText.nameAlreadyExists));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="zeroclaw-instance-01" />
          </Form.Item>
          <Alert type="info" showIcon message={`${uiText.fixedHostTipPrefix}${appConfig.defaultHostId}`} style={{ marginBottom: 16 }} />
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
      <Modal
        title={uiText.remoteConnectTitle}
        open={remoteModalOpen}
        onCancel={closeRemoteModal}
        width="min(1100px, 96vw)"
        styles={{ body: { maxHeight: "78vh", overflowY: "auto" } }}
        footer={[
          <Button key="cancel" onClick={closeRemoteModal}>
            {uiText.cancel}
          </Button>,
          <Button key="copy" type="primary" onClick={() => void copyRemoteConnectCommand()} disabled={!selectedRemoteConnectCommand}>
            {uiText.copyCommand}
          </Button>,
        ]}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Text type="secondary">{uiText.remoteConnectHint}</Text>
          <Text strong>{`${uiText.instanceName}: ${selectedInstance?.name ?? "-"}`}</Text>
          <Text strong>{uiText.remoteConnectCommand}</Text>
          {selectedRemoteConnectCommand ? (
            <Paragraph copyable={{ text: selectedRemoteConnectCommand }} style={{ marginBottom: 0 }}>
              <Text code>{selectedRemoteConnectCommand}</Text>
            </Paragraph>
          ) : (
            <Alert type="warning" showIcon message={uiText.remoteConnectUnavailable} />
          )}
          <Text strong>{uiText.webTerminal}</Text>
          <Space>
            <Button type="primary" loading={terminalConnecting} disabled={terminalConnected} onClick={connectTerminal}>
              {uiText.connectTerminal}
            </Button>
            <Button disabled={!terminalConnected} onClick={disconnectTerminal}>
              {uiText.disconnectTerminal}
            </Button>
          </Space>
          <Text>{uiText.terminalOutput}</Text>
          <div
            ref={terminalOutputRef}
            style={{
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              padding: 12,
              height: 360,
              overflowY: "auto",
              background: "#fff",
              fontFamily: "monospace",
              fontSize: 13,
            }}
          >
            {terminalRenderedLines.map((line, index) => {
              const normalizedLine = line ?? "";
              const isSystemLine = normalizedLine.startsWith("[system]");
              const isUserLine = normalizedLine.startsWith("[you]");
              const color = isUserLine ? "#1677ff" : isSystemLine ? "#8c8c8c" : "#111111";
              return (
                <div key={`${index}-${normalizedLine}`} style={{ whiteSpace: "pre-wrap", color }}>
                  {normalizedLine}
                </div>
              );
            })}
          </div>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={terminalCommand}
              onChange={(event) => setTerminalCommand(event.target.value)}
              placeholder={uiText.terminalInputPlaceholder}
              onPressEnter={() => sendTerminalCommand()}
              disabled={!terminalConnected}
            />
            <Button type="primary" onClick={sendTerminalCommand} disabled={!terminalConnected || !terminalCommand.trim()}>
              {uiText.sendCommand}
            </Button>
          </Space.Compact>
        </Space>
      </Modal>
      <Modal
        title={uiText.confirmActionTitle}
        open={actionConfirmOpen}
        onCancel={closeActionConfirm}
        onOk={() => void handleConfirmSensitiveAction()}
        okText={uiText.confirmActionOk}
        cancelText={uiText.cancel}
        confirmLoading={submittingAction}
        okButtonProps={{ danger: pendingAction === "ROLLBACK" }}
        destroyOnHidden
      >
        <Text>{`${uiText.confirmActionContentPrefix}${pendingAction ?? "-"} (${selectedInstance?.name ?? "-"})`}</Text>
      </Modal>
      <Modal
        title={uiText.deleteConfirmTitle}
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={() => void handleDeleteInstance()}
        okText={uiText.delete}
        cancelText={uiText.cancel}
        confirmLoading={deletingInstance}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Text>{`${uiText.deleteConfirmContentPrefix}${selectedInstance?.name ?? "-"}`}</Text>
      </Modal>
    </>
  );
}
