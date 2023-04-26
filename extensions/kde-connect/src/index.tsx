import { ActionPanel, Action, Icon, List, LocalStorage, Form, useNavigation } from "@raycast/api";
import React, { useEffect, useState } from "react";
import { KDEConnect, KDEDevice } from "./device";
import { SendType, SendTypeAllCases, appExists } from "./connector";
import { StorageKey } from "./storage";
import GetKDEConnect from "./getKDEConnect";

const connect = new KDEConnect();

export default function Command() {
  const [loading, setLoading] = useState<boolean>(true);
  const [appOk, setAppOk] = useState<boolean | undefined>();
  const [devices, setDevices] = useState<KDEDevice[]>([]);
  const [favouriteDevice, setFavouriteDevice] = useState<string | undefined>();

  const { push } = useNavigation();

  const refreshDevices = () => {
    setLoading(true);
    connect.listDevices().then((devices) => {
      setDevices(devices);
      setLoading(false);
    });
  };

  useEffect(() => {
    setAppOk(appExists());
    if (!appOk) {
      return;
    }
  }, []);

  useEffect(() => {
    if (appOk) {
      LocalStorage.getItem(StorageKey.pairedDevices).then((value) => {
        if (loading && value) {
          const devices = JSON.parse(value as string) as KDEDevice[];
          setDevices(devices);
        }
      });
      LocalStorage.getItem(StorageKey.favouriteDevice).then((value) => {
        if (loading && value) {
          const device = value as string;
          setFavouriteDevice(device);
        }
      });
      refreshDevices();
    }
  }, [appOk]);

  const deviceStatus = (item: KDEDevice): string => {
    return item.paired ? (item.reachable ? "Connected" : "Unreachable") : "Not Paired";
  };

  const deviceStatusIcon = (item: KDEDevice): Icon => {
    return item.paired ? (item.reachable ? Icon.Bolt : Icon.BoltDisabled) : Icon.Link;
  };

  const setFavourite = (device?: KDEDevice) => {
    if (!device) {
      LocalStorage.removeItem(StorageKey.favouriteDevice);
    } else {
      LocalStorage.setItem(StorageKey.favouriteDevice, device.id);
    }
    setFavouriteDevice(device?.id);
  };

  if (appOk === false) {
    return <GetKDEConnect />;
  }

  return (
    <List isLoading={loading}>
      <List.Section title="Paired Devices">
        {devices
          .filter((entry) => entry.paired)
          .map((item) => (
            <List.Item
              key={item.id}
              icon={Icon.Mobile}
              title={item.name}
              subtitle={item.id}
              accessories={(item.id === favouriteDevice ? [{ icon: Icon.Star, text: "Favourite" }] : []).concat([
                { icon: deviceStatusIcon(item), text: deviceStatus(item) },
              ])}
              actions={
                <ActionPanel>
                  <Action
                    title="Send"
                    onAction={() => {
                      connect.deviceID = item.id;
                      push(<DeviceActions device={item} connect={connect} />);
                    }}
                  />
                  <Action
                    title="Set Favourite"
                    onAction={() => {
                      setFavourite(item);
                    }}
                  />
                  <Action
                    title="Unset Favourite"
                    onAction={() => {
                      setFavourite(undefined);
                    }}
                  />
                  <Action
                    title="Ping"
                    onAction={() => {
                      connect.ping(item.id);
                    }}
                  />
                  <Action
                    title="Unpair"
                    onAction={() => {
                      connect.unpairDevice(item.id).then(() => {
                        refreshDevices();
                      });
                    }}
                  />
                </ActionPanel>
              }
            />
          ))}
      </List.Section>
      <List.Section title="Discovered Devices">
        {devices
          .filter((entry) => !entry.paired)
          .map((item) => (
            <List.Item
              key={item.id}
              icon={Icon.Mobile}
              title={item.name}
              subtitle={item.id}
              accessories={(item.id === favouriteDevice ? [{ icon: Icon.Star, text: "Favourite" }] : []).concat([
                { icon: deviceStatusIcon(item), text: deviceStatus(item) },
              ])}
              actions={
                <ActionPanel>
                  <Action
                    title="Pair Device"
                    onAction={() => {
                      setLoading(true);
                      connect.pairDevice(item.id).then(() => {
                        setLoading(false);
                      });
                      refreshDevices();
                    }}
                  />
                </ActionPanel>
              }
            />
          ))}
      </List.Section>
    </List>
  );
}

// TODO: imple all types
function DeviceActions(props: { device: KDEDevice; connect: KDEConnect }) {
  const { pop } = useNavigation();
  const [sendType, setSendType] = useState<SendType>(SendType.Text);
  const setSendTypeCast = (string: string) => {
    setSendType(string as SendType);
  };

  interface SendData {
    destination?: string;
    content: string;
  }

  const textField = () => {
    switch (sendType) {
      case SendType.SMS:
        return (
          <React.Fragment>
            <Form.TextField id="destination" title="Phone Number" />
            <Form.TextArea id="content" title="Content" />
          </React.Fragment>
        );

      default:
        return <Form.TextArea id="content" title="Content" />;
    }
  };

  const submitAction = (values: SendData) => {
    switch (sendType) {
      case SendType.SMS:
        props.connect.sendSMS(values.destination as string, values.content).then(pop);
        break;

      case SendType.URL:
        props.connect.share(values.content).then(pop);
        break;

      default:
        props.connect.sendText(values.content).then(pop);
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send" onSubmit={submitAction} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="type" title="Content Type" value={sendType} onChange={setSendTypeCast}>
        {SendTypeAllCases.map((type) => (
          <Form.Dropdown.Item key={type} value={type} title={type} />
        ))}
      </Form.Dropdown>
      {textField()}
    </Form>
  );
}
